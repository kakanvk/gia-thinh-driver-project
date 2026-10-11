import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { Category } from '../../src/modules/categories/category.model';
import { authHeader, createBranch, createCategory, createUser } from '../helpers/factories';

describe('admin /categories', () => {
  it('editor tạo chuyên mục, slug tự sinh, có audit', async () => {
    const { user: editor } = await createUser({ role: 'editor' });
    const res = await request(createApp())
      .post('/api/v1/categories')
      .set(authHeader(editor))
      .send({ name: 'Kinh nghiệm thi', description: 'Mẹo ôn lý thuyết' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ slug: 'kinh-nghiem-thi', isAnnouncement: false });
    expect(await AuditLog.countDocuments({ action: 'category.create' })).toBe(1);
  });

  it('409 khi trùng slug, consultant bị 403', async () => {
    const branch = await createBranch();
    const { user: editor } = await createUser({ role: 'editor' });
    const { user: consultant } = await createUser({ role: 'consultant', branchIds: [branch.id] });
    await Category.init();
    await createCategory({ slug: 'thong-bao' });
    const app = createApp();
    expect((await request(app).post('/api/v1/categories').set(authHeader(editor)).send({ name: 'Thông báo' })).status).toBe(
      409,
    );
    expect((await request(app).get('/api/v1/categories').set(authHeader(consultant))).status).toBe(403);
  });

  it('danh sách sắp theo order; reorder; cập nhật; xóa chuyên mục trống → 204', async () => {
    const { user: editor } = await createUser({ role: 'editor' });
    const a = await createCategory({ name: 'A', order: 1 });
    const b = await createCategory({ name: 'B', order: 2 });
    const app = createApp();
    await request(app)
      .patch('/api/v1/categories/reorder')
      .set(authHeader(editor))
      .send({ ids: [b.id, a.id] });
    const list = await request(app).get('/api/v1/categories').set(authHeader(editor));
    expect(list.body.data.map((c: { name: string }) => c.name)).toEqual(['B', 'A']);
    const patch = await request(app)
      .patch(`/api/v1/categories/${a.id}`)
      .set(authHeader(editor))
      .send({ isAnnouncement: true });
    expect(patch.body.data.isAnnouncement).toBe(true);
    expect((await request(app).delete(`/api/v1/categories/${a.id}`).set(authHeader(editor))).status).toBe(204);
    expect((await request(app).get(`/api/v1/categories/${a.id}`).set(authHeader(editor))).status).toBe(404);
  });
});
