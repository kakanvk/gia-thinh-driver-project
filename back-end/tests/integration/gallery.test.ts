import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { GalleryItem } from '../../src/modules/gallery/gallery.model';
import { Media } from '../../src/modules/media/media.model';
import { setStorage } from '../../src/shared/storage';
import { authHeader, createUser } from '../helpers/factories';
import { MemoryStorage } from '../helpers/memoryStorage';

let storage: MemoryStorage;
beforeEach(() => {
  storage = new MemoryStorage();
  setStorage(storage);
});
afterEach(() => setStorage(undefined));

let seq = 0;
async function makeMedia(kind: 'image' | 'video', uploadedBy: string, extra: Record<string, unknown> = {}) {
  seq += 1;
  const key = `2026/10/m${seq}.${kind === 'image' ? 'webp' : 'mp4'}`;
  return Media.create({
    kind,
    key,
    url: `https://cdn.test/${key}`,
    mimeType: kind === 'image' ? 'image/webp' : 'video/mp4',
    size: 10,
    width: 1280,
    height: 720,
    alt: `Media ${seq}`,
    uploadedBy,
    refs: [],
    ...extra,
  });
}

async function setup() {
  const { user: editor } = await createUser({ role: 'editor' });
  const image = await makeMedia('image', editor.id);
  const video = await makeMedia('video', editor.id, { duration: 12.5 });
  const poster = await makeMedia('image', editor.id);
  return { app: createApp(), editor, image, video, poster };
}

const refsOf = async (id: string) => (await Media.findById(id).lean())!.refs.map((r) => `${r.entity}:${r.entityId}`);

describe('gallery — quyền', () => {
  it('editor và quản lý chi nhánh được dùng; tư vấn viên 403; chưa đăng nhập 401', async () => {
    const { app } = await setup();
    const { user: manager } = await createUser({ role: 'branch_manager' });
    const { user: consultant } = await createUser({ role: 'consultant' });
    expect((await request(app).get('/api/v1/gallery').set(authHeader(manager))).status).toBe(200);
    expect((await request(app).get('/api/v1/gallery').set(authHeader(consultant))).status).toBe(403);
    expect((await request(app).get('/api/v1/gallery')).status).toBe(401);
  });
});

