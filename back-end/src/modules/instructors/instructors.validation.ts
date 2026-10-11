import { z } from 'zod';
import { listQuerySchema } from '../../shared/mongoose/paginate';
import { atLeastOneField, objectIdSchema } from '../../shared/zod';
import { phoneSchema } from '../users/users.validation';
import { INSTRUCTOR_STATUSES } from './instructor.model';

const specialtiesSchema = z
  .array(z.string().trim().toUpperCase().min(1).max(20))
  .max(10)
  .transform((items) => [...new Set(items)]);

export const createInstructorSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: phoneSchema,
  userId: objectIdSchema.optional(),
  specialties: specialtiesSchema.optional(),
  branchId: objectIdSchema,
  status: z.enum(INSTRUCTOR_STATUSES).optional(),
  note: z.string().trim().max(500).optional(),
});

export const updateInstructorSchema = atLeastOneField(
  z
    .object({
      name: z.string().trim().min(2).max(100),
      phone: phoneSchema,
      userId: objectIdSchema.nullable(),
      specialties: specialtiesSchema,
      status: z.enum(INSTRUCTOR_STATUSES),
      note: z.string().trim().max(500).nullable(),
    })
    .partial(),
);

export const listInstructorsQuerySchema = listQuerySchema.extend({
  status: z.enum(INSTRUCTOR_STATUSES).optional(),
  branchId: objectIdSchema.optional(),
});

export type CreateInstructorInput = z.infer<typeof createInstructorSchema>;
export type UpdateInstructorInput = z.infer<typeof updateInstructorSchema>;
export type ListInstructorsQuery = z.infer<typeof listInstructorsQuerySchema>;
