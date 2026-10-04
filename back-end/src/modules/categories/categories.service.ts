import { ApiError } from '../../utils/ApiError';
import { slugify } from '../../utils/slugify';
import { recordAudit, snapshot } from '../audit/audit.service';
import { Post } from '../posts/post.model';
import { Category, type CategoryDoc } from './category.model';
import type { CreateCategoryInput, UpdateCategoryInput } from './categories.validation';

type Actor = Express.AuthUser;

export async function listCategories(): Promise<CategoryDoc[]> {
  return Category.find().sort('order name');
}

export async function getCategory(id: string): Promise<CategoryDoc> {
  const category = await Category.findById(id);
  if (!category) throw ApiError.notFound('Không tìm thấy chuyên mục');
  return category;
}

async function assertSlugFree(slug: string, exceptId?: string): Promise<void> {
  if (!slug)
    throw ApiError.badRequest('Không tạo được slug từ tên, hãy nhập slug', [{ path: 'body.slug', message: 'Bắt buộc' }]);
  const taken = await Category.exists({ slug, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
  if (taken) throw ApiError.conflict('Slug chuyên mục đã tồn tại', [{ path: 'body.slug', message: 'Đã tồn tại' }]);
}

export async function createCategory(actor: Actor, input: CreateCategoryInput): Promise<CategoryDoc> {
  const slug = input.slug ?? slugify(input.name);
  await assertSlugFree(slug);
  const category = await Category.create({ ...input, slug });
  await recordAudit({
    actorId: actor.id,
    action: 'category.create',
    entity: 'category',
    entityId: category.id,
    after: snapshot(category),
  });
  return category;
}

export async function updateCategory(actor: Actor, id: string, input: UpdateCategoryInput): Promise<CategoryDoc> {
  const category = await getCategory(id);
  if (input.slug && input.slug !== category.slug) await assertSlugFree(input.slug, id);
  const before = snapshot(category);
  category.set(input);
  await category.save();
  await recordAudit({
    actorId: actor.id,
    action: 'category.update',
    entity: 'category',
    entityId: id,
    before,
    after: snapshot(category),
  });
  return category;
}

export async function removeCategory(actor: Actor, id: string): Promise<void> {
  const category = await getCategory(id);
  if (await Post.exists({ categoryId: id })) {
    throw ApiError.conflict('Chuyên mục còn bài viết, hãy chuyển hoặc xóa bài trước');
  }
  const before = snapshot(category);
  await category.deleteOne();
  await recordAudit({ actorId: actor.id, action: 'category.delete', entity: 'category', entityId: id, before });
}

export async function reorderCategories(actor: Actor, ids: string[]): Promise<void> {
  const unique = [...new Set(ids)];
  if ((await Category.countDocuments({ _id: { $in: unique } })) !== unique.length) {
    throw ApiError.badRequest('Có chuyên mục không tồn tại', [{ path: 'body.ids', message: 'Không tồn tại' }]);
  }
  await Category.bulkWrite(unique.map((id, index) => ({ updateOne: { filter: { _id: id }, update: { order: index } } })));
  await recordAudit({ actorId: actor.id, action: 'category.reorder', entity: 'category', entityId: 'all', after: unique });
}
