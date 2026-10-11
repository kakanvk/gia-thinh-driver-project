import { ApiError } from '../../utils/ApiError';
import { Media } from './media.model';

export type MediaRefEntity = 'post' | 'gallery';

const OBJECT_ID = /^[a-f\d]{24}$/i;

/** Mọi giá trị `mediaId` trong cây nội dung Plate (đệ quy qua `children`), chưa lọc. */
export function collectContentMediaIds(content: unknown): unknown[] {
  const out: unknown[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node !== 'object' || node === null) return;
    const record = node as Record<string, unknown>;
    if ('mediaId' in record && record.mediaId != null) out.push(record.mediaId);
    if (Array.isArray(record.children)) walk(record.children);
  };
  walk(content);
  return out;
}

/** `cover.mediaId` + mọi node có `mediaId` trong nội dung bài viết, đã bỏ trùng. */
export function collectPostMediaIds(post: {
  cover?: { url?: string; alt?: string; mediaId?: unknown } | null;
  content?: unknown;
}): string[] {
  const raw = [post.cover?.mediaId, ...collectContentMediaIds(post.content ?? [])];
  const ids = raw.filter((id) => id != null).map((id) => String(id));
  return [...new Set(ids.filter((id) => OBJECT_ID.test(id)))];
}

/**
 * Đồng bộ nơi dùng media của một thực thể: gỡ `{ entity, entityId }` khỏi media không còn trong danh sách,
 * thêm vào media trong danh sách (bỏ id trùng/không hợp lệ).
 */
export async function syncMediaRefs(entity: MediaRefEntity, entityId: string, mediaIds: string[]): Promise<void> {
  const ids = [...new Set(mediaIds.filter((id) => OBJECT_ID.test(id)))];
  const ref = { entity, entityId };
  await Media.updateMany({ _id: { $nin: ids }, refs: { $elemMatch: ref } }, { $pull: { refs: ref } });
  if (ids.length > 0) await Media.updateMany({ _id: { $in: ids } }, { $addToSet: { refs: ref } });
}

/**
 * Gắn ref cho media **trước** khi lưu thực thể rồi mới lưu: `DELETE /media/:id` chỉ xoá media có `refs` rỗng,
 * nên media đã kiểm tồn tại không thể bị xoá xen giữa lúc kiểm và lúc lưu. Media nào không còn → gỡ phần vừa gắn,
 * 400 và không lưu; `save` lỗi → gỡ phần vừa gắn. Lưu xong thì gỡ ref khỏi media không còn dùng.
 */
export async function withMediaRefs<T>(
  entity: MediaRefEntity,
  entityId: string,
  mediaIds: string[],
  save: () => Promise<T>,
  missingMessage = 'Media không tồn tại trong kho media',
): Promise<T> {
  const ids = [...new Set(mediaIds.filter((id) => OBJECT_ID.test(id)))];
  const ref = { entity, entityId };
  const held = ids.length
    ? new Set(
        (await Media.find({ _id: { $in: ids }, refs: { $elemMatch: ref } }, { _id: 1 }).lean()).map((m) => String(m._id)),
      )
    : new Set<string>();
  const added = ids.filter((id) => !held.has(id));
  const release = async () => {
    if (added.length > 0) await Media.updateMany({ _id: { $in: added } }, { $pull: { refs: ref } });
  };
  if (added.length > 0) {
    const result = await Media.updateMany({ _id: { $in: added } }, { $addToSet: { refs: ref } });
    if (result.matchedCount < added.length) {
      await release();
      throw ApiError.badRequest(missingMessage, [{ path: 'body', message: missingMessage }]);
    }
  }
  let saved: T;
  try {
    saved = await save();
  } catch (err) {
    await release();
    throw err;
  }
  await syncMediaRefs(entity, entityId, ids);
  return saved;
}
