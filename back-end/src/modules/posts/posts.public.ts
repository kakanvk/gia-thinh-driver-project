import type { Request, Response } from 'express';
import type { FilterQuery } from 'mongoose';
import { z } from 'zod';
import { validated } from '../../middlewares/validate.middleware';
import { paginate } from '../../shared/mongoose/paginate';
import { slugSchema } from '../../shared/zod';
import { ApiError } from '../../utils/ApiError';
import { escapeRegex } from '../../utils/regex';
import { sendData, sendList } from '../../utils/response';
import { Category, type CategoryDoc } from '../categories/category.model';
import { Post, type IPost, type PostDoc } from './post.model';

export const publicPostsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  category: slugSchema.optional(),
  q: z.string().trim().min(1).max(100).optional(),
});
export const publicSlugParamsSchema = z.object({ slug: slugSchema });

type PublicPostsQuery = z.infer<typeof publicPostsQuerySchema>;

function visibleFilter(): FilterQuery<IPost> {
  return { status: 'published', publishedAt: { $lte: new Date() } };
}

function publicCategory(category: CategoryDoc | undefined) {
  return category ? { name: category.name, slug: category.slug, isAnnouncement: category.isAnnouncement } : null;
}

function summarize(post: PostDoc, categories: Map<string, CategoryDoc>) {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    cover: post.cover ? { url: post.cover.url, alt: post.cover.alt } : null,
    tags: post.tags,
    authorName: post.authorName,
    publishedAt: post.publishedAt,
    readTimeMinutes: post.readTimeMinutes,
    views: post.views,
    category: publicCategory(categories.get(post.categoryId.toString())),
  };
}

async function categoryMap(): Promise<Map<string, CategoryDoc>> {
  const categories = await Category.find();
  return new Map(categories.map((category) => [category.id, category]));
}

export async function listPublicCategories() {
  const [categories, counts] = await Promise.all([
    Category.find().sort('order name'),
    Post.aggregate<{ _id: unknown; count: number }>([
      { $match: visibleFilter() },
      { $group: { _id: '$categoryId', count: { $sum: 1 } } },
    ]),
  ]);
  const countById = new Map(counts.map((row) => [String(row._id), row.count]));
  return categories.map((category) => ({
    name: category.name,
    slug: category.slug,
    description: category.description ?? null,
    isAnnouncement: category.isAnnouncement,
    postCount: countById.get(category.id) ?? 0,
  }));
}

export async function listPublicPosts(query: PublicPostsQuery) {
  const filter: FilterQuery<IPost> = visibleFilter();
  const categories = await categoryMap();
  if (query.category) {
    const category = [...categories.values()].find((item) => item.slug === query.category);
    if (!category) return { data: [], meta: { page: query.page, limit: query.limit, total: 0 } };
    filter.categoryId = category._id;
  }
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ title: pattern }, { excerpt: pattern }, { contentText: pattern }];
  }
  const result = await paginate(Post, filter, { page: query.page, limit: query.limit, sort: '-publishedAt' });
  return { data: result.data.map((post) => summarize(post, categories)), meta: result.meta };
}

export async function getPublicPost(slug: string) {
  const post = await Post.findOne({ ...visibleFilter(), slug });
  if (!post) throw ApiError.notFound('Không tìm thấy bài viết');
  const categories = await categoryMap();
  return { ...summarize(post, categories), content: post.content };
}

// Lượt xem đếm riêng: GET chi tiết được website gọi khi render/ISR nên không dùng để đếm
export async function recordPublicView(slug: string): Promise<void> {
  const result = await Post.updateOne({ ...visibleFilter(), slug, deletedAt: null }, { $inc: { views: 1 } });
  if (result.matchedCount === 0) throw ApiError.notFound('Không tìm thấy bài viết');
}

export async function listCategories(_req: Request, res: Response): Promise<void> {
  sendData(res, await listPublicCategories());
}

export async function listPosts(req: Request, res: Response): Promise<void> {
  sendList(res, await listPublicPosts(validated<PublicPostsQuery>(req, 'query')));
}

export async function getPost(req: Request, res: Response): Promise<void> {
  sendData(res, await getPublicPost(validated<{ slug: string }>(req, 'params').slug));
}

export async function recordView(req: Request, res: Response): Promise<void> {
  await recordPublicView(validated<{ slug: string }>(req, 'params').slug);
  res.status(204).end();
}
