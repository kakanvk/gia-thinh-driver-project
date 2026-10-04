import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { Post } from '../../src/modules/posts/post.model';
import { createCategory } from '../helpers/factories';

const content = [{ type: 'p', children: [{ text: 'Nội dung bài viết về sa hình.' }] }];
let seq = 0;

async function post(categoryId: string, overrides: Record<string, unknown> = {}) {
  seq += 1;
  return Post.create({
    title: `Bài ${seq}`,
    slug: `bai-${seq}`,
    excerpt: `Tóm tắt ${seq}`,
    content,
    contentText: 'Nội dung bài viết về sa hình.',
    readTimeMinutes: 1,
    categoryId,
    tags: [],
    authorName: 'Ban biên tập',
    status: 'published',
    publishedAt: new Date(Date.now() - seq * 60_000),
    ...overrides,
  });
}

describe('public content', () => {
  it('chỉ bài published có publishedAt ≤ hiện tại; mới nhất trước; không lộ content', async () => {
    const cat = await createCategory({ name: 'Kinh nghiệm thi', slug: 'kinh-nghiem-thi' });
    await post(cat.id, { slug: 'moi' });
    await post(cat.id, { slug: 'cu' });
    await post(cat.id, { slug: 'nhap', status: 'draft' });
    await post(cat.id, { slug: 'hen-gio', publishedAt: new Date(Date.now() + 86_400_000) });
    const res = await request(createApp()).get('/api/v1/public/posts');
    expect(res.status).toBe(200);
    expect(res.body.data.map((p: { slug: string }) => p.slug)).toEqual(['moi', 'cu']);
    expect(res.body.data[0]).not.toHaveProperty('content');
    expect(res.body.data[0].category).toEqual({ name: 'Kinh nghiệm thi', slug: 'kinh-nghiem-thi', isAnnouncement: false });
    expect(res.body.meta).toMatchObject({ page: 1, limit: 12, total: 2 });
  });

  it('lọc theo chuyên mục (slug lạ → rỗng) và tìm theo q', async () => {
    const a = await createCategory({ slug: 'a' });
    const b = await createCategory({ slug: 'b' });
    await post(a.id, { title: 'Mẹo vòng số 8' });
    await post(b.id, { title: 'Học phí hạng B' });
    const app = createApp();
    expect((await request(app).get('/api/v1/public/posts?category=b')).body.data).toHaveLength(1);
    expect((await request(app).get('/api/v1/public/posts?category=khong-co')).body.meta.total).toBe(0);
    expect((await request(app).get('/api/v1/public/posts?q=v%C3%B2ng%20s%E1%BB%91')).body.data[0].title).toBe(
      'Mẹo vòng số 8',
    );
  });

  it('chi tiết: trả content, tăng lượt xem; bài nháp/hẹn giờ/đã xóa → 404', async () => {
    const cat = await createCategory();
    await post(cat.id, { slug: 'xem' });
    await post(cat.id, { slug: 'nhap', status: 'draft' });
    await post(cat.id, { slug: 'tuong-lai', publishedAt: new Date(Date.now() + 86_400_000) });
    await post(cat.id, { slug: 'da-xoa', deletedAt: new Date() });
    const app = createApp();
    const first = await request(app).get('/api/v1/public/posts/xem');
    expect(first.status).toBe(200);
    expect(first.body.data.content).toEqual(content);
    await request(app).get('/api/v1/public/posts/xem');
    expect((await Post.findOne({ slug: 'xem' }))?.views).toBe(2);
    for (const slug of ['nhap', 'tuong-lai', 'da-xoa', 'khong-co']) {
      expect((await request(app).get(`/api/v1/public/posts/${slug}`)).status).toBe(404);
    }
  });

  it('/public/categories trả số bài đang công khai theo thứ tự', async () => {
    const a = await createCategory({ name: 'A', slug: 'a', order: 2 });
    const b = await createCategory({ name: 'B', slug: 'b', order: 1, isAnnouncement: true });
    await post(a.id);
    await post(a.id);
    await post(a.id, { status: 'draft' });
    const res = await request(createApp()).get('/api/v1/public/categories');
    expect(res.body.data).toEqual([
      { name: 'B', slug: 'b', description: null, isAnnouncement: true, postCount: 0 },
      { name: 'A', slug: 'a', description: null, isAnnouncement: false, postCount: 2 },
    ]);
    expect(b.id).toBeTruthy();
  });
});
