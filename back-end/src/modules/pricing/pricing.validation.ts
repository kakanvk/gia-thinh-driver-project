import { z } from 'zod';
import { listQuerySchema } from '../../shared/mongoose/paginate';
import { objectIdSchema } from '../../shared/zod';
import { moneySchema } from '../courses/courses.validation';
import { PRICE_ITEM_KINDS } from './price-item.model';

export const branchParamsSchema = z.object({ branchId: objectIdSchema });
export const branchCourseParamsSchema = z.object({ branchId: objectIdSchema, courseId: objectIdSchema });

export const setOverrideSchema = z.object({
  price: moneySchema,
  priceNote: z.string().trim().max(500).optional(),
});

const keySchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.string().max(50).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Key chỉ gồm chữ thường không dấu, số và dấu gạch ngang'));

const editable = {
  label: z.string().trim().min(1).max(150),
  amount: moneySchema.nullable().optional(),
  amountMax: moneySchema.nullable().optional(),
  unit: z.string().trim().max(20).nullable().optional(),
  note: z.string().trim().max(300).nullable().optional(),
  hidden: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
};

export const createPriceItemSchema = z.object({
  kind: z.enum(PRICE_ITEM_KINDS),
  key: keySchema,
  courseId: objectIdSchema.nullable().optional(),
  branchId: objectIdSchema.nullable().optional(),
  ...editable,
});

export const updatePriceItemSchema = z.object(editable).partial();

export const listPriceItemsQuerySchema = listQuerySchema.extend({
  kind: z.enum(PRICE_ITEM_KINDS).optional(),
  branchId: z.union([objectIdSchema, z.literal('global')]).optional(),
  courseId: objectIdSchema.optional(),
});

export const publicPricingQuerySchema = z.object({
  branch: z.string().trim().max(150).optional(),
});

export type SetOverrideInput = z.infer<typeof setOverrideSchema>;
export type CreatePriceItemInput = z.infer<typeof createPriceItemSchema>;
export type UpdatePriceItemInput = z.infer<typeof updatePriceItemSchema>;
export type ListPriceItemsQuery = z.infer<typeof listPriceItemsQuerySchema>;
