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
