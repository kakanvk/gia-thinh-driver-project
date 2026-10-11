import { Types, type FilterQuery } from 'mongoose';
import { assertBranchAccess, branchFilter } from '../../middlewares/authorize.middleware';
import { paginate } from '../../shared/mongoose/paginate';
import { addFixedDays, formatVn, vnMonthRange } from '../../shared/time';
import { ApiError } from '../../utils/ApiError';
import { getBranch } from '../branches/branches.service';
import { Lead } from '../leads/lead.model';
import { addActivity } from '../leads/leads.activity';
import { assertAssignee, getLead } from '../leads/leads.service';
import { User } from '../users/user.model';
import {
  Appointment,
  APPOINTMENT_STATUS_LABELS,
  TYPE_LABELS,
  type AppointmentDoc,
  type IAppointment,
} from './appointment.model';
import type {
  AppointmentStatusInput,
  CalendarQuery,
  CreateAppointmentInput,
  ListAppointmentsQuery,
  UpdateAppointmentInput,
} from './appointments.validation';

type Actor = Express.AuthUser;
type Scope = Express.BranchScope | undefined;
const MINUTE_MS = 60_000;

const endOf = (startAt: Date, minutes: number) => new Date(startAt.getTime() + minutes * MINUTE_MS);

async function assertNoOverlap(
  assigneeId: string | null | undefined,
  startAt: Date,
  endAt: Date,
  exceptId?: string,
): Promise<void> {
  if (!assigneeId) return;
  const clash = await Appointment.exists({
    assigneeId,
    status: 'scheduled',
    startAt: { $lt: endAt },
    endAt: { $gt: startAt },
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  });
  if (clash) throw ApiError.conflict('Người phụ trách đã có lịch hẹn trùng giờ');
}

async function logToLead(appointment: AppointmentDoc, content: string, actorId: string): Promise<void> {
  if (appointment.leadId)
    await addActivity(appointment.leadId.toString(), { type: 'appointment', content, byUserId: actorId });
}

export async function getAppointment(scope: Scope, id: string): Promise<AppointmentDoc> {
  const appointment = await Appointment.findOne({ $and: [{ _id: id }, branchFilter(scope)] });
  if (!appointment) throw ApiError.notFound('Không tìm thấy lịch hẹn');
  return appointment;
}

export async function createAppointment(actor: Actor, scope: Scope, input: CreateAppointmentInput): Promise<AppointmentDoc> {
  let branchId: string;
  if (input.leadId) {
    const lead = await getLead(scope, input.leadId);
    branchId = lead.branchId.toString();
    if (input.branchId && input.branchId !== branchId) {
      throw ApiError.badRequest('Lịch hẹn của khách phải thuộc chi nhánh của khách', [
        { path: 'body.branchId', message: 'Không khớp' },
      ]);
    }
  } else {
    branchId = input.branchId!;
    assertBranchAccess(scope, branchId);
    await getBranch(branchId);
  }
  if (input.assigneeId) await assertAssignee(input.assigneeId, branchId);
  const endAt = endOf(input.startAt, input.durationMinutes);
  await assertNoOverlap(input.assigneeId, input.startAt, endAt);

  const appointment = await Appointment.create({
    ...input,
    leadId: input.leadId ?? null,
    branchId,
    endAt,
    status: 'scheduled',
    createdBy: actor.id,
  });
  await logToLead(
    appointment,
    `Hẹn ${TYPE_LABELS[appointment.type]} lúc ${formatVn(appointment.startAt, 'dd/MM/yyyy HH:mm')}`,
    actor.id,
  );
  return appointment;
}

export async function updateAppointment(
  actor: Actor,
  scope: Scope,
  id: string,
  input: UpdateAppointmentInput,
): Promise<AppointmentDoc> {
  const appointment = await getAppointment(scope, id);
  if (input.assigneeId) await assertAssignee(input.assigneeId, appointment.branchId.toString());
  const startAt = input.startAt ?? appointment.startAt;
  const durationMinutes = input.durationMinutes ?? appointment.durationMinutes;
  const endAt = endOf(startAt, durationMinutes);
  const assigneeId = input.assigneeId !== undefined ? input.assigneeId : appointment.assigneeId?.toString();
  if (appointment.status === 'scheduled') await assertNoOverlap(assigneeId, startAt, endAt, id);

  const rescheduled = startAt.getTime() !== appointment.startAt.getTime();
  appointment.set({ ...input, startAt, durationMinutes, endAt });
  await appointment.save();
  if (rescheduled)
    await logToLead(
      appointment,
      `Dời lịch ${TYPE_LABELS[appointment.type]} sang ${formatVn(startAt, 'dd/MM/yyyy HH:mm')}`,
      actor.id,
    );
  return appointment;
}

