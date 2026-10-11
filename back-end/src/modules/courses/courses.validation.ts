import { z } from 'zod';
import { listQuerySchema } from '../../shared/mongoose/paginate';
import { imageInputSchema, objectIdSchema } from '../../shared/zod';
import { VEHICLE_TYPES } from './course.model';

export const moneySchema = z
  .number()
  .int('Số tiền phải là số nguyên (đồng)')
  .min(0, 'Số tiền không được âm')
  .max(1_000_000_000, 'Số tiền quá lớn');

const fields = {
  code: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(z.string().regex(/^[A-Z0-9_]{1,10}$/, 'Mã gói chỉ gồm chữ in hoa, số, gạch dưới (tối đa 10 ký tự)')),
  name: z.string().trim().min(2).max(100),
  vehicleType: z.enum(VEHICLE_TYPES),
  description: z.string().trim().max(1000).optional(),
  duration: z.string().trim().max(100).optional(),
  defaultPrice: moneySchema,
  priceNote: z.string().trim().max(500).optional(),
  image: imageInputSchema.nullable().optional(),
  order: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
};

export const createCourseSchema = z.object(fields);
export const updateCourseSchema = z.object(fields).partial();
export const reorderCoursesSchema = z.object({ ids: z.array(objectIdSchema).min(1).max(100) });
export const listCoursesQuerySchema = listQuerySchema.extend({
  active: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  vehicleType: z.enum(VEHICLE_TYPES).optional(),
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
export type ListCoursesQuery = z.infer<typeof listCoursesQuerySchema>;
