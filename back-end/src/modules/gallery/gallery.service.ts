import type { FilterQuery, Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError';
import { recordAudit, snapshot } from '../audit/audit.service';
import { Media, type IMedia, type MediaKind } from '../media/media.model';
import { syncMediaRefs, withMediaRefs } from '../media/media.refs';
import { GalleryItem, type GalleryItemDoc, type IGalleryItem } from './gallery.model';
import {
  MAX_GALLERY_ITEMS,
  type CreateGalleryItemInput,
  type ListGalleryQuery,
  type PublicGalleryQuery,
  type UpdateGalleryItemInput,
} from './gallery.validation';

type Actor = Express.AuthUser;
type MediaLean = IMedia & { _id: Types.ObjectId };
type MediaMap = Map<string, MediaLean>;

const kindOf = (media: MediaLean): MediaKind => media.kind ?? 'image';

async function loadMedia(ids: (Types.ObjectId | string | null | undefined)[]): Promise<MediaMap> {
  const unique = [...new Set(ids.filter((id) => id != null).map(String))];
  if (unique.length === 0) return new Map();
  const media = await Media.find({ _id: { $in: unique } }).lean<MediaLean[]>();
  return new Map(media.map((item) => [String(item._id), item]));
}

function present(item: GalleryItemDoc, media: MediaMap) {
  const main = media.get(String(item.mediaId));
  const poster = item.posterMediaId ? media.get(String(item.posterMediaId)) : undefined;
  return {
    id: item.id as string,
    mediaId: String(item.mediaId),
    posterMediaId: item.posterMediaId ? String(item.posterMediaId) : null,
    caption: item.caption ?? null,
    order: item.order,
    visible: item.visible,
    media: main
      ? {
          id: String(main._id),
          url: main.url,
          kind: kindOf(main),
          alt: main.alt ?? null,
          width: main.width ?? null,
          height: main.height ?? null,
          duration: main.duration ?? null,
        }
      : null,
    poster: poster ? { url: poster.url, alt: poster.alt ?? null } : null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

async function presentMany(items: GalleryItemDoc[]) {
  const media = await loadMedia(items.flatMap((item) => [item.mediaId, item.posterMediaId]));
  return items.map((item) => present(item, media));
}

const sorted = (filter: FilterQuery<IGalleryItem> = {}) =>
  GalleryItem.find(filter).sort({ order: 1, createdAt: 1 }).limit(MAX_GALLERY_ITEMS);

/** Lọc loại trong truy vấn (trước `limit`), không lọc sau khi đã cắt danh sách. */
async function kindFilter(kind: MediaKind | undefined): Promise<FilterQuery<IGalleryItem>> {
  if (!kind) return {};
  const used = await GalleryItem.distinct('mediaId');
  const ids = await Media.distinct('_id', { _id: { $in: used }, kind: kind === 'image' ? { $ne: 'video' } : 'video' });
  return { mediaId: { $in: ids } };
}

export async function listGallery(query: ListGalleryQuery) {
  const filter: FilterQuery<IGalleryItem> = await kindFilter(query.kind);
  if (query.visible) filter.visible = query.visible === 'true';
  return presentMany(await sorted(filter));
}

async function findItem(id: string): Promise<GalleryItemDoc> {
  const item = await GalleryItem.findById(id);
  if (!item) throw ApiError.notFound('Không tìm thấy mục thư viện');
  return item;
}

/** Media chính phải tồn tại; ảnh bìa chỉ cho mục video và phải là ảnh. */
async function assertMedia(mediaId: string, posterMediaId: string | null | undefined): Promise<void> {
  const media = await loadMedia([mediaId, posterMediaId]);
  const main = media.get(mediaId);
  if (!main) throw ApiError.badRequest('Media không tồn tại', [{ path: 'body.mediaId', message: 'Media không tồn tại' }]);
  if (!posterMediaId) return;
  if (kindOf(main) !== 'video') {
    throw ApiError.badRequest('Chỉ mục video mới có ảnh bìa', [
      { path: 'body.posterMediaId', message: 'Chỉ mục video mới có ảnh bìa' },
    ]);
  }
  const poster = media.get(posterMediaId);
  if (!poster || kindOf(poster) !== 'image') {
    throw ApiError.badRequest('Ảnh bìa phải là ảnh trong kho media', [
      { path: 'body.posterMediaId', message: 'Ảnh bìa phải là ảnh trong kho media' },
    ]);
  }
}

const refIds = (item: GalleryItemDoc) => [item.mediaId, item.posterMediaId].filter((id) => id != null).map(String);

export async function getGalleryItem(id: string) {
  const [item] = await presentMany([await findItem(id)]);
  return item!;
}

export async function createGalleryItem(actor: Actor, input: CreateGalleryItemInput) {
  // Danh sách/sắp xếp chỉ xử lý tối đa MAX_GALLERY_ITEMS mục: mục vượt quá sẽ không bao giờ hiện
  if ((await GalleryItem.countDocuments()) >= MAX_GALLERY_ITEMS) {
    throw ApiError.badRequest(`Thư viện tối đa ${MAX_GALLERY_ITEMS} mục, hãy xoá bớt mục cũ`);
  }
  await assertMedia(input.mediaId, input.posterMediaId);
  const last = await GalleryItem.findOne().sort({ order: -1 }).select({ order: 1 }).lean();
  const item = new GalleryItem({
    mediaId: input.mediaId,
    posterMediaId: input.posterMediaId ?? null,
    caption: input.caption || null,
    visible: input.visible ?? true,
    order: last ? last.order + 1 : 0,
    createdBy: actor.id,
  });
  await withMediaRefs('gallery', item.id, refIds(item), () => item.save());
  await recordAudit({
    actorId: actor.id,
    action: 'gallery.create',
    entity: 'gallery',
    entityId: item.id,
    after: snapshot(item),
  });
  return getGalleryItem(item.id);
}

export async function updateGalleryItem(actor: Actor, id: string, input: UpdateGalleryItemInput) {
  const item = await findItem(id);
  const before = snapshot(item);
  if (input.posterMediaId !== undefined) {
    if (input.posterMediaId) await assertMedia(String(item.mediaId), input.posterMediaId);
    item.set('posterMediaId', input.posterMediaId);
  }
  if (input.caption !== undefined) item.caption = input.caption || null;
  if (input.visible !== undefined) item.visible = input.visible;
  await withMediaRefs('gallery', item.id, refIds(item), () => item.save());
  await recordAudit({
    actorId: actor.id,
    action: 'gallery.update',
    entity: 'gallery',
    entityId: id,
    before,
    after: snapshot(item),
  });
  return getGalleryItem(id);
}

export async function removeGalleryItem(actor: Actor, id: string): Promise<void> {
  const item = await findItem(id);
  const before = snapshot(item);
  await item.deleteOne();
  await syncMediaRefs('gallery', id, []);
  await recordAudit({ actorId: actor.id, action: 'gallery.delete', entity: 'gallery', entityId: id, before });
}

export async function reorderGallery(actor: Actor, ids: string[]) {
  const unique = new Set(ids);
  const existing = await GalleryItem.find().select({ _id: 1 }).lean();
  const complete = unique.size === ids.length && existing.length === ids.length;
  if (!complete || existing.some((item) => !unique.has(String(item._id)))) {
    throw ApiError.badRequest('Danh sách sắp xếp phải gồm đủ mọi mục thư viện, không trùng', [
      { path: 'body.ids', message: 'Phải gồm đủ mọi mục, không trùng' },
    ]);
  }
  await GalleryItem.bulkWrite(ids.map((id, index) => ({ updateOne: { filter: { _id: id }, update: { order: index } } })));
  await recordAudit({ actorId: actor.id, action: 'gallery.reorder', entity: 'gallery', entityId: 'all', after: ids });
  return presentMany(await sorted());
}

export async function listPublicGallery(query: PublicGalleryQuery) {
  const items = await sorted({ ...(await kindFilter(query.kind)), visible: true });
  const media = await loadMedia(items.flatMap((item) => [item.mediaId, item.posterMediaId]));
  return items.flatMap((item) => {
    const main = media.get(String(item.mediaId));
    if (!main) return [];
    const poster = item.posterMediaId ? media.get(String(item.posterMediaId)) : undefined;
    return [
      {
        id: item.id as string,
        kind: kindOf(main),
        url: main.url,
        alt: main.alt ?? '',
        caption: item.caption ?? null,
        width: main.width ?? null,
        height: main.height ?? null,
        posterUrl: poster?.url ?? null,
      },
    ];
  });
}
