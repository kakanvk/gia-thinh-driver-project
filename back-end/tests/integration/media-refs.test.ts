import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { collectPostMediaIds, syncMediaRefs } from '../../src/modules/media/media.refs';
import { Media } from '../../src/modules/media/media.model';
import { setStorage } from '../../src/shared/storage';
import { authHeader, createCategory, createUser } from '../helpers/factories';
import { MemoryStorage } from '../helpers/memoryStorage';

let storage: MemoryStorage;
beforeEach(() => {
  storage = new MemoryStorage();
  setStorage(storage);
});
afterEach(() => setStorage(undefined));

async function makeMedia(kind: 'image' | 'video', uploadedBy: string) {
  const key = `2026/10/${Math.random().toString(36).slice(2)}.${kind === 'image' ? 'webp' : 'mp4'}`;
  return Media.create({
    kind,
    key,
    url: `https://cdn.test/${key}`,
    mimeType: kind === 'image' ? 'image/webp' : 'video/mp4',
    size: 10,
    width: 10,
    height: 10,
    uploadedBy,
    refs: [],
  });
}

const imgNode = (url: string, mediaId?: string) => ({
  type: 'img',
  url,
  ...(mediaId ? { mediaId } : {}),
  caption: [{ text: 'Chú thích' }],
  children: [{ text: '' }],
});

async function setup() {
  const category = await createCategory({ name: 'Kinh nghiệm thi', slug: 'kinh-nghiem-thi' });
  const { user: editor } = await createUser({ role: 'editor' });
  const a = await makeMedia('image', editor.id);
  const b = await makeMedia('image', editor.id);
  const post = (extra: Record<string, unknown> = {}) => ({
    title: 'Bài có ảnh từ kho media',
    categoryId: category.id,
    cover: { url: a.url, alt: 'Bìa', mediaId: a.id },
    content: [
      { type: 'p', children: [{ text: 'Mở đầu' }] },
      { type: 'blockquote', children: [imgNode(b.url, b.id)] },
    ],
    ...extra,
  });
  return { app: createApp(), editor, a, b, post };
}

const refsOf = async (id: string) => (await Media.findById(id).lean())!.refs.map((r) => `${r.entity}:${r.entityId}`);

describe('collectPostMediaIds', () => {
  it('lấy cover.mediaId và mọi node có mediaId (đệ quy), bỏ trùng', () => {
    const ids = collectPostMediaIds({
      cover: { url: '/a', alt: '', mediaId: 'aaaaaaaaaaaaaaaaaaaaaaaa' },
      content: [
        { type: 'p', children: [{ text: 'x' }] },
        { type: 'ul', children: [{ type: 'li', children: [imgNode('/b', 'bbbbbbbbbbbbbbbbbbbbbbbb')] }] },
        imgNode('/a', 'aaaaaaaaaaaaaaaaaaaaaaaa'),
        imgNode('/c'),
      ],
    });
    expect(ids.sort()).toEqual(['aaaaaaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbbbbbb']);
    expect(collectPostMediaIds({ cover: null, content: [] })).toEqual([]);
  });
});

describe('syncMediaRefs', () => {
  it('thêm ref cho media trong danh sách, gỡ khỏi media không còn; bỏ id sai/trùng', async () => {
    const { user } = await createUser({ role: 'editor' });
    const a = await makeMedia('image', user.id);
    const b = await makeMedia('image', user.id);
    await syncMediaRefs('post', 'p1', [a.id, a.id, 'khong-hop-le']);
    await syncMediaRefs('gallery', 'g1', [a.id]);
    expect(await refsOf(a.id)).toEqual(['post:p1', 'gallery:g1']);
    await syncMediaRefs('post', 'p1', [b.id]);
    expect(await refsOf(a.id)).toEqual(['gallery:g1']);
    expect(await refsOf(b.id)).toEqual(['post:p1']);
    await syncMediaRefs('post', 'p1', []);
    expect(await refsOf(b.id)).toEqual([]);
  });
});

