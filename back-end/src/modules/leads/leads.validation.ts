import { z } from 'zod';
import { listQuerySchema } from '../../shared/mongoose/paginate';
import { objectIdSchema, zDateOnly, zDateTime } from '../../shared/zod';
import { phoneSchema } from '../users/users.validation';
import { MANUAL_ACTIVITY_TYPES } from './lead-activity.model';
import { LEAD_SOURCES, LEAD_STATUSES } from './lead.model';

const nameSchema = z.string().trim().min(2).max(100);
const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Email không hợp lệ'));
const shortText = z.string().trim().max(100);
const longText = z.string().trim().max(1000);

export const utmSchema = z
  .object({ source: shortText, medium: shortText, campaign: shortText, term: shortText, content: shortText })
  .partial();

export const createLeadSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  email: emailSchema.optional(),
  courseId: objectIdSchema.nullable().optional(),
  branchId: objectIdSchema,
  preferredContactTime: shortText.optional(),
  note: longText.optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  assigneeId: objectIdSchema.optional(),
  nextFollowUpAt: zDateTime.optional(),
});

export const updateLeadSchema = z
  .object({
    name: nameSchema,
    phone: phoneSchema,
    email: emailSchema.nullable(),
    courseId: objectIdSchema.nullable(),
    branchId: objectIdSchema,
    preferredContactTime: shortText.nullable(),
    note: longText.nullable(),
    source: z.enum(LEAD_SOURCES),
    nextFollowUpAt: zDateTime.nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Không có thay đổi nào' });

const MANUAL_STATUSES = LEAD_STATUSES.filter((status) => status !== 'enrolled') as [string, ...string[]];

export const leadStatusSchema = z
  .object({
    status: z.enum(MANUAL_STATUSES, { message: 'Trạng thái không hợp lệ (nhập học chỉ qua chuyển thành học viên)' }),
    lostReason: z.string().trim().min(3).max(300).optional(),
    note: longText.optional(),
  })
  .refine((value) => value.status !== 'lost' || Boolean(value.lostReason), {
    path: ['lostReason'],
    message: 'Bắt buộc nhập lý do khi chuyển sang Không thành công',
  });

export const assignLeadSchema = z.object({ assigneeId: objectIdSchema.nullable() });

export const createActivitySchema = z.object({
  type: z.enum(MANUAL_ACTIVITY_TYPES),
  content: z.string().trim().min(1).max(2000),
  nextFollowUpAt: zDateTime.nullable().optional(),
});

const filterFields = {
  status: z.enum(LEAD_STATUSES).optional(),
  branchId: objectIdSchema.optional(),
  assigneeId: z.union([objectIdSchema, z.literal('none')]).optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  courseId: objectIdSchema.optional(),
  followUpDue: z.literal('true').optional(),
  from: zDateOnly.optional(),
  to: zDateOnly.optional(),
  q: z.string().trim().min(1).max(100).optional(),
};

export const listLeadsQuerySchema = listQuerySchema.extend(filterFields);
export const leadFilterQuerySchema = z.object(filterFields);
export const activitiesQuerySchema = listQuerySchema.pick({ page: true, limit: true });

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type LeadStatusInput = z.infer<typeof leadStatusSchema>;
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>;
export type LeadFilterQuery = z.infer<typeof leadFilterQuerySchema>;
