import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';
import { softDeletePlugin } from '../../shared/mongoose/softDelete';

export const APPOINTMENT_TYPES = ['consult', 'docs', 'other'] as const;
export const APPOINTMENT_STATUSES = ['scheduled', 'done', 'cancelled', 'no_show'] as const;
export type AppointmentType = (typeof APPOINTMENT_TYPES)[number];
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const TYPE_LABELS: Record<AppointmentType, string> = { consult: 'tư vấn', docs: 'làm hồ sơ', other: 'khác' };
export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Đã lên lịch',
  done: 'Hoàn thành',
  cancelled: 'Đã hủy',
  no_show: 'Khách không đến',
};

export interface IAppointment {
  leadId?: Types.ObjectId | null;
  branchId: Types.ObjectId;
  startAt: Date;
  endAt: Date;
  durationMinutes: number;
  type: AppointmentType;
  title?: string | null;
  assigneeId?: Types.ObjectId | null;
  status: AppointmentStatus;
  note?: string | null;
  createdBy: Types.ObjectId;
  deletedAt?: Date | null;
}

export type AppointmentDoc = HydratedDocument<IAppointment>;

const appointmentSchema = new Schema<IAppointment>(
  {
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', default: null },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    durationMinutes: { type: Number, required: true, min: 15, max: 480 },
    type: { type: String, enum: APPOINTMENT_TYPES, required: true },
    title: { type: String, trim: true, default: null },
    assigneeId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    status: { type: String, enum: APPOINTMENT_STATUSES, default: 'scheduled' },
    note: { type: String, trim: true, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  schemaOptions<IAppointment>(),
);

appointmentSchema.plugin(softDeletePlugin);
appointmentSchema.index({ branchId: 1, startAt: 1 });
appointmentSchema.index({ assigneeId: 1, startAt: 1 });
appointmentSchema.index({ leadId: 1 });

export const Appointment = model<IAppointment>('Appointment', appointmentSchema);
