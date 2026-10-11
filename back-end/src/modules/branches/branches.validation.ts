import { z } from 'zod';
import { listQuerySchema } from '../../shared/mongoose/paginate';
import { objectIdSchema } from '../../shared/zod';
import { BRANCH_STATUSES } from './branch.model';

const fields = {
  name: z.string().trim().min(2).max(100),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug chỉ gồm chữ thường không dấu, số và dấu gạch ngang')
    .optional(),
  officeName: z.string().trim().min(2).max(100),
  address: z.string().trim().min(5).max(255),
  mapUrl: z.url().optional(),
  phone: z.string().trim().max(20).optional(),
  managerId: objectIdSchema.nullable().optional(),
  openingHours: z.string().trim().max(100).optional(),
  order: z.number().int().min(0).optional(),
  status: z.enum(BRANCH_STATUSES).optional(),
};

export const createBranchSchema = z.object(fields);
export const updateBranchSchema = z.object(fields).partial();
export const listBranchesQuerySchema = listQuerySchema.extend({ status: z.enum(BRANCH_STATUSES).optional() });

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
export type ListBranchesQuery = z.infer<typeof listBranchesQuerySchema>;
