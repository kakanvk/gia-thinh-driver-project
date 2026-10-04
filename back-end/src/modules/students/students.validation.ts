import { z } from 'zod';
import { listQuerySchema, sortSchema } from '../../shared/mongoose/paginate';
import { atLeastOneField, objectIdSchema, zDateOnly } from '../../shared/zod';
import { phoneSchema } from '../users/users.validation';
import { STUDENT_STATUSES } from './student.model';

const idNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{12}$/, 'Số CCCD phải gồm 12 chữ số');
const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Email không hợp lệ'));

export const studentProfileFields = {
  name: z.string().trim().min(2).max(100),
  phone: phoneSchema,
  email: emailSchema.optional(),
  dob: zDateOnly.optional(),
  idNumber: idNumberSchema.optional(),
  address: z.string().trim().max(255).optional(),
  note: z.string().trim().max(1000).optional(),
};

export const createStudentSchema = z.object({
  ...studentProfileFields,
  courseId: objectIdSchema,
  branchId: objectIdSchema,
  classId: objectIdSchema.optional(),
  enrolledAt: zDateOnly.optional(),
});

export const updateStudentSchema = atLeastOneField(
  z
    .object({
      name: studentProfileFields.name,
      phone: phoneSchema,
      email: emailSchema.nullable(),
      dob: zDateOnly.nullable(),
      idNumber: idNumberSchema.nullable(),
      address: z.string().trim().max(255).nullable(),
      note: z.string().trim().max(1000).nullable(),
      status: z.enum(STUDENT_STATUSES),
      enrolledAt: zDateOnly,
    })
    .partial(),
);

export const assignClassSchema = z.object({ classId: objectIdSchema.nullable() });

export const listStudentsQuerySchema = listQuerySchema.extend({
  sort: sortSchema(['createdAt', 'name', 'code', 'enrolledAt', 'status', 'updatedAt']),
  status: z.enum(STUDENT_STATUSES).optional(),
  branchId: objectIdSchema.optional(),
  classId: objectIdSchema.optional(),
  courseId: objectIdSchema.optional(),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;
