import {
  assertSafeKey,
  IMMUTABLE_CACHE_CONTROL,
  joinUrl,
  UPLOAD_URL_TTL_MS,
  type StorageDriver,
  type StoredObject,
  type UploadUrl,
} from './types';

type FileLike = {
  save(data: Buffer, options: Record<string, unknown>): Promise<unknown>;
  delete(options?: Record<string, unknown>): Promise<unknown>;
  getSignedUrl(config: {
    version: 'v4';
    action: 'write';
    expires: number;
    contentType: string;
    extensionHeaders: Record<string, string>;
  }): Promise<[string]>;
  getMetadata(): Promise<[{ size?: string | number; contentType?: string }, ...unknown[]]>;
  move(destination: string): Promise<unknown>;
  setMetadata(metadata: Record<string, unknown>): Promise<unknown>;
};

export type BucketLike = {
  name: string;
  file(name: string): FileLike;
};

function isNotFound(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 404;
}

export class GcsStorageDriver implements StorageDriver {
  constructor(
    private readonly bucket: BucketLike,
    private readonly baseUrl?: string,
  ) {}

  private publicUrl(key: string): string {
    return joinUrl(this.baseUrl ?? `https://storage.googleapis.com/${this.bucket.name}`, key);
  }

  async put(key: string, body: Buffer, contentType: string): Promise<{ url: string }> {
    assertSafeKey(key);
    await this.bucket.file(key).save(body, {
      contentType,
      resumable: false,
      metadata: { cacheControl: IMMUTABLE_CACHE_CONTROL },
    });
    return { url: this.publicUrl(key) };
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    await this.bucket.file(key).delete({ ignoreNotFound: true });
  }

  async createUploadUrl(key: string, contentType: string, maxBytes: number): Promise<UploadUrl> {
    assertSafeKey(key);
    const expires = Date.now() + UPLOAD_URL_TTL_MS;
    const lengthRange = `0,${maxBytes}`;
    const [uploadUrl] = await this.bucket.file(key).getSignedUrl({
      version: 'v4',
      action: 'write',
      expires,
      contentType,
      extensionHeaders: { 'x-goog-content-length-range': lengthRange },
    });
    return {
      uploadUrl,
      headers: { 'Content-Type': contentType, 'x-goog-content-length-range': lengthRange },
      expiresAt: new Date(expires).toISOString(),
    };
  }

  async stat(key: string): Promise<StoredObject | null> {
    assertSafeKey(key);
    try {
      const [metadata] = await this.bucket.file(key).getMetadata();
      return { size: Number(metadata.size ?? 0), contentType: metadata.contentType ?? '' };
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  async move(fromKey: string, toKey: string): Promise<{ url: string }> {
    assertSafeKey(fromKey);
    assertSafeKey(toKey);
    await this.bucket.file(fromKey).move(toKey);
    await this.bucket.file(toKey).setMetadata({ cacheControl: IMMUTABLE_CACHE_CONTROL });
    return { url: this.publicUrl(toKey) };
  }
}
