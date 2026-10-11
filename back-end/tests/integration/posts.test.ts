import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { Post } from '../../src/modules/posts/post.model';
import { authHeader, createBranch, createCategory, createUser } from '../helpers/factories';

const content = [
  { type: 'h2', children: [{ text: 'Giấy tờ cần mang' }] },
  { type: 'p', children: [{ text: 'Mang đủ CCCD bản gốc và biên lai đăng ký.' }] },
];

async function setup() {
  const category = await createCategory({ name: 'Kinh nghiệm thi', slug: 'kinh-nghiem-thi' });
  const { user: editor } = await createUser({ role: 'editor', name: 'Mỹ Duyên' });
  return { app: createApp(), category, editor };
}

const newPost = (categoryId: string, extra: Record<string, unknown> = {}) => ({
  title: '5 lưu ý trước ngày thi sát hạch A1',
  content,
  categoryId,
  tags: ['a1', 'sat-hach', 'a1'],
  cover: { url: '/media/a.jpg', alt: 'Sân tập' },
  ...extra,
});

describe('tạo / sửa bài viết', () => {
  it('tạo bản nháp: slug, contentText, readTime, excerpt, authorName tự sinh; tag bỏ trùng; có audit', async () => {
    const { app, category, editor } = await setup();
    const res = await request(app).post('/api/v1/posts').set(authHeader(editor)).send(newPost(category.id));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      slug: '5-luu-y-truoc-ngay-thi-sat-hach-a1',
      status: 'draft',
      contentText: 'Giấy tờ cần mang\nMang đủ CCCD bản gốc và biên lai đăng ký.',
      readTimeMinutes: 1,
      authorName: 'Mỹ Duyên',
      tags: ['a1', 'sat-hach'],
      publishedAt: null,
      views: 0,
    });
    expect(res.body.data.excerpt).toBe('Giấy tờ cần mang Mang đủ CCCD bản gốc và biên lai đăng ký.');
    expect(await AuditLog.countDocuments({ action: 'post.create' })).toBe(1);
  });

  it('trùng tiêu đề → slug -2; slug nhập tay bị trùng → 409', async () => {
    const { app, category, editor } = await setup();
    await request(app).post('/api/v1/posts').set(authHeader(editor)).send(newPost(category.id));
    const second = await request(app).post('/api/v1/posts').set(authHeader(editor)).send(newPost(category.id));
    expect(second.body.data.slug).toBe('5-luu-y-truoc-ngay-thi-sat-hach-a1-2');
    const manual = await request(app)
      .post('/api/v1/posts')
      .set(authHeader(editor))
      .send(newPost(category.id, { slug: '5-luu-y-truoc-ngay-thi-sat-hach-a1' }));
    expect(manual.status).toBe(409);
  });

  it('400: chuyên mục không tồn tại, nội dung có link javascript:', async () => {
    const { app, category, editor } = await setup();
    const badCategory = await request(app)
      .post('/api/v1/posts')
      .set(authHeader(editor))
      .send(newPost('0123456789abcdef01234567'));
    expect(badCategory.status).toBe(400);
    const xss = await request(app)
      .post('/api/v1/posts')
      .set(authHeader(editor))
      .send(newPost(category.id, { content: [{ type: 'a', url: 'javascript:alert(1)', children: [{ text: 'x' }] }] }));
    expect(xss.status).toBe(400);
    expect(xss.body.error.details[0].path).toBe('body.content.0.url');
  });

  it('sửa nội dung tính lại contentText/readTime; consultant bị 403', async () => {
    const { app, category, editor } = await setup();
    const branch = await createBranch();
    const { user: consultant } = await createUser({ role: 'consultant', branchIds: [branch.id] });
    const created = await request(app).post('/api/v1/posts').set(authHeader(editor)).send(newPost(category.id));
    const longText = Array.from({ length: 450 }, () => 'chữ').join(' ');
    const patch = await request(app)
      .patch(`/api/v1/posts/${created.body.data.id}`)
      .set(authHeader(editor))
      .send({ content: [{ type: 'p', children: [{ text: longText }] }] });
    expect(patch.body.data.readTimeMinutes).toBe(3);
    expect((await request(app).get('/api/v1/posts').set(authHeader(consultant))).status).toBe(403);
  });
});

