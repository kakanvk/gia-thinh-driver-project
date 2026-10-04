import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { setStorage } from '../../src/shared/storage';
import { LocalStorageDriver } from '../../src/shared/storage/local';
import { authHeader, createBranch, createUser } from '../helpers/factories';

let root: string;
beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'gt-media-'));
  setStorage(new LocalStorageDriver(root, 'http://api.test/uploads'));
});
afterAll(async () => {
  setStorage(undefined);
  await rm(root, { recursive: true, force: true });
});

async function bigPng(): Promise<Buffer> {
  return sharp({ create: { width: 3000, height: 1000, channels: 3, background: '#d32f2f' } })
    .png()
    .toBuffer();
}

describe('POST /media', () => {
  it('editor upload: resize ≤1920, chuyển webp, lưu file, trả bản ghi', async () => {
    const { user } = await createUser({ role: 'editor' });
    const res = await request(createApp())
      .post('/api/v1/media')
      .set(authHeader(user))
      .field('alt', 'Sân tập Tân Ngãi')
      .attach('file', await bigPng(), { filename: 'san-tap.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ mimeType: 'image/webp', width: 1920, height: 640, alt: 'Sân tập Tân Ngãi' });
    expect(res.body.data.key).toMatch(/^\d{4}\/\d{2}\/[\w-]+\.webp$/);
    expect(res.body.data.url).toBe(`http://api.test/uploads/${res.body.data.key}`);
    expect(existsSync(path.join(root, res.body.data.key))).toBe(true);
  });

  it('400 khi khai png nhưng nội dung là text', async () => {
    const { user } = await createUser({ role: 'editor' });
    const res = await request(createApp())
      .post('/api/v1/media')
      .set(authHeader(user))
      .attach('file', Buffer.from('khong phai anh'), { filename: 'x.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('400 khi sai định dạng (pdf) hoặc thiếu file', async () => {
    const { user } = await createUser({ role: 'editor' });
    const app = createApp();
    const pdf = await request(app)
      .post('/api/v1/media')
      .set(authHeader(user))
      .attach('file', Buffer.from('%PDF-1.4'), { filename: 'a.pdf', contentType: 'application/pdf' });
    expect(pdf.status).toBe(400);
    expect((await request(app).post('/api/v1/media').set(authHeader(user)).field('alt', 'x')).status).toBe(400);
  });

  it('400 khi vượt 5MB', async () => {
    const { user } = await createUser({ role: 'editor' });
    const res = await request(createApp())
      .post('/api/v1/media')
      .set(authHeader(user))
      .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), { filename: 'big.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('5MB');
  });

  it('consultant chỉ xem, không upload', async () => {
    const branch = await createBranch();
    const { user } = await createUser({ role: 'consultant', branchIds: [branch.id] });
    const app = createApp();
    const upload = await request(app)
      .post('/api/v1/media')
      .set(authHeader(user))
      .attach('file', await bigPng(), { filename: 'a.png', contentType: 'image/png' });
    expect(upload.status).toBe(403);
    expect((await request(app).get('/api/v1/media').set(authHeader(user))).status).toBe(200);
  });
});