describe('gallery — thêm/sửa/xoá mục', () => {
  it('thêm ảnh và video kèm poster; order tăng dần; trả media + poster', async () => {
    const { app, editor, image, video, poster } = await setup();
    const a = await request(app)
      .post('/api/v1/gallery')
      .set(authHeader(editor))
      .send({ mediaId: image.id, caption: 'Sân tập' });
    expect(a.status).toBe(201);
    expect(a.body.data).toMatchObject({
      mediaId: image.id,
      posterMediaId: null,
      caption: 'Sân tập',
      order: 0,
      visible: true,
      media: { id: image.id, url: image.url, kind: 'image', alt: image.alt, width: 1280, height: 720 },
      poster: null,
    });
    expect(a.body.data.id).toEqual(expect.any(String));
    expect(a.body.data.createdAt).toEqual(expect.any(String));

    const b = await request(app)
      .post('/api/v1/gallery')
      .set(authHeader(editor))
      .send({ mediaId: video.id, posterMediaId: poster.id, visible: false });
    expect(b.status).toBe(201);
    expect(b.body.data).toMatchObject({
      order: 1,
      visible: false,
      caption: null,
      posterMediaId: poster.id,
      media: { kind: 'video', duration: 12.5 },
      poster: { url: poster.url, alt: poster.alt },
    });

    expect(await refsOf(image.id)).toEqual([`gallery:${a.body.data.id}`]);
    expect(await refsOf(video.id)).toEqual([`gallery:${b.body.data.id}`]);
    expect(await refsOf(poster.id)).toEqual([`gallery:${b.body.data.id}`]);

    const list = await request(app).get('/api/v1/gallery').set(authHeader(editor));
    expect(list.status).toBe(200);
    expect(list.body.data.map((item: { id: string }) => item.id)).toEqual([a.body.data.id, b.body.data.id]);
    const videos = await request(app).get('/api/v1/gallery?kind=video').set(authHeader(editor));
    expect(videos.body.data.map((item: { id: string }) => item.id)).toEqual([b.body.data.id]);
    const hidden = await request(app).get('/api/v1/gallery?visible=false').set(authHeader(editor));
    expect(hidden.body.data.map((item: { id: string }) => item.id)).toEqual([b.body.data.id]);
    expect((await request(app).get('/api/v1/gallery?visible=co').set(authHeader(editor))).status).toBe(400);
  });

  it('400 khi media không tồn tại, poster cho mục ảnh, poster là video', async () => {
    const { app, editor, image, video, poster } = await setup();
    const missing = await request(app)
      .post('/api/v1/gallery')
      .set(authHeader(editor))
      .send({ mediaId: '0123456789abcdef01234567' });
    expect(missing.status).toBe(400);
    expect(missing.body.error.details).toEqual([{ path: 'body.mediaId', message: 'Media không tồn tại' }]);

    const posterOnImage = await request(app)
      .post('/api/v1/gallery')
      .set(authHeader(editor))
      .send({ mediaId: image.id, posterMediaId: poster.id });
    expect(posterOnImage.status).toBe(400);
    expect(posterOnImage.body.error.details[0].path).toBe('body.posterMediaId');

    const other = await makeMedia('video', editor.id);
    const videoPoster = await request(app)
      .post('/api/v1/gallery')
      .set(authHeader(editor))
      .send({ mediaId: video.id, posterMediaId: other.id });
    expect(videoPoster.status).toBe(400);
    expect(videoPoster.body.error.details[0].path).toBe('body.posterMediaId');

    const longCaption = await request(app)
      .post('/api/v1/gallery')
      .set(authHeader(editor))
      .send({ mediaId: image.id, caption: 'x'.repeat(301) });
    expect(longCaption.status).toBe(400);
    expect(await refsOf(poster.id)).toEqual([]);
    expect(await refsOf(image.id)).toEqual([]);
  });

  it('PATCH: đổi chú thích, ẩn, gỡ/đặt poster → refs đồng bộ; poster cho mục ảnh → 400', async () => {
    const { app, editor, image, video, poster } = await setup();
    const item = (
      await request(app)
        .post('/api/v1/gallery')
        .set(authHeader(editor))
        .send({ mediaId: video.id, posterMediaId: poster.id, caption: 'Cũ' })
    ).body.data;

    const cleared = await request(app)
      .patch(`/api/v1/gallery/${item.id}`)
      .set(authHeader(editor))
      .send({ posterMediaId: null, caption: null, visible: false });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data).toMatchObject({ posterMediaId: null, poster: null, caption: null, visible: false });
    expect(await refsOf(poster.id)).toEqual([]);
    expect(await refsOf(video.id)).toEqual([`gallery:${item.id}`]);

    const set = await request(app)
      .patch(`/api/v1/gallery/${item.id}`)
      .set(authHeader(editor))
      .send({ posterMediaId: poster.id, caption: 'Mới' });
    expect(set.status).toBe(200);
    expect(set.body.data).toMatchObject({ caption: 'Mới', poster: { url: poster.url } });
    expect(await refsOf(poster.id)).toEqual([`gallery:${item.id}`]);

    const imageItem = (await request(app).post('/api/v1/gallery').set(authHeader(editor)).send({ mediaId: image.id })).body
      .data;
    const bad = await request(app)
      .patch(`/api/v1/gallery/${imageItem.id}`)
      .set(authHeader(editor))
      .send({ posterMediaId: poster.id });
    expect(bad.status).toBe(400);
    expect(
      (await request(app).patch('/api/v1/gallery/0123456789abcdef01234567').set(authHeader(editor)).send({ visible: true }))
        .status,
    ).toBe(404);
  });

  it('xoá media đang trong thư viện → 409 có chú thích; xoá mục → refs gỡ, media xoá được', async () => {
    const { app, editor, video, poster } = await setup();
    const item = (
      await request(app)
        .post('/api/v1/gallery')
        .set(authHeader(editor))
        .send({ mediaId: video.id, posterMediaId: poster.id, caption: 'Buổi học thực hành' })
    ).body.data;

    const inUse = await request(app).delete(`/api/v1/media/${poster.id}`).set(authHeader(editor));
    expect(inUse.status).toBe(409);
    expect(inUse.body.error).toMatchObject({
      code: 'MEDIA_IN_USE',
      details: [{ path: 'refs', message: `gallery:${item.id}:Buổi học thực hành` }],
    });

    expect((await request(app).delete(`/api/v1/gallery/${item.id}`).set(authHeader(editor))).status).toBe(204);
    expect(await refsOf(video.id)).toEqual([]);
    expect(await refsOf(poster.id)).toEqual([]);
    expect(await Media.countDocuments()).toBe(3);
    expect((await request(app).delete(`/api/v1/media/${poster.id}`).set(authHeader(editor))).status).toBe(204);
    expect(storage.callsOf('delete')).toEqual([[poster.key]]);
    expect((await request(app).delete(`/api/v1/gallery/${item.id}`).set(authHeader(editor))).status).toBe(404);
  });
});