describe('trạng thái bài viết', () => {
  it('draft → submit → publish (publishedAt mặc định là bây giờ) → unpublish → archive', async () => {
    const { app, category, editor } = await setup();
    const { body } = await request(app).post('/api/v1/posts').set(authHeader(editor)).send(newPost(category.id));
    const base = `/api/v1/posts/${body.data.id}`;
    expect((await request(app).post(`${base}/submit`).set(authHeader(editor))).body.data.status).toBe('pending');
    const published = await request(app).post(`${base}/publish`).set(authHeader(editor)).send({});
    expect(published.body.data.status).toBe('published');
    expect(published.body.data.publishedAt).toMatch(/\+07:00$/);
    expect((await request(app).post(`${base}/unpublish`).set(authHeader(editor))).body.data.status).toBe('draft');
    expect((await request(app).post(`${base}/archive`).set(authHeader(editor))).body.data.status).toBe('archived');
    expect(
      await AuditLog.countDocuments({
        entity: 'post',
        action: { $in: ['post.submit', 'post.publish', 'post.unpublish', 'post.archive'] },
      }),
    ).toBe(4);
  });

  it('publish hẹn giờ nhận publishedAt giờ VN; chuyển trạng thái sai → 409', async () => {
    const { app, category, editor } = await setup();
    const { body } = await request(app).post('/api/v1/posts').set(authHeader(editor)).send(newPost(category.id));
    const base = `/api/v1/posts/${body.data.id}`;
    const scheduled = await request(app)
      .post(`${base}/publish`)
      .set(authHeader(editor))
      .send({ publishedAt: '2030-01-01T08:00' });
    expect(scheduled.body.data.publishedAt).toBe('2030-01-01T08:00:00+07:00');
    expect((await request(app).post(`${base}/submit`).set(authHeader(editor))).status).toBe(409);
    await request(app).post(`${base}/archive`).set(authHeader(editor));
    expect((await request(app).post(`${base}/publish`).set(authHeader(editor)).send({})).status).toBe(409);
  });

  it('republish: ngày hẹn giờ tương lai bị thay bằng bây giờ; ngày xuất bản quá khứ được giữ', async () => {
    const { app, category, editor } = await setup();
    const { body } = await request(app).post('/api/v1/posts').set(authHeader(editor)).send(newPost(category.id));
    const base = `/api/v1/posts/${body.data.id}`;
    await request(app).post(`${base}/publish`).set(authHeader(editor)).send({ publishedAt: '2030-01-01T08:00' });
    await request(app).post(`${base}/unpublish`).set(authHeader(editor));
    const again = await request(app).post(`${base}/publish`).set(authHeader(editor)).send({});
    expect(new Date(again.body.data.publishedAt).getTime()).toBeLessThanOrEqual(Date.now());

    const second = await request(app)
      .post('/api/v1/posts')
      .set(authHeader(editor))
      .send(newPost(category.id, { title: 'Bài thứ hai' }));
    const base2 = `/api/v1/posts/${second.body.data.id}`;
    const first = await request(app).post(`${base2}/publish`).set(authHeader(editor)).send({});
    await request(app).post(`${base2}/unpublish`).set(authHeader(editor));
    const republished = await request(app).post(`${base2}/publish`).set(authHeader(editor)).send({});
    expect(republished.body.data.publishedAt).toBe(first.body.data.publishedAt);
  });

  it('khôi phục bài lưu trữ về draft; khôi phục bài đang draft → 409', async () => {
    const { app, category, editor } = await setup();
    const { body } = await request(app).post('/api/v1/posts').set(authHeader(editor)).send(newPost(category.id));
    const base = `/api/v1/posts/${body.data.id}`;
    expect((await request(app).post(`${base}/restore`).set(authHeader(editor))).status).toBe(409);
    await request(app).post(`${base}/archive`).set(authHeader(editor));
    const restored = await request(app).post(`${base}/restore`).set(authHeader(editor));
    expect(restored.status).toBe(200);
    expect(restored.body.data.status).toBe('draft');
    expect(await AuditLog.countDocuments({ action: 'post.restore' })).toBe(1);
  });

  it('nhân bản thành bản nháp mới, slug mới, lượt xem 0', async () => {
    const { app, category, editor } = await setup();
    const { body } = await request(app).post('/api/v1/posts').set(authHeader(editor)).send(newPost(category.id));
    await request(app).post(`/api/v1/posts/${body.data.id}/publish`).set(authHeader(editor)).send({});
    const copy = await request(app).post(`/api/v1/posts/${body.data.id}/duplicate`).set(authHeader(editor));
    expect(copy.status).toBe(201);
    expect(copy.body.data).toMatchObject({
      status: 'draft',
      publishedAt: null,
      views: 0,
      title: '5 lưu ý trước ngày thi sát hạch A1 (bản sao)',
      slug: '5-luu-y-truoc-ngay-thi-sat-hach-a1-2',
    });
  });
});

