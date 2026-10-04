import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { assertSafeKey, joinUrl, UPLOAD_URL_TTL_MS, type StorageDriver, type StoredObject, type UploadUrl } from './types';

export type DirectUploadClaims = { key: string; contentType: string; maxBytes: number; exp: number };

const CONTENT_TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

const META_SUFFIX = '.meta.json';

/**
 * Driver lưu file trên đĩa — chỉ dùng cho test và chạy thử offline (ALLOW_LOCAL_STORAGE=true).
 * Upload thẳng: URL trỏ tới route nội bộ `PUT /api/v1/media/direct/:token`, token ký HMAC.
 */
export class LocalStorageDriver implements StorageDriver {
  private readonly apiBase: string;
  private readonly secret: string;

  constructor(
    private readonly root: string,
    private readonly baseUrl: string,
    options: { apiBase?: string; secret?: string } = {},
  ) {
    this.apiBase = options.apiBase ?? new URL(baseUrl).origin;
    this.secret = options.secret ?? env.JWT_ACCESS_SECRET;
  }

  private filePath(key: string): string {
    assertSafeKey(key);
    return path.join(this.root, key);
  }

  async put(key: string, body: Buffer, _contentType?: string): Promise<{ url: string }> {
    const file = this.filePath(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return { url: joinUrl(this.baseUrl, key) };
  }

  async delete(key: string): Promise<void> {
    const file = this.filePath(key);
    await rm(file, { force: true });
    await rm(file + META_SUFFIX, { force: true });
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.secret).update(payload).digest('base64url');
  }

  async createUploadUrl(key: string, contentType: string, maxBytes: number): Promise<UploadUrl> {
    assertSafeKey(key);
    const exp = Date.now() + UPLOAD_URL_TTL_MS;
    const claims: DirectUploadClaims = { key, contentType, maxBytes, exp };
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    return {
      uploadUrl: `${this.apiBase.replace(/\/+$/, '')}/api/v1/media/direct/${payload}.${this.sign(payload)}`,
      headers: { 'Content-Type': contentType },
      expiresAt: new Date(exp).toISOString(),
    };
  }

  /** Kiểm token của route upload thẳng: sai chữ ký → 403, hết hạn → 401. */
  verifyUploadToken(token: string): DirectUploadClaims {
    const [payload, signature, ...rest] = token.split('.');
    // So độ dài theo byte: chữ ký có ký tự nhiều byte sẽ làm timingSafeEqual ném RangeError.
    const actual = Buffer.from(signature ?? '');
    const expected = Buffer.from(payload ? this.sign(payload) : '');
    const valid =
      rest.length === 0 &&
      actual.length > 0 &&
      actual.length === expected.length &&
      timingSafeEqual(actual, expected);
    if (!valid) throw ApiError.forbidden('Liên kết tải lên không hợp lệ');
    let claims: DirectUploadClaims;
    try {
      claims = JSON.parse(Buffer.from(payload!, 'base64url').toString('utf8')) as DirectUploadClaims;
      assertSafeKey(claims.key);
    } catch {
      throw ApiError.forbidden('Liên kết tải lên không hợp lệ');
    }
    if (Date.now() > claims.exp) throw ApiError.unauthorized('Liên kết tải lên đã hết hạn');
    return claims;
  }

  /** Ghi file nhận từ route upload thẳng, kèm contentType trong file `.meta.json`. */
  async writeDirect(key: string, body: Buffer, contentType: string): Promise<void> {
    const file = this.filePath(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    await writeFile(file + META_SUFFIX, JSON.stringify({ contentType }));
  }

  async stat(key: string): Promise<StoredObject | null> {
    const file = this.filePath(key);
    let size: number;
    try {
      size = (await stat(file)).size;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
    let contentType = CONTENT_TYPES[path.extname(key).toLowerCase()] ?? 'application/octet-stream';
    try {
      const meta = JSON.parse(await readFile(file + META_SUFFIX, 'utf8')) as { contentType?: string };
      if (meta.contentType) contentType = meta.contentType;
    } catch {
      // không có meta → suy từ đuôi file
    }
    return { size, contentType };
  }

  async move(fromKey: string, toKey: string): Promise<{ url: string }> {
    const from = this.filePath(fromKey);
    const to = this.filePath(toKey);
    await mkdir(path.dirname(to), { recursive: true });
    await rename(from, to);
    await rename(from + META_SUFFIX, to + META_SUFFIX).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== 'ENOENT') throw err;
    });
    return { url: joinUrl(this.baseUrl, toKey) };
  }
}
