import { z } from 'zod';
import { listQuerySchema } from '../../shared/mongoose/paginate';
import { imageInputSchema, objectIdSchema, slugSchema, zDateTime } from '../../shared/zod';
import { plateContentSchema } from './plate';
import { POST_STATUSES } from './post.model';

const tagsSchema = z
  .array(z.string().trim().toLowerCase().min(1).max(30))
  .max(20)
  .transform((tags) => [...new Set(tags)]);

const fields = {
  title: z.string().trim().min(5).max(200),
  slug: slugSchema.optional(),
  excerpt: z.string().trim().max(500).optional(),
  content: plateContentSchema,
  categoryId: objectIdSchema,
  tags: tagsSchema.optional(),
  cover: imageInputSchema.nullable().optional(),
  authorName: z.string().trim().min(2).max(100).optional(),
  seo: z
    .object({ title: z.string().trim().max(70).optional(), description: z.string().trim().max(160).optional() })
    .nullable()
    .optional(),
};

export const createPostSchema = z.object(fields);
export const updatePostSchema = z.object(fields).partial();
export const publishPostSchema = z.object({ publishedAt: zDateTime.optional() });
export const listPostsQuerySchema = listQuerySchema.extend({
  status: z.enum(POST_STATUSES).optional(),
  categoryId: objectIdSchema.optional(),
  tag: z.string().trim().toLowerCase().max(30).optional(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type PublishPostInput = z.infer<typeof publishPostSchema>;
export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>;
