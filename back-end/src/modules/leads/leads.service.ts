import { Types, type FilterQuery } from 'mongoose';
import { assertBranchAccess, branchFilter } from '../../middlewares/authorize.middleware';
import { paginate, type ListQuery } from '../../shared/mongoose/paginate';
import { addFixedDays } from '../../shared/time';
import { ApiError } from '../../utils/ApiError';
import { normalizePhone } from '../../utils/phone';
import { escapeRegex } from '../../utils/regex';
import { recordAudit, snapshot } from '../audit/audit.service';
import { getBranch } from '../branches/branches.service';
import { Appointment } from '../appointments/appointment.model';
import { Course } from '../courses/course.model';
import { User } from '../users/user.model';
import { LeadActivity } from './lead-activity.model';
import { nextLeadCode } from './lead.code';
import { Lead, type ILead, type LeadDoc } from './lead.model';
import { canTransition, OPEN_STATUSES, STATUS_LABELS, type LeadStatus } from './lead.status';
import { addActivity } from './leads.activity';
import type {
  CreateActivityInput,
  CreateLeadInput,
  LeadFilterQuery,
  LeadStatusInput,
  ListLeadsQuery,
  UpdateLeadInput,
} from './leads.validation';

type Actor = Express.AuthUser;
type Scope = Express.BranchScope | undefined;

const PHONE_LIKE = /^[\d\s.+()-]+$/;

export function buildLeadFilter(scope: Scope, query: LeadFilterQuery): FilterQuery<ILead> {
  const conditions: FilterQuery<ILead>[] = [branchFilter(scope)];
  if (query.branchId) {
    assertBranchAccess(scope, query.branchId);
    conditions.push({ branchId: new Types.ObjectId(query.branchId) });
  }
  if (query.status) conditions.push({ status: query.status });
  if (query.source) conditions.push({ source: query.source });
  if (query.courseId) conditions.push({ courseId: new Types.ObjectId(query.courseId) });
  if (query.assigneeId) {
    conditions.push({ assigneeId: query.assigneeId === 'none' ? null : new Types.ObjectId(query.assigneeId) });
  }
  if (query.followUpDue) conditions.push({ nextFollowUpAt: { $lte: new Date() }, status: { $in: OPEN_STATUSES } });
  if (query.from || query.to) {
    conditions.push({
      createdAt: {
        ...(query.from ? { $gte: query.from } : {}),
        ...(query.to ? { $lt: addFixedDays(query.to, 1) } : {}),
      },
    });
  }
  if (query.q) {
    const text = new RegExp(escapeRegex(query.q), 'i');
    const or: FilterQuery<ILead>[] = [{ name: text }, { code: text }];
    if (PHONE_LIKE.test(query.q)) {
      const phone = normalizePhone(query.q);
      if (phone.replace(/\D/g, '').length >= 3) or.push({ phone: new RegExp(escapeRegex(phone)) });
    }
    conditions.push({ $or: or });
  }
  return { $and: conditions };
}

export async function listLeads(scope: Scope, query: ListLeadsQuery) {
  return paginate(Lead, buildLeadFilter(scope, query), query);
}

export async function getLead(scope: Scope, id: string): Promise<LeadDoc> {
  const lead = await Lead.findOne({ $and: [{ _id: id }, branchFilter(scope)] });
  if (!lead) throw ApiError.notFound('Không tìm thấy khách hàng');
  return lead;
}

export async function assertAssignee(assigneeId: string, branchId: string): Promise<{ name: string }> {
  const user = await User.findOne({
    _id: assigneeId,
    status: 'active',
    role: { $in: ['consultant', 'branch_manager'] },
    branchIds: new Types.ObjectId(branchId),
  });
  if (!user) {
    throw ApiError.badRequest('Người phụ trách phải là tư vấn viên hoặc quản lý đang làm ở chi nhánh của khách', [
      { path: 'body.assigneeId', message: 'Không hợp lệ' },
    ]);
  }
  return { name: user.name };
}

async function resolveCourse(
  courseId: string | null | undefined,
): Promise<{ courseId: string | null; courseCode: string | null }> {
  if (!courseId) return { courseId: null, courseCode: null };
  const course = await Course.findById(courseId);
  if (!course) throw ApiError.badRequest('Gói học không tồn tại', [{ path: 'body.courseId', message: 'Không tồn tại' }]);
  return { courseId: course.id, courseCode: course.code };
}

export async function createLead(actor: Actor, scope: Scope, input: CreateLeadInput): Promise<LeadDoc> {
  assertBranchAccess(scope, input.branchId);
  await getBranch(input.branchId);
  const course = await resolveCourse(input.courseId);
  if (input.assigneeId) await assertAssignee(input.assigneeId, input.branchId);
  const lead = await Lead.create({
    ...input,
    ...course,
    code: await nextLeadCode(),
    source: input.source ?? 'walk_in',
    status: 'new',
    lastActivityAt: new Date(),
  });
  await addActivity(lead.id, { type: 'created', content: 'Nhân viên tạo khách hàng', byUserId: actor.id });
  return (await Lead.findById(lead.id))!;
}

