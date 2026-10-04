import { z } from 'zod';
import { listQuerySchema } from '../../shared/mongoose/paginate';
import { objectIdSchema, zDateOnly, zDateTime } from '../../shared/zod';
import { APPOINTMENT_STATUSES, APPOINTMENT_TYPES } from './appointment.model';

const duration = z.number().int().min(15).max(480);

export const createAppointmentSchema = z
  .object({
    leadId: objectIdSchema.optional(),
    branchId: objectIdSchema.optional(),
    startAt: zDateTime,
    durationMinutes: duration.default(30),
    type: z.enum(APPOINTMENT_TYPES),
    title: z.string().trim().min(1).max(150).optional(),
    assigneeId: objectIdSchema.optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .refine((value) => value.leadId || value.branchId, {
    path: ['branchId'],
    message: 'Cần chọn khách hàng hoặc chi nhánh',
  });

export const updateAppointmentSchema = z
  .object({
    startAt: zDateTime,
    durationMinutes: duration,
    type: z.enum(APPOINTMENT_TYPES),
    title: z.string().trim().min(1).max(150).nullable(),
    assigneeId: objectIdSchema.nullable(),
    note: z.string().trim().max(1000).nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Không có thay đổi nào' });

export const appointmentStatusSchema = z.object({
  status: z.enum(APPOINTMENT_STATUSES),
  note: z.string().trim().max(1000).optional(),
});

export const listAppointmentsQuerySchema = listQuerySchema.extend({
  from: zDateOnly.optional(),
  to: zDateOnly.optional(),
  branchId: objectIdSchema.optional(),
  assigneeId: objectIdSchema.optional(),
  leadId: objectIdSchema.optional(),
  status: z.enum(APPOINTMENT_STATUSES).optional(),
});

export const calendarQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Tháng phải có dạng YYYY-MM'),
  branchId: objectIdSchema.optional(),
  assigneeId: objectIdSchema.optional(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type AppointmentStatusInput = z.infer<typeof appointmentStatusSchema>;
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;
export type CalendarQuery = z.infer<typeof calendarQuerySchema>;
