import { z } from 'zod';
import { listQuerySchema } from '../../shared/mongoose/paginate';
import { atLeastOneField, objectIdSchema, slugSchema, zDateOnly } from '../../shared/zod';
import { EXAM_RESULTS } from './exam-candidate.model';
import { EXAM_SESSION_STATUSES, EXAM_TYPES } from './exam-session.model';

const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(
    z
      .string()
      .regex(/^[A-Z0-9]+(-[A-Z0-9]+)*$/, 'Mã ca thi chỉ gồm chữ, số và dấu gạch ngang')
      .max(30),
  );

export const createExamSchema = z.object({
  code: codeSchema,
  type: z.enum(EXAM_TYPES),
  courseId: objectIdSchema,
  branchId: objectIdSchema,
  date: zDateOnly,
  location: z.string().trim().max(200).optional(),
  status: z.enum(EXAM_SESSION_STATUSES).optional(),
  note: z.string().trim().max(500).optional(),
});

export const updateExamSchema = atLeastOneField(
  z
    .object({
      code: codeSchema,
      date: zDateOnly,
      location: z.string().trim().max(200).nullable(),
      status: z.enum(EXAM_SESSION_STATUSES),
      note: z.string().trim().max(500).nullable(),
    })
    .partial(),
);

export const addCandidatesSchema = z.object({ studentIds: z.array(objectIdSchema).min(1).max(200) });
export const candidateParamsSchema = z.object({ id: objectIdSchema, candidateId: objectIdSchema });
export const candidateResultSchema = z.object({
  result: z.enum(EXAM_RESULTS),
  score: z.number().min(0).max(1000).nullable().optional(),
  note: z.string().trim().max(500).optional(),
});

export const listExamsQuerySchema = listQuerySchema.extend({
  type: z.enum(EXAM_TYPES).optional(),
  status: z.enum(EXAM_SESSION_STATUSES).optional(),
  branchId: objectIdSchema.optional(),
  courseId: objectIdSchema.optional(),
  from: zDateOnly.optional(),
  to: zDateOnly.optional(),
});

export const publicExamsQuerySchema = z.object({
  branch: slugSchema.optional(),
  course: z.string().trim().toUpperCase().max(10).optional(),
});

export type CreateExamInput = z.infer<typeof createExamSchema>;
export type UpdateExamInput = z.infer<typeof updateExamSchema>;
export type CandidateResultInput = z.infer<typeof candidateResultSchema>;
export type ListExamsQuery = z.infer<typeof listExamsQuerySchema>;
export type PublicExamsQuery = z.infer<typeof publicExamsQuerySchema>;
