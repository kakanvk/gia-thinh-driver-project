import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { Media } from '../../src/modules/media/media.model';
import { setStorage } from '../../src/shared/storage';
import { LocalStorageDriver } from '../../src/shared/storage/local';
import { authHeader, createBranch, createUser } from '../helpers/factories';
import { MemoryStorage } from '../helpers/memoryStorage';

let root: string;
let local: LocalStorageDriver;
beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'gt-media-'));
  local = new LocalStorageDriver(root, 'http://api.test/uploads');
  setStorage(local);
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

const MP4_KEY = /^tmp\/[0-9a-f-]{36}\.mp4$/;

describe('upload video thẳng lên kho', () => {
  let storage: MemoryStorage;
  beforeEach(() => {
    storage = new MemoryStorage();
    setStorage(storage);
  });
  afterEach(() => setStorage(local));

  const init = (user: Parameters<typeof authHeader>[0], body: Record<string, unknown>) =>
    request(createApp()).post('/api/v1/media/video-uploads').set(authHeader(user)).send(body);
  const complete = (user: Parameters<typeof authHeader>[0], body: Record<string, unknown>) =>
    request(createApp()).post('/api/v1/media/video-uploads/complete').set(authHeader(user)).send(body);

  it('init: editor nhận signed URL cho key tmp/<uuid>.mp4', async () => {
    const { user } = await createUser({ role: 'editor' });
    const res = await init(user, { filename: 'san-tap.mp4', contentType: 'video/mp4', size: 10_000_000, alt: 'Sân tập' });
    expect(res.status).toBe(201);
    expect(res.body.data.uploadId).toMatch(MP4_KEY);
    expect(res.body.data).toMatchObject({
      uploadUrl: expect.stringContaining('https://upload.test/tmp/'),
      headers: { 'Content-Type': 'video/mp4' },
      maxBytes: 524_288_000,
    });
    expect(typeof res.body.data.expiresAt).toBe('string');
    expect(storage.callsOf('createUploadUrl')).toEqual([[res.body.data.uploadId, 'video/mp4', 524_288_000]]);
  });

  it('init: 400 khi sai loại file hoặc vượt dung lượng; tư vấn viên 403', async () => {
    const { user } = await createUser({ role: 'editor' });
    expect((await init(user, { filename: 'a.mov', contentType: 'video/quicktime', size: 100 })).status).toBe(400);
    const tooBig = await init(user, { filename: 'a.mp4', contentType: 'video/mp4', size: 524_288_001 });
    expect(tooBig.status).toBe(400);
    expect((await init(user, { filename: 'a.mp4', contentType: 'video/mp4', size: 0 })).status).toBe(400);
    const branch = await createBranch();
    const { user: consultant } = await createUser({ role: 'consultant', branchIds: [branch.id] });
    expect((await init(consultant, { filename: 'a.mp4', contentType: 'video/mp4', size: 100 })).status).toBe(403);
    expect(
      (await complete(consultant, { uploadId: `tmp/${'0'.repeat(8)}-0000-0000-0000-${'0'.repeat(12)}.mp4` })).status,
    ).toBe(403);
    expect(storage.callsOf('createUploadUrl')).toHaveLength(0);
  });

  it('complete: chưa PUT xong → 400 UPLOAD_INCOMPLETE, không tạo media', async () => {
    const { user } = await createUser({ role: 'editor' });
    const { body } = await init(user, { filename: 'a.mp4', contentType: 'video/mp4', size: 1000 });
    const res = await complete(user, { uploadId: body.data.uploadId });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'UPLOAD_INCOMPLETE', message: 'Video chưa tải lên xong' });
    expect(await Media.countDocuments()).toBe(0);
  });

  it('complete: uploadId sai dạng (không phải tmp/) → 400', async () => {
    const { user } = await createUser({ role: 'editor' });
    expect((await complete(user, { uploadId: '2026/10/abc.mp4' })).status).toBe(400);
    expect((await complete(user, { uploadId: 'tmp/../x.mp4' })).status).toBe(400);
    expect(storage.callsOf('stat')).toHaveLength(0);
  });

  it('complete: object vượt dung lượng hoặc sai loại → xoá object, 400', async () => {
    const { user } = await createUser({ role: 'editor' });
    const big = (await init(user, { filename: 'a.mp4', contentType: 'video/mp4', size: 1000 })).body.data.uploadId;
    storage.seed(big, 'video/mp4', 524_288_001);
    expect((await complete(user, { uploadId: big })).status).toBe(400);
    const wrong = (await init(user, { filename: 'b.mp4', contentType: 'video/mp4', size: 1000 })).body.data.uploadId;
    storage.seed(wrong, 'text/html');
    expect((await complete(user, { uploadId: wrong })).status).toBe(400);
    expect(storage.callsOf('delete')).toEqual([[big], [wrong]]);
    expect(storage.objects.size).toBe(0);
    expect(await Media.countDocuments()).toBe(0);
  });

  it('complete hợp lệ → move khỏi tmp/ sang khoá tháng, tạo media kind video', async () => {
    const { user } = await createUser({ role: 'editor' });
    const uploadId = (await init(user, { filename: 'a.mp4', contentType: 'video/mp4', size: 2048 })).body.data.uploadId;
    storage.seed(uploadId, 'video/mp4', 2048);
    const res = await complete(user, { uploadId, alt: 'Bài thi sa hình', width: 1280, height: 720, duration: 12.5 });
    expect(res.status).toBe(201);
    const uuid = uploadId.slice('tmp/'.length, -'.mp4'.length);
    expect(res.body.data).toMatchObject({
      kind: 'video',
      mimeType: 'video/mp4',
      size: 2048,
      width: 1280,
      height: 720,
      duration: 12.5,
      alt: 'Bài thi sa hình',
      refsCount: 0,
    });
    expect(res.body.data.key).toMatch(new RegExp(`^\\d{4}/\\d{2}/${uuid}\\.mp4$`));
    expect(res.body.data.url).toBe(`https://cdn.test/${res.body.data.key}`);
    expect(storage.callsOf('move')).toEqual([[uploadId, res.body.data.key]]);
    expect(storage.objects.has(uploadId)).toBe(false);
    // gọi lại complete lần nữa → object tmp đã chuyển đi → 400, không tạo trùng
    expect((await complete(user, { uploadId })).status).toBe(400);
    expect(await Media.countDocuments()).toBe(1);
  });
});

