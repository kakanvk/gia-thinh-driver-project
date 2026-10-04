export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<{ url: string }>;
  delete(key: string): Promise<void>;
}

export function assertSafeKey(key: string): void {
  if (!key || key.startsWith('/') || key.split('/').includes('..')) throw new Error(`Storage key không hợp lệ: ${key}`);
}

export function joinUrl(base: string, key: string): string {
  return `${base.replace(/\/+$/, '')}/${key}`;
}
