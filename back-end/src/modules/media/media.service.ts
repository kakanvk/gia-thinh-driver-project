import { randomUUID } from 'node:crypto';
import type { FilterQuery } from 'mongoose';
import sharp from 'sharp';
import { z } from 'zod';
import { listQuerySchema, paginate, type ListQuery } from '../../shared/mongoose/paginate';
import { getStorage } from '../../shared/storage';
import { vnYearMonthPath } from '../../shared/time';
import { ApiError } from '../../utils/ApiError';
import { escapeRegex } from '../../utils/regex';
import { Media, type IMedia } from './media.model';

export const uploadBodySchema = z.object({ alt: z.string().trim().max(255).optional() });
export const listMediaQuerySchema = listQuerySchema;

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

export async function listMedia(query: ListQuery) {
  const filter: FilterQuery<IMedia> = {};
  if (query.q) filter.alt = new RegExp(escapeRegex(query.q), 'i');
  return paginate(Media, filter, query);
}
