import { z } from 'zod';
import { listQuerySchema, sortSchema } from '../../shared/mongoose/paginate';
import { atLeastOneField, objectIdSchema, zDateOnly, zDateTime } from '../../shared/zod';
import { moneySchema } from '../courses/courses.validation';
import { PAYMENT_METHODS } from './payment.model';
import { TUITION_PLANS, TUITION_STATUSES } from './tuition-account.model';

const discountSchema = z.object({ label: z.string().trim().min(1).max(100), amount: moneySchema });
const installmentSchema = z.object({ dueDate: zDateOnly, amount: moneySchema });

export const backfillSchema = z.object({ studentId: objectIdSchema });

export const updateAccountSchema = atLeastOneField(
  z
    .object({
      discounts: z.array(discountSchema).max(10),
      plan: z.enum(TUITION_PLANS),
      installments: z.array(installmentSchema).min(1).max(12),
      note: z.string().trim().max(500).nullable(),
    })
    .partial(),
);

export const listAccountsQuerySchema = listQuerySchema.extend({
  status: z.enum(TUITION_STATUSES).optional(),
  branchId: objectIdSchema.optional(),
  courseId: objectIdSchema.optional(),
  includeArchived: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  sort: sortSchema(['createdAt', 'updatedAt', 'total', 'paidAmount', 'status', 'lastPaymentAt']),
});

export const addPaymentSchema = z.object({
  amount: moneySchema.refine((value) => value > 0, 'Số tiền phải lớn hơn 0'),
  method: z.enum(PAYMENT_METHODS),
  paidAt: zDateTime
    .refine((value) => value.getTime() <= Date.now() + 5 * 60_000, 'Ngày thu không được ở tương lai')
    .optional(),
  note: z.string().trim().max(500).optional(),
});
export const voidPaymentSchema = z.object({ reason: z.string().trim().min(3).max(300) });
export const paymentParamsSchema = z.object({ id: objectIdSchema, paymentId: objectIdSchema });

export type AddPaymentInput = z.infer<typeof addPaymentSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type ListAccountsQuery = z.infer<typeof listAccountsQuerySchema>;
