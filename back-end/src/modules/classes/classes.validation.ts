import { z } from 'zod';
import { listQuerySchema } from '../../shared/mongoose/paginate';
import { atLeastOneField, objectIdSchema, slugSchema, transmissionSchema, zDateOnly } from '../../shared/zod';
import { CLASS_STATUSES } from './class.model';

const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(
    z
      .string()
      .regex(/^[A-Z0-9]+(-[A-Z0-9]+)*$/, 'Mã lớp chỉ gồm chữ, số và dấu gạch ngang')
      .max(30),
  );

const editable = {
  transmission: transmissionSchema.optional(),
  instructorId: objectIdSchema.nullable().optional(),
  startDate: zDateOnly,
  endDate: zDateOnly,
  scheduleText: z.string().trim().min(2).max(100),
  capacity: z.number().int().min(1).max(200),
  status: z.enum(CLASS_STATUSES).optional(),
  note: z.string().trim().max(500).nullable().optional(),
};

const datesInOrder = (value: { startDate?: Date; endDate?: Date }) =>
  !value.startDate || !value.endDate || value.endDate >= value.startDate;

export const createClassSchema = z
  .object({ code: codeSchema, courseId: objectIdSchema, branchId: objectIdSchema, ...editable })
  .refine(datesInOrder, { path: ['endDate'], message: 'Ngày kết thúc phải sau ngày khai giảng' });

export const updateClassSchema = atLeastOneField(z.object({ code: codeSchema, ...editable }).partial()).refine(
  datesInOrder,
  {
    path: ['endDate'],
    message: 'Ngày kết thúc phải sau ngày khai giảng',
  },
);

export const listClassesQuerySchema = listQuerySchema.extend({
  status: z.enum(CLASS_STATUSES).optional(),
  branchId: objectIdSchema.optional(),
  courseId: objectIdSchema.optional(),
  instructorId: objectIdSchema.optional(),
});

export const publicClassesQuerySchema = z.object({
  branch: slugSchema.optional(),
  course: z.string().trim().toUpperCase().max(10).optional(),
});

export type CreateClassInput = z.infer<typeof createClassSchema>;
export type UpdateClassInput = z.infer<typeof updateClassSchema>;
export type ListClassesQuery = z.infer<typeof listClassesQuerySchema>;
export type PublicClassesQuery = z.infer<typeof publicClassesQuerySchema>;