describe('sửa / lọc / xoá media', () => {
  let storage: MemoryStorage;
  beforeEach(() => {
    storage = new MemoryStorage();
    setStorage(storage);
  });
  afterEach(() => setStorage(local));

  async function makeMedia(kind: 'image' | 'video', uploadedBy: string, alt?: string) {
    const ext = kind === 'image' ? 'webp' : 'mp4';
    const key = `2026/10/${kind}-${Math.random().toString(36).slice(2)}.${ext}`;
    storage.seed(key, kind === 'image' ? 'image/webp' : 'video/mp4');
    return Media.create({
      kind,
      key,
      url: `https://cdn.test/${key}`,
      mimeType: kind === 'image' ? 'image/webp' : 'video/mp4',
      size: 10,
      width: 10,
      height: 10,
      alt,
      uploadedBy,
      refs: [],
    });
  }

  it('PATCH alt: đặt và xoá mô tả; tư vấn viên 403; id không tồn tại 404', async () => {
    const { user } = await createUser({ role: 'editor' });
    const media = await makeMedia('image', user.id, 'cũ');
    const app = createApp();
    const res = await request(app).patch(`/api/v1/media/${media.id}`).set(authHeader(user)).send({ alt: '  Sân tập mới ' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: media.id, alt: 'Sân tập mới', kind: 'image', refsCount: 0 });
    const cleared = await request(app).patch(`/api/v1/media/${media.id}`).set(authHeader(user)).send({ alt: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.alt).toBeUndefined();
    expect((await request(app).patch(`/api/v1/media/${media.id}`).set(authHeader(user)).send({})).status).toBe(400);
    const missing = await request(app)
      .patch('/api/v1/media/0123456789abcdef01234567')
      .set(authHeader(user))
      .send({ alt: 'x' });
    expect(missing.status).toBe(404);
    const branch = await createBranch();
    const { user: consultant } = await createUser({ role: 'consultant', branchIds: [branch.id] });
    expect(
      (await request(app).patch(`/api/v1/media/${media.id}`).set(authHeader(consultant)).send({ alt: 'x' })).status,
    ).toBe(403);
  });

  it('GET /media?kind= lọc theo loại; media cũ không có kind coi là ảnh', async () => {
    const { user } = await createUser({ role: 'editor' });
    await makeMedia('image', user.id);
    const video = await makeMedia('video', user.id);
    await Media.collection.insertOne({
      key: '2025/01/old.webp',
      url: 'https://cdn.test/2025/01/old.webp',
      mimeType: 'image/webp',
      size: 1,
      width: 1,
      height: 1,
      uploadedBy: user._id,
      refs: [],
    });
    const app = createApp();
    const videos = await request(app).get('/api/v1/media?kind=video').set(authHeader(user));
    expect(videos.status).toBe(200);
    expect(videos.body.data.map((m: { id: string }) => m.id)).toEqual([video.id]);
    const images = await request(app).get('/api/v1/media?kind=image').set(authHeader(user));
    expect(images.body.data).toHaveLength(2);
    expect(images.body.data.every((m: { kind: string }) => m.kind === 'image')).toBe(true);
    expect((await request(app).get('/api/v1/media?kind=pdf').set(authHeader(user))).status).toBe(400);
  });

  it('DELETE media không dùng → 204, xoá object và bản ghi; tư vấn viên 403', async () => {
    const { user } = await createUser({ role: 'editor' });
    const media = await makeMedia('video', user.id);
    const app = createApp();
    const branch = await createBranch();
    const { user: consultant } = await createUser({ role: 'consultant', branchIds: [branch.id] });
    expect((await request(app).delete(`/api/v1/media/${media.id}`).set(authHeader(consultant))).status).toBe(403);
    const res = await request(app).delete(`/api/v1/media/${media.id}`).set(authHeader(user));
    expect(res.status).toBe(204);
    expect(storage.callsOf('delete')).toEqual([[media.key]]);
    expect(await Media.countDocuments()).toBe(0);
    expect((await request(app).delete(`/api/v1/media/${media.id}`).set(authHeader(user))).status).toBe(404);
  });
});
