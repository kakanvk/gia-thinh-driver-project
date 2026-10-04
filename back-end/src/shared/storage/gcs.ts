import { assertSafeKey, joinUrl, type StorageDriver } from './types';

export type BucketLike = {
  name: string;
  file(name: string): {
    save(data: Buffer, options: Record<string, unknown>): Promise<unknown>;
    delete(options?: Record<string, unknown>): Promise<unknown>;
  };
};

export class GcsStorageDriver implements StorageDriver {
  constructor(
    private readonly bucket: BucketLike,
    private readonly baseUrl?: string,
  ) {}

  async put(key: string, body: Buffer, contentType: string): Promise<{ url: string }> {
    assertSafeKey(key);
    await this.bucket.file(key).save(body, {
      contentType,
      resumable: false,
      metadata: { cacheControl: 'public, max-age=31536000, immutable' },
    });
    return { url: joinUrl(this.baseUrl ?? `https://storage.googleapis.com/${this.bucket.name}`, key) };
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    await this.bucket.file(key).delete({ ignoreNotFound: true });
  }
}