export async function changeAppointmentStatus(
  actor: Actor,
  scope: Scope,
  id: string,
  input: AppointmentStatusInput,
): Promise<AppointmentDoc> {
  const appointment = await getAppointment(scope, id);
  if (appointment.status === input.status) {
    throw ApiError.conflict(`Lịch hẹn đã ở trạng thái "${APPOINTMENT_STATUS_LABELS[input.status]}"`);
  }
  if (input.status === 'scheduled') {
    await assertNoOverlap(appointment.assigneeId?.toString(), appointment.startAt, appointment.endAt, id);
  }
  appointment.status = input.status;
  if (input.note) appointment.note = input.note;
  await appointment.save();
  await logToLead(
    appointment,
    `Lịch ${TYPE_LABELS[appointment.type]} ${formatVn(appointment.startAt, 'dd/MM/yyyy HH:mm')}: ${APPOINTMENT_STATUS_LABELS[input.status]}${input.note ? ` — ${input.note}` : ''}`,
    actor.id,
  );
  return appointment;
}

function scopedFilter(scope: Scope, query: { branchId?: string; assigneeId?: string; leadId?: string; status?: string }) {
  const conditions: FilterQuery<IAppointment>[] = [branchFilter(scope)];
  if (query.branchId) {
    assertBranchAccess(scope, query.branchId);
    conditions.push({ branchId: new Types.ObjectId(query.branchId) });
  }
  if (query.assigneeId) conditions.push({ assigneeId: new Types.ObjectId(query.assigneeId) });
  if (query.leadId) conditions.push({ leadId: new Types.ObjectId(query.leadId) });
  if (query.status) conditions.push({ status: query.status });
  return conditions;
}

export async function listAppointments(scope: Scope, query: ListAppointmentsQuery) {
  const conditions = scopedFilter(scope, query);
  if (query.from || query.to) {
    conditions.push({
      startAt: {
        ...(query.from ? { $gte: query.from } : {}),
        ...(query.to ? { $lt: addFixedDays(query.to, 1) } : {}),
      },
    });
  }
  return paginate(Appointment, { $and: conditions }, query, 'startAt');
}

export async function getCalendar(scope: Scope, query: CalendarQuery) {
  const { start, end } = vnMonthRange(query.month);
  const conditions = scopedFilter(scope, query);
  conditions.push({ startAt: { $gte: start, $lt: end } });
  const appointments = await Appointment.find({ $and: conditions }).sort({ startAt: 1, _id: 1 });
  const [leads, users] = await Promise.all([
    Lead.find({ _id: { $in: appointments.flatMap((a) => (a.leadId ? [a.leadId] : [])) } }),
    User.find({ _id: { $in: appointments.flatMap((a) => (a.assigneeId ? [a.assigneeId] : [])) } }),
  ]);
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  const userById = new Map(users.map((user) => [user.id, user]));
  return {
    month: query.month,
    items: appointments.map((appointment) => {
      const lead = appointment.leadId ? leadById.get(appointment.leadId.toString()) : undefined;
      const assignee = appointment.assigneeId ? userById.get(appointment.assigneeId.toString()) : undefined;
      return {
        id: appointment.id,
        date: formatVn(appointment.startAt, 'yyyy-MM-dd'),
        time: formatVn(appointment.startAt, 'HH:mm'),
        startAt: appointment.startAt,
        endAt: appointment.endAt,
        type: appointment.type,
        title: appointment.title ?? null,
        status: appointment.status,
        branchId: appointment.branchId.toString(),
        lead: lead ? { id: lead.id, code: lead.code, name: lead.name, phone: lead.phone } : null,
        assignee: assignee ? { id: assignee.id, name: assignee.name } : null,
      };
    }),
  };
}

export async function removeAppointment(actor: Actor, scope: Scope, id: string): Promise<void> {
  const appointment = await getAppointment(scope, id);
  appointment.deletedAt = new Date();
  await appointment.save();
  await logToLead(
    appointment,
    `Xóa lịch ${TYPE_LABELS[appointment.type]} ${formatVn(appointment.startAt, 'dd/MM/yyyy HH:mm')}`,
    actor.id,
  );
}
