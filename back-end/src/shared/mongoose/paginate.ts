import type { FilterQuery, HydratedDocument, Model } from 'mongoose';
import { z } from 'zod';
import type { PageMeta } from '../../utils/response';

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z
    .string()
    .regex(/^-?[a-zA-Z0-9_.]+$/, 'Tham số sort không hợp lệ')
    .optional(),
  q: z.string().trim().min(1).max(100).optional(),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

export async function paginate<T>(
  model: Model<T>,
  filter: FilterQuery<T>,
  query: Pick<ListQuery, 'page' | 'limit' | 'sort'>,
  defaultSort = '-createdAt',
): Promise<{ data: HydratedDocument<T>[]; meta: PageMeta }> {
  const { page, limit } = query;
  const sort = query.sort ?? defaultSort;
  const sortWithTiebreaker = sort.endsWith(' _id') || sort.endsWith(' -_id') ? sort : `${sort} _id`;
  const [data, total] = await Promise.all([
    model
      .find(filter)
      .sort(sortWithTiebreaker)
      .skip((page - 1) * limit)
      .limit(limit),
    model.countDocuments(filter),
  ]);
  return { data, meta: { page, limit, total } };
}