describe('gallery — giới hạn số mục', () => {
  it('đủ 500 mục → thêm nữa 400', async () => {
    const { app, editor, image, video } = await setup();
    await GalleryItem.insertMany(
      Array.from({ length: 499 }, (_, order) => ({ mediaId: image.id, order, visible: true, createdBy: editor.id })),
    );
    const add = (mediaId: string) => request(app).post('/api/v1/gallery').set(authHeader(editor)).send({ mediaId });
    expect((await add(video.id)).status).toBe(201);
    expect((await add(image.id)).status).toBe(400);
    expect(await GalleryItem.countDocuments()).toBe(500);
  });

  it('?kind lọc trong truy vấn trước giới hạn: dữ liệu cũ quá 500 mục vẫn thấy video ở cuối', async () => {
    const { app, editor, image, video } = await setup();
    await GalleryItem.insertMany([
      ...Array.from({ length: 500 }, (_, order) => ({ mediaId: image.id, order, visible: true, createdBy: editor.id })),
      { mediaId: video.id, order: 500, visible: true, createdBy: editor.id },
    ]);
    const videos = await request(app).get('/api/v1/gallery?kind=video').set(authHeader(editor));
    expect(videos.body.data.map((item: { mediaId: string }) => item.mediaId)).toEqual([video.id]);
    const pub = await request(app).get('/api/v1/public/gallery?kind=video');
    expect(pub.body.data.map((item: { kind: string }) => item.kind)).toEqual(['video']);
  });
});

describe('gallery — sắp xếp', () => {
  async function threeItems() {
    const ctx = await setup();
    const ids: string[] = [];
    for (const media of [ctx.image, ctx.video, ctx.poster]) {
      const res = await request(ctx.app).post('/api/v1/gallery').set(authHeader(ctx.editor)).send({ mediaId: media.id });
      ids.push(res.body.data.id);
    }
    return { ...ctx, ids };
  }

  it('reorder gán order theo vị trí và trả danh sách mới', async () => {
    const { app, editor, ids } = await threeItems();
    const reversed = [...ids].reverse();
    const res = await request(app).patch('/api/v1/gallery/reorder').set(authHeader(editor)).send({ ids: reversed });
    expect(res.status).toBe(200);
    expect(res.body.data.map((item: { id: string }) => item.id)).toEqual(reversed);
    expect(res.body.data.map((item: { order: number }) => item.order)).toEqual([0, 1, 2]);
    const list = await request(app).get('/api/v1/gallery').set(authHeader(editor));
    expect(list.body.data.map((item: { id: string }) => item.id)).toEqual(reversed);
  });

  it('thiếu id, trùng id, id lạ hoặc rỗng → 400 và không đổi thứ tự', async () => {
    const { app, editor, ids } = await threeItems();
    const send = (body: object) => request(app).patch('/api/v1/gallery/reorder').set(authHeader(editor)).send(body);
    expect((await send({ ids: [ids[1], ids[0]] })).status).toBe(400);
    expect((await send({ ids: [ids[1], ids[0], ids[0]] })).status).toBe(400);
    expect((await send({ ids: [ids[2], ids[1], '0123456789abcdef01234567'] })).status).toBe(400);
    expect((await send({ ids: [] })).status).toBe(400);
    const list = await request(app).get('/api/v1/gallery').set(authHeader(editor));
    expect(list.body.data.map((item: { id: string }) => item.id)).toEqual(ids);
  });
});

describe('GET /public/gallery', () => {
  it('chỉ mục hiện, đúng thứ tự và shape; lọc kind; không cần đăng nhập', async () => {
    const { app, editor, image, video, poster } = await setup();
    const add = (body: Record<string, unknown>) => request(app).post('/api/v1/gallery').set(authHeader(editor)).send(body);
    const a = (await add({ mediaId: image.id, caption: 'Ảnh sân' })).body.data;
    const v = (await add({ mediaId: video.id, posterMediaId: poster.id })).body.data;
    const p = (await add({ mediaId: poster.id })).body.data;
    await request(app)
      .patch('/api/v1/gallery/reorder')
      .set(authHeader(editor))
      .send({ ids: [v.id, p.id, a.id] });
    await request(app).patch(`/api/v1/gallery/${p.id}`).set(authHeader(editor)).send({ visible: false });

    const res = await request(app).get('/api/v1/public/gallery');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      {
        id: v.id,
        kind: 'video',
        url: video.url,
        alt: video.alt,
        caption: null,
        width: 1280,
        height: 720,
        posterUrl: poster.url,
      },
      {
        id: a.id,
        kind: 'image',
        url: image.url,
        alt: image.alt,
        caption: 'Ảnh sân',
        width: 1280,
        height: 720,
        posterUrl: null,
      },
    ]);
    const images = await request(app).get('/api/v1/public/gallery?kind=image');
    expect(images.body.data.map((item: { id: string }) => item.id)).toEqual([a.id]);
    expect((await request(app).get('/api/v1/public/gallery?kind=gif')).status).toBe(400);
  });
});