describe('danh sách / xóa', () => {
  it('danh sách không chứa content, lọc theo trạng thái và tag', async () => {
    const { app, category, editor } = await setup();
    const { body } = await request(app).post('/api/v1/posts').set(authHeader(editor)).send(newPost(category.id));
    await request(app)
      .post('/api/v1/posts')
      .set(authHeader(editor))
      .send(newPost(category.id, { title: 'Bài khác hẳn', tags: ['b'] }));
    await request(app).post(`/api/v1/posts/${body.data.id}/publish`).set(authHeader(editor)).send({});
    const list = await request(app).get('/api/v1/posts?status=published').set(authHeader(editor));
    expect(list.body.meta.total).toBe(1);
    expect(list.body.data[0]).not.toHaveProperty('content');
    expect((await request(app).get('/api/v1/posts?tag=b').set(authHeader(editor))).body.meta.total).toBe(1);
  });

  it('xóa mềm bài viết; bài đã xóa mềm không chặn xóa chuyên mục, bài còn sống thì 409', async () => {
    const { app, category, editor } = await setup();
    const { body } = await request(app).post('/api/v1/posts').set(authHeader(editor)).send(newPost(category.id));
    const live = await request(app)
      .post('/api/v1/posts')
      .set(authHeader(editor))
      .send(newPost(category.id, { title: 'Bài còn sống' }));
    expect((await request(app).delete(`/api/v1/posts/${body.data.id}`).set(authHeader(editor))).status).toBe(204);
    expect(await Post.countDocuments()).toBe(1);
    const blocked = await request(app).delete(`/api/v1/categories/${category.id}`).set(authHeader(editor));
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.message).toContain('còn bài viết');
    await request(app).delete(`/api/v1/posts/${live.body.data.id}`).set(authHeader(editor));
    expect((await request(app).delete(`/api/v1/categories/${category.id}`).set(authHeader(editor))).status).toBe(204);
  });
});

describe('tóm tắt tự động', () => {
  it('tóm tắt tự sinh được tính lại khi sửa nội dung; tóm tắt nhập tay giữ nguyên', async () => {
    const { app, category, editor } = await setup();
    const auto = await request(app).post('/api/v1/posts').set(authHeader(editor)).send(newPost(category.id));
    const manual = await request(app)
      .post('/api/v1/posts')
      .set(authHeader(editor))
      .send(newPost(category.id, { title: 'Bài nhập tay', excerpt: 'Tóm tắt của tôi' }));
    expect(auto.body.data.excerptAuto).toBe(true);
    expect(manual.body.data.excerptAuto).toBe(false);
    const newContent = [{ type: 'p', children: [{ text: 'Nội dung hoàn toàn mới' }] }];
    const a = await request(app)
      .patch(`/api/v1/posts/${auto.body.data.id}`)
      .set(authHeader(editor))
      .send({ content: newContent });
    const m = await request(app)
      .patch(`/api/v1/posts/${manual.body.data.id}`)
      .set(authHeader(editor))
      .send({ content: newContent });
    expect(a.body.data.excerpt).toBe('Nội dung hoàn toàn mới');
    expect(m.body.data.excerpt).toBe('Tóm tắt của tôi');
  });

  it('PATCH excerpt tắt chế độ tự sinh; nhân bản giữ excerptAuto; public không lộ excerptAuto', async () => {
    const { app, category, editor } = await setup();
    const created = await request(app).post('/api/v1/posts').set(authHeader(editor)).send(newPost(category.id));
    const id = created.body.data.id;
    const dup = await request(app).post(`/api/v1/posts/${id}/duplicate`).set(authHeader(editor));
    expect(dup.body.data.excerptAuto).toBe(true);
    await request(app).post(`/api/v1/posts/${id}/publish`).set(authHeader(editor)).send({});
    const pub = await request(app).get(`/api/v1/public/posts/${created.body.data.slug}`);
    expect(pub.status).toBe(200);
    expect(pub.body.data).not.toHaveProperty('excerptAuto');
    const patched = await request(app).patch(`/api/v1/posts/${id}`).set(authHeader(editor)).send({ excerpt: 'Viết tay' });
    expect(patched.body.data).toMatchObject({ excerpt: 'Viết tay', excerptAuto: false });
    const after = await request(app)
      .patch(`/api/v1/posts/${id}`)
      .set(authHeader(editor))
      .send({ content: [{ type: 'p', children: [{ text: 'Khác' }] }] });
    expect(after.body.data.excerpt).toBe('Viết tay');
  });
});
