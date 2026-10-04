export type UploadUrl = { uploadUrl: string; headers: Record<string, string>; expiresAt: string };

export type StoredObject = { size: number; contentType: string };

export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<{ url: string }>;
  delete(key: string): Promise<void>;
  /** URL ký sẵn để trình duyệt PUT thẳng file lên (hết hạn sau UPLOAD_URL_TTL_MS). */
  createUploadUrl(key: string, contentType: string, maxBytes: number): Promise<UploadUrl>;
  stat(key: string): Promise<StoredObject | null>;
  move(fromKey: string, toKey: string): Promise<{ url: string }>;
}

export const UPLOAD_URL_TTL_MS = 15 * 60_000;

export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export function assertSafeKey(key: string): void {
  if (!key || key.startsWith('/') || key.split('/').includes('..')) throw new Error(`Storage key không hợp lệ: ${key}`);
}

export function joinUrl(base: string, key: string): string {
  return `${base.replace(/\/+$/, '')}/${key}`;
}
