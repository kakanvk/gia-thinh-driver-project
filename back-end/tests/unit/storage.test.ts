import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import { setStorage } from '../../src/shared/storage';
import { GcsStorageDriver, type BucketLike } from '../../src/shared/storage/gcs';
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
    const driver = new GcsStorageDriver(bucket as unknown as BucketLike);
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
    const driver = new GcsStorageDriver(bucket as unknown as BucketLike, 'https://cdn.giathinh.vn/');
    expect((await driver.put('k.webp', Buffer.from(''), 'image/webp')).url).toBe('https://cdn.giathinh.vn/k.webp');
  });
});

describe('GcsStorageDriver — signed URL, stat, move', () => {
  function fakeBucket(overrides: Record<string, unknown> = {}) {
    const file = {
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      getSignedUrl: vi.fn().mockResolvedValue(['https://signed.example/upload']),
      getMetadata: vi.fn().mockResolvedValue([{ size: '1234', contentType: 'video/mp4' }]),
      move: vi.fn().mockResolvedValue(undefined),
      setMetadata: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    };
    const bucket = { name: 'gt-media', file: vi.fn(() => file) };
    return { bucket, file };
  }

  it('createUploadUrl gọi getSignedUrl v4 write với contentType và giới hạn kích thước', async () => {
    const { bucket, file } = fakeBucket();
    const driver = new GcsStorageDriver(bucket);
    const before = Date.now();
    const result = await driver.createUploadUrl('tmp/a.mp4', 'video/mp4', 1000);
    expect(bucket.file).toHaveBeenCalledWith('tmp/a.mp4');
    const cfg = file.getSignedUrl.mock.calls[0]![0];
    expect(cfg).toMatchObject({
      version: 'v4',
      action: 'write',
      contentType: 'video/mp4',
      extensionHeaders: { 'x-goog-content-length-range': '0,1000' },
    });
    expect(cfg.expires).toBeGreaterThanOrEqual(before + 15 * 60_000);
    expect(cfg.expires).toBeLessThanOrEqual(Date.now() + 15 * 60_000);
    expect(result.uploadUrl).toBe('https://signed.example/upload');
    expect(result.headers).toEqual({ 'Content-Type': 'video/mp4', 'x-goog-content-length-range': '0,1000' });
    expect(new Date(result.expiresAt).getTime()).toBe(cfg.expires);
  });

  it('stat trả size dạng số; 404 → null; lỗi khác ném ra', async () => {
    const { bucket } = fakeBucket();
    const driver = new GcsStorageDriver(bucket);
    expect(await driver.stat('tmp/a.mp4')).toEqual({ size: 1234, contentType: 'video/mp4' });

    const notFound = Object.assign(new Error('No such object'), { code: 404 });
    const missing = new GcsStorageDriver(fakeBucket({ getMetadata: vi.fn().mockRejectedValue(notFound) }).bucket);
    expect(await missing.stat('tmp/a.mp4')).toBeNull();

    const broken = new GcsStorageDriver(
      fakeBucket({ getMetadata: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { code: 500 })) }).bucket,
    );
    await expect(broken.stat('tmp/a.mp4')).rejects.toThrow();
  });

  it('move chuyển object, đặt cache dài hạn và trả URL theo baseUrl', async () => {
    const moved = { setMetadata: vi.fn().mockResolvedValue(undefined) };
    const { bucket, file } = fakeBucket();
    bucket.file.mockImplementation(((name: string) => (name === '2026/10/a.mp4' ? moved : file)) as never);
    const driver = new GcsStorageDriver(bucket, 'https://cdn.giathinh.vn');
    const { url } = await driver.move('tmp/a.mp4', '2026/10/a.mp4');
    expect(file.move).toHaveBeenCalledWith('2026/10/a.mp4');
    expect(moved.setMetadata).toHaveBeenCalledWith({ cacheControl: 'public, max-age=31536000, immutable' });
    expect(url).toBe('https://cdn.giathinh.vn/2026/10/a.mp4');
  });

  it('chặn key không an toàn', async () => {
    const driver = new GcsStorageDriver(fakeBucket().bucket);
    await expect(driver.createUploadUrl('../x', 'video/mp4', 10)).rejects.toThrow();
    await expect(driver.stat('../x')).rejects.toThrow();
    await expect(driver.move('tmp/a.mp4', '../x')).rejects.toThrow();
    await expect(driver.move('/abs', '2026/10/a.mp4')).rejects.toThrow();
  });
});

