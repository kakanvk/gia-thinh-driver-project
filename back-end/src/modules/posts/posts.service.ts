import type { FilterQuery } from 'mongoose';
import { paginate } from '../../shared/mongoose/paginate';
import { WITH_DELETED } from '../../shared/mongoose/softDelete';
import { ApiError } from '../../utils/ApiError';
import { escapeRegex } from '../../utils/regex';
import { slugify } from '../../utils/slugify';
import { recordAudit } from '../audit/audit.service';
import { Category } from '../categories/category.model';
import { User } from '../users/user.model';
import { plateToText, readTimeMinutes } from './plate';
import { Post, type IPost, type PostDoc, type PostStatus } from './post.model';
import type { CreatePostInput, ListPostsQuery, PublishPostInput, UpdatePostInput } from './posts.validation';

type Actor = Express.AuthUser;
export type PostAction = 'submit' | 'publish' | 'unpublish' | 'archive' | 'restore';

const TRANSITIONS: Record<PostAction, { from: PostStatus[]; to: PostStatus; label: string }> = {
  submit: { from: ['draft'], to: 'pending', label: 'gửi duyệt' },
  publish: { from: ['draft', 'pending'], to: 'published', label: 'xuất bản' },
  unpublish: { from: ['published'], to: 'draft', label: 'gỡ xuất bản' },
  archive: { from: ['draft', 'pending', 'published'], to: 'archived', label: 'lưu trữ' },
  restore: { from: ['archived'], to: 'draft', label: 'khôi phục' },
};

const EXCERPT_LENGTH = 200;

function summary(post: PostDoc) {
  return {
    title: post.title,
    slug: post.slug,
    status: post.status,
    publishedAt: post.publishedAt,
    categoryId: post.categoryId,
  };
}

function deriveFromContent(content: unknown[]) {
  const contentText = plateToText(content);
  return { contentText, readTimeMinutes: readTimeMinutes(contentText) };
}

function excerptFrom(contentText: string): string {
  const flat = contentText.replace(/\s+/g, ' ').trim();
  return flat.length > EXCERPT_LENGTH ? `${flat.slice(0, EXCERPT_LENGTH).trimEnd()}…` : flat;
}

async function uniqueSlug(base: string): Promise<string> {
  const root = base || 'bai-viet';
  let slug = root;
  for (let n = 2; await Post.exists({ slug, ...WITH_DELETED }); n += 1) slug = `${root}-${n}`;
  return slug;
}

async function assertSlugFree(slug: string, exceptId?: string): Promise<void> {
  const taken = await Post.exists({ slug, ...WITH_DELETED, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
  if (taken) throw ApiError.conflict('Slug bài viết đã tồn tại', [{ path: 'body.slug', message: 'Đã tồn tại' }]);
}

async function assertCategory(categoryId: string): Promise<void> {
  if (!(await Category.exists({ _id: categoryId }))) {
    throw ApiError.badRequest('Chuyên mục không tồn tại', [{ path: 'body.categoryId', message: 'Không tồn tại' }]);
  }
}

export async function listPosts(query: ListPostsQuery) {
  const filter: FilterQuery<IPost> = {};
  if (query.status) filter.status = query.status;
  if (query.categoryId) filter.categoryId = query.categoryId;
  if (query.tag) filter.tags = query.tag;
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ title: pattern }, { excerpt: pattern }];
  }
  const result = await paginate(Post, filter, query, '-updatedAt');
  return {
    ...result,
    data: result.data.map((post) => {
      const json = post.toJSON() as Record<string, unknown>;
      delete json.content;
      delete json.contentText;
      return json;
    }),
  };
}

export async function getPost(id: string): Promise<PostDoc> {
  const post = await Post.findById(id);
  if (!post) throw ApiError.notFound('Không tìm thấy bài viết');
  return post;
}

export async function createPost(actor: Actor, input: CreatePostInput): Promise<PostDoc> {
  await assertCategory(input.categoryId);
  if (input.slug) await assertSlugFree(input.slug);
  const slug = input.slug ?? (await uniqueSlug(slugify(input.title)));
  const derived = deriveFromContent(input.content);
  const authorName = input.authorName ?? (await User.findById(actor.id))?.name ?? 'Ban biên tập';
  const post = await Post.create({
    ...input,
    ...derived,
    slug,
    tags: input.tags ?? [],
    excerpt: input.excerpt ?? excerptFrom(derived.contentText),
    excerptAuto: input.excerpt === undefined,
    authorId: actor.id,
    authorName,
    status: 'draft',
    publishedAt: null,
  });
  await recordAudit({ actorId: actor.id, action: 'post.create', entity: 'post', entityId: post.id, after: summary(post) });
  return post;
}

export async function updatePost(actor: Actor, id: string, input: UpdatePostInput): Promise<PostDoc> {
  const post = await getPost(id);
  if (input.categoryId) await assertCategory(input.categoryId);
  if (input.slug && input.slug !== post.slug) await assertSlugFree(input.slug, id);
  const before = summary(post);
  const derived = input.content ? deriveFromContent(input.content) : null;
  post.set({ ...input, ...derived });
  if (input.excerpt !== undefined) post.excerptAuto = false;
  else if (derived && post.excerptAuto) post.excerpt = excerptFrom(derived.contentText);
  await post.save();
  await recordAudit({
    actorId: actor.id,
    action: 'post.update',
    entity: 'post',
    entityId: id,
    before,
    after: summary(post),
  });
  return post;
}

export async function transitionPost(
  actor: Actor,
  id: string,
  action: PostAction,
  input: PublishPostInput = {},
): Promise<PostDoc> {
  const post = await getPost(id);
  const rule = TRANSITIONS[action];
  if (!rule.from.includes(post.status)) {
    throw ApiError.conflict(`Không thể ${rule.label} bài viết đang ở trạng thái "${post.status}"`);
  }
  const before = summary(post);
  post.status = rule.to;
  if (action === 'publish') {
    const now = new Date();
    post.publishedAt = input.publishedAt ?? (post.publishedAt && post.publishedAt <= now ? post.publishedAt : now);
  }
  await post.save();
  await recordAudit({
    actorId: actor.id,
    action: `post.${action}`,
    entity: 'post',
    entityId: id,
    before,
    after: summary(post),
  });
  return post;
}

export async function duplicatePost(actor: Actor, id: string): Promise<PostDoc> {
  const source = await getPost(id);
  const copy = await Post.create({
    title: `${source.title} (bản sao)`,
    slug: await uniqueSlug(source.slug),
    excerpt: source.excerpt,
    excerptAuto: source.excerptAuto,
    content: source.content,
    contentText: source.contentText,
    readTimeMinutes: source.readTimeMinutes,
    cover: source.cover,
    categoryId: source.categoryId,
    tags: source.tags,
    seo: source.seo,
    authorId: actor.id,
    authorName: source.authorName,
    status: 'draft',
    publishedAt: null,
    views: 0,
  });
  await recordAudit({
    actorId: actor.id,
    action: 'post.duplicate',
    entity: 'post',
    entityId: copy.id,
    after: { ...summary(copy), sourceId: id },
  });
  return copy;
}

export async function removePost(actor: Actor, id: string): Promise<void> {
  const post = await getPost(id);
  const before = summary(post);
  post.deletedAt = new Date();
  await post.save();
  await recordAudit({ actorId: actor.id, action: 'post.delete', entity: 'post', entityId: id, before });
}
