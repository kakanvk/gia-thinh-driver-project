import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { GcsStorageDriver } from '../../src/shared/storage/gcs';
import { LocalStorageDriver } from '../../src/shared/storage/local';

describe('LocalStorageDriver', () => {
  it('ghi file theo key và trả URL; delete xóa file; chặn key có ..', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'gt-'));
    const driver = new LocalStorageDriver(root, 'http://api.test/uploads/');
    const { url } = await driver.put('2026/10/a.webp', Buffer.from('xin chao'), 'image/webp');
    expect(url).toBe('http://api.test/uploads/2026/10/a.webp');
    expect(await readFile(path.join(root, '2026/10/a.webp'), 'utf8')).toBe('xin chao');
    await driver.delete('2026/10/a.webp');
    await expect(readFile(path.join(root, '2026/10/a.webp'))).rejects.toThrow();
    await expect(driver.put('../x.webp', Buffer.from(''), 'image/webp')).rejects.toThrow();
    await rm(root, { recursive: true, force: true });
  });
});

describe('GcsStorageDriver', () => {
  it('gọi bucket.file(key).save với cache dài hạn và trả URL công khai', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const del = vi.fn().mockResolvedValue(undefined);
    const bucket = { name: 'gt-media', file: vi.fn(() => ({ save, delete: del })) };
    const driver = new GcsStorageDriver(bucket);
    const { url } = await driver.put('2026/10/a.webp', Buffer.from('x'), 'image/webp');
    expect(url).toBe('https://storage.googleapis.com/gt-media/2026/10/a.webp');
    expect(save).toHaveBeenCalledWith(
      Buffer.from('x'),
      expect.objectContaining({ contentType: 'image/webp', resumable: false }),
    );
    await driver.delete('2026/10/a.webp');
    expect(del).toHaveBeenCalledWith({ ignoreNotFound: true });
  });

  it('dùng baseUrl tùy chỉnh (CDN) khi có', async () => {
    const bucket = { name: 'b', file: () => ({ save: async () => undefined, delete: async () => undefined }) };
    const driver = new GcsStorageDriver(bucket, 'https://cdn.giathinh.vn/');
    expect((await driver.put('k.webp', Buffer.from(''), 'image/webp')).url).toBe('https://cdn.giathinh.vn/k.webp');
  });
});
