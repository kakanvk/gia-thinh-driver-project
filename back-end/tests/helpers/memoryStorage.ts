import type { StorageDriver } from '../../src/shared/storage';

type Stored = { body: Buffer; contentType: string; size?: number };

/** Driver lưu trong bộ nhớ, ghi lại lời gọi — dùng cho test media. */
export class MemoryStorage implements StorageDriver {
  readonly objects = new Map<string, Stored>();
  readonly calls: { method: string; args: unknown[] }[] = [];

  constructor(private readonly baseUrl = 'https://cdn.test') {}

  private record(method: string, ...args: unknown[]) {
    this.calls.push({ method, args });
  }

  callsOf(method: string): unknown[][] {
    return this.calls.filter((call) => call.method === method).map((call) => call.args);
  }

  /** Giả lập trình duyệt PUT xong lên signed URL; `size` để giả file lớn mà không cấp phát bộ nhớ. */
  seed(key: string, contentType: string, size?: number) {
    this.objects.set(key, { body: Buffer.from('x'), contentType, size });
  }

  async put(key: string, body: Buffer, contentType: string) {
    this.record('put', key, contentType);
    this.objects.set(key, { body, contentType });
    return { url: `${this.baseUrl}/${key}` };
  }

  async delete(key: string) {
    this.record('delete', key);
    this.objects.delete(key);
  }

  async createUploadUrl(key: string, contentType: string, maxBytes: number) {
    this.record('createUploadUrl', key, contentType, maxBytes);
    return {
      uploadUrl: `https://upload.test/${key}?sig=1`,
      headers: { 'Content-Type': contentType, 'x-goog-content-length-range': `0,${maxBytes}` },
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    };
  }

  async stat(key: string) {
    this.record('stat', key);
    const object = this.objects.get(key);
    return object ? { size: object.size ?? object.body.length, contentType: object.contentType } : null;
  }

  async move(fromKey: string, toKey: string) {
    this.record('move', fromKey, toKey);
    const object = this.objects.get(fromKey);
    if (!object) throw new Error(`Không có object ${fromKey}`);
    this.objects.delete(fromKey);
    this.objects.set(toKey, object);
    return { url: `${this.baseUrl}/${toKey}` };
  }
}
