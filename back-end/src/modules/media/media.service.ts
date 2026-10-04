import { randomUUID } from 'node:crypto';
import type { FilterQuery } from 'mongoose';
import sharp from 'sharp';
import { z } from 'zod';
import { env } from '../../config/env';
import { listQuerySchema, paginate } from '../../shared/mongoose/paginate';
import { WITH_DELETED } from '../../shared/mongoose/softDelete';
import { getStorage } from '../../shared/storage';
import { vnYearMonthPath } from '../../shared/time';
import { ApiError, type ErrorDetail } from '../../utils/ApiError';
import { escapeRegex } from '../../utils/regex';
import { Post } from '../posts/post.model';
import { Media, MEDIA_KINDS, type IMedia } from './media.model';

const VIDEO_TYPES = { 'video/mp4': 'mp4', 'video/webm': 'webm' } as const;
type VideoType = keyof typeof VIDEO_TYPES;
const VIDEO_UPLOAD_ID = /^tmp\/[0-9a-f-]{36}\.(mp4|webm)$/;

const altSchema = z.string().trim().max(255);

export const uploadBodySchema = z.object({ alt: altSchema.optional() });
export const listMediaQuerySchema = listQuerySchema.extend({ kind: z.enum(MEDIA_KINDS).optional() });
export const videoUploadBodySchema = z.object({
  filename: z.string().trim().min(1).max(200),
  contentType: z.enum(Object.keys(VIDEO_TYPES) as [VideoType, ...VideoType[]], {
    message: 'Chỉ nhận video MP4 hoặc WebM',
  }),
  size: z
    .number()
    .int()
    .positive()
    .refine((size) => size <= env.MAX_VIDEO_BYTES, {
      message: `Video tối đa ${Math.floor(env.MAX_VIDEO_BYTES / 1024 / 1024)}MB`,
    }),
  alt: altSchema.optional(),
});
export const completeVideoBodySchema = z.object({
  uploadId: z.string().regex(VIDEO_UPLOAD_ID, 'uploadId không hợp lệ'),
  alt: altSchema.optional(),
  width: z.number().int().positive().max(100_000).optional(),
  height: z.number().int().positive().max(100_000).optional(),
  duration: z.number().nonnegative().max(1_000_000).optional(),
});
export const updateMediaBodySchema = z.object({ alt: altSchema.nullable() });

export type ListMediaQuery = z.infer<typeof listMediaQuerySchema>;
export type VideoUploadInput = z.infer<typeof videoUploadBodySchema>;
export type CompleteVideoInput = z.infer<typeof completeVideoBodySchema>;
export type UpdateMediaInput = z.infer<typeof updateMediaBodySchema>;

async function toWebp(buffer: Buffer) {
  try {
    return await sharp(buffer)
      .rotate()
      .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw ApiError.badRequest('File không phải ảnh hợp lệ');
  }
}

export async function uploadMedia(file: Express.Multer.File | undefined, alt: string | undefined, actorId: string) {
  if (!file) throw ApiError.badRequest('Thiếu file ảnh (trường "file")', [{ path: 'body.file', message: 'Bắt buộc' }]);
  const { data, info } = await toWebp(file.buffer);
  const key = `${vnYearMonthPath(new Date())}/${randomUUID()}.webp`;
  const { url } = await getStorage().put(key, data, 'image/webp');
  return Media.create({
    key,
    url,
    mimeType: 'image/webp',
    size: info.size,
    width: info.width,
    height: info.height,
    alt,
    uploadedBy: actorId,
    refs: [],
  });
}

export async function listMedia(query: ListMediaQuery) {
  const filter: FilterQuery<IMedia> = {};
  if (query.q) filter.alt = new RegExp(escapeRegex(query.q), 'i');
  // Media cũ không có `kind` được coi là ảnh
  if (query.kind) filter.kind = query.kind === 'image' ? { $ne: 'video' } : 'video';
  return paginate(Media, filter, query);
}

export async function createVideoUpload(input: VideoUploadInput) {
  const key = `tmp/${randomUUID()}.${VIDEO_TYPES[input.contentType]}`;
  const maxBytes = env.MAX_VIDEO_BYTES;
  const signed = await getStorage().createUploadUrl(key, input.contentType, maxBytes);
  return { uploadId: key, ...signed, maxBytes };
}

export async function completeVideoUpload(input: CompleteVideoInput, actorId: string) {
  const storage = getStorage();
  const tmpKey = input.uploadId;
  const ext = tmpKey.slice(tmpKey.lastIndexOf('.') + 1);
  const expectedType = ext === 'webm' ? 'video/webm' : 'video/mp4';
  const object = await storage.stat(tmpKey);
  if (!object) throw new ApiError(400, 'UPLOAD_INCOMPLETE', 'Video chưa tải lên xong');
  const contentType = object.contentType.split(';')[0]!.trim().toLowerCase();
  if (contentType !== expectedType || object.size <= 0 || object.size > env.MAX_VIDEO_BYTES) {
    await storage.delete(tmpKey);
    throw ApiError.badRequest(
      object.size > env.MAX_VIDEO_BYTES
        ? `Video tối đa ${Math.floor(env.MAX_VIDEO_BYTES / 1024 / 1024)}MB`
        : 'File tải lên không phải video MP4/WebM hợp lệ',
      [{ path: 'body.uploadId', message: 'File không hợp lệ' }],
    );
  }
  const key = `${vnYearMonthPath(new Date())}/${tmpKey.slice('tmp/'.length)}`;
  const { url } = await storage.move(tmpKey, key);
  return Media.create({
    kind: 'video',
    key,
    url,
    mimeType: expectedType,
    size: object.size,
    width: input.width,
    height: input.height,
    duration: input.duration,
    alt: input.alt,
    uploadedBy: actorId,
    refs: [],
  });
}

async function findMedia(id: string) {
  const media = await Media.findById(id);
  if (!media) throw ApiError.notFound('Không tìm thấy media');
  return media;
}

export async function updateMedia(id: string, input: UpdateMediaInput) {
  const media = await findMedia(id);
  media.alt = input.alt || undefined;
  await media.save();
  return media;
}

async function refLabels(refs: IMedia['refs']): Promise<ErrorDetail[]> {
  const postIds = refs.filter((ref) => ref.entity === 'post').map((ref) => ref.entityId);
  const posts = postIds.length ? await Post.find({ _id: { $in: postIds }, ...WITH_DELETED }, { title: 1 }).lean() : [];
  const titles = new Map(posts.map((post) => [String(post._id), post.title]));
  return refs.map((ref) => {
    const label = ref.entity === 'post' ? (titles.get(ref.entityId) ?? '') : '';
    return { path: 'refs', message: `${ref.entity}:${ref.entityId}:${label}` };
  });
}

export async function deleteMedia(id: string): Promise<void> {
  // Xoá có điều kiện refs rỗng để không xoá nhầm media vừa được bài viết/thư viện gắn vào
  const deleted = await Media.findOneAndDelete({
    _id: id,
    $or: [{ refs: { $size: 0 } }, { refs: { $exists: false } }],
  });
  if (!deleted) {
    const media = await findMedia(id);
    throw new ApiError(409, 'MEDIA_IN_USE', 'Media đang được dùng', await refLabels(media.refs));
  }
  await getStorage().delete(deleted.key);
}