describe('LocalStorageDriver — upload thẳng qua route nội bộ', () => {
  let root: string;
  let driver: LocalStorageDriver;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'gt-direct-'));
    driver = new LocalStorageDriver(root, 'http://api.test/uploads');
    setStorage(driver);
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    setStorage(undefined);
    await rm(root, { recursive: true, force: true });
  });

  function pathOf(uploadUrl: string): string {
    return new URL(uploadUrl).pathname;
  }

  it('PUT đúng Content-Type → 200, stat thấy size; move chuyển file', async () => {
    const { uploadUrl, headers, expiresAt } = await driver.createUploadUrl('tmp/a.mp4', 'video/mp4', 100);
    expect(uploadUrl).toMatch(/^http:\/\/api\.test\/api\/v1\/media\/direct\/[\w-]+\.[\w-]+$/);
    expect(headers).toEqual({ 'Content-Type': 'video/mp4' });
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);
    expect(await driver.stat('tmp/a.mp4')).toBeNull();

    const res = await request(createApp())
      .put(pathOf(uploadUrl))
      .set('Content-Type', 'video/mp4')
      .send(Buffer.from('0123456789'));
    expect(res.status).toBe(200);
    expect(await driver.stat('tmp/a.mp4')).toEqual({ size: 10, contentType: 'video/mp4' });

    const { url } = await driver.move('tmp/a.mp4', '2026/10/a.mp4');
    expect(url).toBe('http://api.test/uploads/2026/10/a.mp4');
    expect(await driver.stat('tmp/a.mp4')).toBeNull();
    expect(await driver.stat('2026/10/a.mp4')).toEqual({ size: 10, contentType: 'video/mp4' });
    expect(await readFile(path.join(root, '2026/10/a.mp4'), 'utf8')).toBe('0123456789');
  });

  it('stat suy contentType từ đuôi file khi không có meta', async () => {
    await driver.put('2026/10/b.webp', Buffer.from('abc'), 'image/webp');
    expect(await driver.stat('2026/10/b.webp')).toEqual({ size: 3, contentType: 'image/webp' });
  });

  it('token bị sửa → 403', async () => {
    const { uploadUrl } = await driver.createUploadUrl('tmp/a.mp4', 'video/mp4', 100);
    const p = pathOf(uploadUrl);
    const token = p.split('/').pop()!;
    const tampered = (token[0] === 'A' ? 'B' : 'A') + token.slice(1);
    const res = await request(createApp())
      .put(p.replace(token, tampered))
      .set('Content-Type', 'video/mp4')
      .send(Buffer.from('x'));
    expect(res.status).toBe(403);
    expect(await driver.stat('tmp/a.mp4')).toBeNull();
  });

  it('chữ ký chứa ký tự nhiều byte (cùng số ký tự) → 403, không 500', async () => {
    const { uploadUrl } = await driver.createUploadUrl('tmp/a.mp4', 'video/mp4', 100);
    const p = pathOf(uploadUrl);
    const token = p.split('/').pop()!;
    const [payload, signature] = token.split('.');
    const tampered = `${payload}.%C3%A9${signature!.slice(1)}`;
    const res = await request(createApp())
      .put(p.replace(token, tampered))
      .set('Content-Type', 'video/mp4')
      .send(Buffer.from('x'));
    expect(res.status).toBe(403);
    expect(await driver.stat('tmp/a.mp4')).toBeNull();
  });

  it('token hết hạn → 401', async () => {
    const { uploadUrl } = await driver.createUploadUrl('tmp/a.mp4', 'video/mp4', 100);
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 16 * 60_000);
    const res = await request(createApp()).put(pathOf(uploadUrl)).set('Content-Type', 'video/mp4').send(Buffer.from('x'));
    expect(res.status).toBe(401);
  });

  it('sai Content-Type → 400', async () => {
    const { uploadUrl } = await driver.createUploadUrl('tmp/a.mp4', 'video/mp4', 100);
    const res = await request(createApp()).put(pathOf(uploadUrl)).set('Content-Type', 'video/webm').send(Buffer.from('x'));
    expect(res.status).toBe(400);
    expect(await driver.stat('tmp/a.mp4')).toBeNull();
  });

  it('vượt maxBytes → 413', async () => {
    const { uploadUrl } = await driver.createUploadUrl('tmp/a.mp4', 'video/mp4', 5);
    const res = await request(createApp())
      .put(pathOf(uploadUrl))
      .set('Content-Type', 'video/mp4')
      .send(Buffer.from('0123456789'));
    expect(res.status).toBe(413);
    expect(await driver.stat('tmp/a.mp4')).toBeNull();
  });
});