async function moveAppointmentsToBranch(leadId: string, branchId: string): Promise<void> {
  const assigneeIds = await Appointment.distinct('assigneeId', { leadId, assigneeId: { $ne: null } });
  const valid = assigneeIds.length
    ? await User.find({ _id: { $in: assigneeIds }, branchIds: new Types.ObjectId(branchId) }).distinct('_id')
    : [];
  const validIds = new Set(valid.map(String));
  const invalid = assigneeIds.filter((id) => !validIds.has(String(id)));
  if (invalid.length) await Appointment.updateMany({ leadId, assigneeId: { $in: invalid } }, { assigneeId: null });
  await Appointment.updateMany({ leadId }, { branchId });
}

export async function updateLead(actor: Actor, scope: Scope, id: string, input: UpdateLeadInput): Promise<LeadDoc> {
  const lead = await getLead(scope, id);
  const changes: Record<string, unknown> = { ...input };
  const notes: string[] = [];
  let newBranchId: string | undefined;

  if (input.branchId && input.branchId !== lead.branchId.toString()) {
    if (lead.status === 'enrolled') throw ApiError.conflict('Khách đã nhập học, không thể chuyển chi nhánh');
    assertBranchAccess(scope, input.branchId);
    await getBranch(input.branchId);
    newBranchId = input.branchId;
    if (lead.assigneeId) {
      const stillValid = await User.exists({ _id: lead.assigneeId, branchIds: new Types.ObjectId(input.branchId) });
      if (!stillValid) {
        changes.assigneeId = null;
        notes.push('bỏ người phụ trách vì không thuộc chi nhánh mới');
      }
    }
  }
  if (input.courseId !== undefined) Object.assign(changes, await resolveCourse(input.courseId));

  const at = new Date();
  lead.set(changes);
  lead.lastActivityAt = at;
  await lead.save();
  if (newBranchId) await moveAppointmentsToBranch(lead.id, newBranchId);
  const fields = Object.keys(input).join(', ');
  await addActivity(lead.id, {
    at,
    type: 'updated',
    content: `Cập nhật: ${fields}${notes.length ? ` (${notes.join('; ')})` : ''}`,
    byUserId: actor.id,
  });
  return lead;
}

export async function changeLeadStatus(actor: Actor, scope: Scope, id: string, input: LeadStatusInput): Promise<LeadDoc> {
  const lead = await getLead(scope, id);
  const from = lead.status;
  const to = input.status as LeadStatus;
  if (!canTransition(from, to)) {
    throw ApiError.conflict(`Không thể chuyển từ "${STATUS_LABELS[from]}" sang "${STATUS_LABELS[to]}"`);
  }
  const at = new Date();
  const updated = await Lead.findOneAndUpdate(
    { $and: [{ _id: id, status: from }, branchFilter(scope)] },
    { status: to, lostReason: to === 'lost' ? (input.lostReason ?? null) : null, lastActivityAt: at },
    { returnDocument: 'after' },
  );
  if (!updated) throw ApiError.conflict('Trạng thái khách vừa được người khác thay đổi, vui lòng tải lại');
  await addActivity(updated.id, {
    at,
    type: 'status_change',
    fromStatus: from,
    toStatus: to,
    content: input.note ?? (to === 'lost' ? input.lostReason : null) ?? null,
    byUserId: actor.id,
  });
  return updated;
}

export async function assignLead(actor: Actor, scope: Scope, id: string, assigneeId: string | null): Promise<LeadDoc> {
  const lead = await getLead(scope, id);
  const assignee = assigneeId ? await assertAssignee(assigneeId, lead.branchId.toString()) : null;
  const at = new Date();
  lead.assigneeId = assigneeId ? new Types.ObjectId(assigneeId) : null;
  lead.lastActivityAt = at;
  await lead.save();
  await addActivity(lead.id, {
    at,
    type: 'assign',
    content: assignee ? `Giao cho ${assignee.name}` : 'Bỏ người phụ trách',
    byUserId: actor.id,
  });
  return lead;
}

export async function listLeadActivities(scope: Scope, id: string, query: Pick<ListQuery, 'page' | 'limit'>) {
  const lead = await getLead(scope, id);
  return paginate(LeadActivity, { leadId: lead._id }, { ...query, sort: '-at' }, '-at');
}

export async function addManualActivity(actor: Actor, scope: Scope, id: string, input: CreateActivityInput) {
  const lead = await getLead(scope, id);
  const at = new Date();
  if (input.nextFollowUpAt !== undefined) {
    lead.nextFollowUpAt = input.nextFollowUpAt;
    lead.lastActivityAt = at;
    await lead.save();
  }
  return addActivity(lead.id, { type: input.type, content: input.content, byUserId: actor.id, at });
}

export async function removeLead(actor: Actor, scope: Scope, id: string): Promise<void> {
  const lead = await getLead(scope, id);
  const before = snapshot(lead);
  lead.deletedAt = new Date();
  await lead.save();
  await Appointment.updateMany({ leadId: id, status: 'scheduled' }, { status: 'cancelled', note: 'Khách đã bị xóa' });
  await recordAudit({ actorId: actor.id, action: 'lead.delete', entity: 'lead', entityId: id, before });
}
