import { z } from 'zod';
import { objectIdSchema, slugSchema } from '../../shared/zod';

const fields = {
  name: z.string().trim().min(2).max(100),
  slug: slugSchema.optional(),
  description: z.string().trim().max(500).optional(),
  isAnnouncement: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
};

export const createCategorySchema = z.object(fields);
export const updateCategorySchema = z.object(fields).partial();
export const reorderCategoriesSchema = z.object({ ids: z.array(objectIdSchema).min(1).max(100) });

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