describe('media được bài viết dùng', () => {
  it('tạo bài: cover + ảnh nội dung có ref; xoá media đang dùng → 409 liệt kê bài', async () => {
    const { app, editor, a, b, post } = await setup();
    const created = await request(app).post('/api/v1/posts').set(authHeader(editor)).send(post());
    expect(created.status).toBe(201);
    const postId = created.body.data.id;
    expect(await refsOf(a.id)).toEqual([`post:${postId}`]);
    expect(await refsOf(b.id)).toEqual([`post:${postId}`]);

    const del = await request(app).delete(`/api/v1/media/${a.id}`).set(authHeader(editor));
    expect(del.status).toBe(409);
    expect(del.body.error).toMatchObject({
      code: 'MEDIA_IN_USE',
      message: 'Media đang được dùng',
      details: [{ path: 'refs', message: `post:${postId}:Bài có ảnh từ kho media` }],
    });
    expect(storage.callsOf('delete')).toHaveLength(0);
    expect(await Media.countDocuments()).toBe(2);

    const list = await request(app).get('/api/v1/media').set(authHeader(editor));
    expect(list.body.data.every((m: { refsCount: number }) => m.refsCount === 1)).toBe(true);
  });

  it('sửa bài bỏ cover và ảnh nội dung → refs rỗng → xoá được, storage.delete đúng key', async () => {
    const { app, editor, a, b, post } = await setup();
    const postId = (await request(app).post('/api/v1/posts').set(authHeader(editor)).send(post())).body.data.id;
    const patch = await request(app)
      .patch(`/api/v1/posts/${postId}`)
      .set(authHeader(editor))
      .send({ cover: null, content: [{ type: 'p', children: [{ text: 'Không còn ảnh' }] }] });
    expect(patch.status).toBe(200);
    expect(await refsOf(a.id)).toEqual([]);
    expect(await refsOf(b.id)).toEqual([]);
    const del = await request(app).delete(`/api/v1/media/${a.id}`).set(authHeader(editor));
    expect(del.status).toBe(204);
    expect(storage.callsOf('delete')).toEqual([[a.key]]);
  });

  it('đổi ảnh bìa A → B: A hết ref, B vẫn còn (từ nội dung)', async () => {
    const { app, editor, a, b, post } = await setup();
    const postId = (await request(app).post('/api/v1/posts').set(authHeader(editor)).send(post())).body.data.id;
    const patch = await request(app)
      .patch(`/api/v1/posts/${postId}`)
      .set(authHeader(editor))
      .send({ cover: { url: b.url, alt: 'Bìa mới', mediaId: b.id } });
    expect(patch.status).toBe(200);
    expect(await refsOf(a.id)).toEqual([]);
    expect(await refsOf(b.id)).toEqual([`post:${postId}`]);
  });

  it('400 khi mediaId trong nội dung không tồn tại hoặc trỏ tới video; cover mediaId sai → 400', async () => {
    const { app, editor, a, post } = await setup();
    const video = await makeMedia('video', editor.id);
    const missing = await request(app)
      .post('/api/v1/posts')
      .set(authHeader(editor))
      .send(post({ content: [imgNode('https://cdn.test/x.webp', '0123456789abcdef01234567')] }));
    expect(missing.status).toBe(400);
    expect(missing.body.error.details).toEqual([{ path: 'body.content', message: 'Ảnh không tồn tại trong kho media' }]);
    const notObjectId = await request(app)
      .post('/api/v1/posts')
      .set(authHeader(editor))
      .send(post({ content: [imgNode('https://cdn.test/x.webp', 'abc')] }));
    expect(notObjectId.status).toBe(400);
    const videoInContent = await request(app)
      .post('/api/v1/posts')
      .set(authHeader(editor))
      .send(post({ content: [imgNode(video.url, video.id)] }));
    expect(videoInContent.status).toBe(400);
    const videoCover = await request(app)
      .post('/api/v1/posts')
      .set(authHeader(editor))
      .send(post({ cover: { url: video.url, alt: '', mediaId: video.id } }));
    expect(videoCover.status).toBe(400);
    expect(videoCover.body.error.details).toEqual([
      { path: 'body.cover.mediaId', message: 'Ảnh không tồn tại trong kho media' },
    ]);
    const created = (await request(app).post('/api/v1/posts').set(authHeader(editor)).send(post())).body.data.id;
    const badPatch = await request(app)
      .patch(`/api/v1/posts/${created}`)
      .set(authHeader(editor))
      .send({ content: [imgNode(video.url, video.id)] });
    expect(badPatch.status).toBe(400);
    expect(await refsOf(a.id)).toEqual([`post:${created}`]);
    expect(await refsOf(video.id)).toEqual([]);
  });

  it('nhân bản bài → bài mới cũng giữ ref; xoá mềm bài vẫn giữ ref (xoá media vẫn 409)', async () => {
    const { app, editor, a, b, post } = await setup();
    const postId = (await request(app).post('/api/v1/posts').set(authHeader(editor)).send(post())).body.data.id;
    const copy = await request(app).post(`/api/v1/posts/${postId}/duplicate`).set(authHeader(editor));
    expect(copy.status).toBe(201);
    const copyId = copy.body.data.id;
    expect((await refsOf(a.id)).sort()).toEqual([`post:${copyId}`, `post:${postId}`].sort());
    expect((await refsOf(b.id)).sort()).toEqual([`post:${copyId}`, `post:${postId}`].sort());

    expect((await request(app).delete(`/api/v1/posts/${postId}`).set(authHeader(editor))).status).toBe(204);
    expect((await refsOf(a.id)).sort()).toEqual([`post:${copyId}`, `post:${postId}`].sort());
    const del = await request(app).delete(`/api/v1/media/${b.id}`).set(authHeader(editor));
    expect(del.status).toBe(409);
    expect(del.body.error.details).toHaveLength(2);
    expect(del.body.error.details.map((d: { message: string }) => d.message)).toContain(
      `post:${postId}:Bài có ảnh từ kho media`,
    );
  });
});
