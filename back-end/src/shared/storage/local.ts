import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertSafeKey, joinUrl, type StorageDriver } from './types';

export class LocalStorageDriver implements StorageDriver {
  constructor(
    private readonly root: string,
    private readonly baseUrl: string,
  ) {}

  async put(key: string, body: Buffer, _contentType?: string): Promise<{ url: string }> {
    assertSafeKey(key);
    const file = path.join(this.root, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return { url: joinUrl(this.baseUrl, key) };
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    await rm(path.join(this.root, key), { force: true });
  }
}
