import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { authHeader, createBranch, createUser } from '../helpers/factories';

async function setup() {
  const [a, b] = await Promise.all([createBranch({ name: 'A' }), createBranch({ name: 'B' })]);
  const { user: consultantA } = await createUser({ role: 'consultant', branchIds: [a.id], name: 'Bình tư vấn A' });
  const { user: managerA } = await createUser({ role: 'branch_manager', branchIds: [a.id], name: 'An quản lý A' });
  const { user: consultantB } = await createUser({ role: 'consultant', branchIds: [b.id], name: 'Cường tư vấn B' });
  await createUser({ role: 'consultant', branchIds: [a.id], name: 'Dũng bị khoá', status: 'suspended' });
  const { user: editorA } = await createUser({ role: 'editor', branchIds: [a.id], name: 'Em biên tập' });
  const { user: instructorA } = await createUser({ role: 'instructor', branchIds: [a.id], name: 'Giang giáo viên' });
  const { user: admin } = await createUser({ name: 'Hải quản trị' });
  return { app: createApp(), a, b, consultantA, managerA, consultantB, editorA, instructorA, admin };
}

describe('GET /users/options', () => {
  it('tư vấn viên chỉ thấy nhân viên cùng chi nhánh, sắp theo tên, không lộ SĐT/username', async () => {
    const { app, a, consultantA, managerA } = await setup();
    const res = await request(app).get('/api/v1/users/options').set(authHeader(consultantA));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { id: managerA.id, name: 'An quản lý A', role: 'branch_manager', branchIds: [a.id] },
      { id: consultantA.id, name: 'Bình tư vấn A', role: 'consultant', branchIds: [a.id] },
    ]);
    for (const item of res.body.data) {
      expect(Object.keys(item).sort()).toEqual(['branchIds', 'id', 'name', 'role']);
      expect(item).not.toHaveProperty('phone');
      expect(item).not.toHaveProperty('username');
    }
  });

  it('super_admin thấy mọi chi nhánh, bỏ editor, super_admin, người bị khoá', async () => {
    const { app, admin } = await setup();
    const res = await request(app).get('/api/v1/users/options').set(authHeader(admin));
    expect(res.status).toBe(200);
    expect(res.body.data.map((u: { name: string }) => u.name)).toEqual([
      'An quản lý A',
      'Bình tư vấn A',
      'Cường tư vấn B',
    ]);
  });

  it('super_admin lọc ?branchId=B → chỉ nhân viên chi nhánh B', async () => {
    const { app, b, admin, consultantB } = await setup();
    const res = await request(app).get(`/api/v1/users/options?branchId=${b.id}`).set(authHeader(admin));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { id: consultantB.id, name: 'Cường tư vấn B', role: 'consultant', branchIds: [b.id] },
    ]);
  });

  it('tư vấn viên A lọc chi nhánh B → 403 BRANCH_FORBIDDEN', async () => {
    const { app, b, consultantA } = await setup();
    const res = await request(app).get(`/api/v1/users/options?branchId=${b.id}`).set(authHeader(consultantA));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('BRANCH_FORBIDDEN');
  });

  it('branchId sai định dạng → 400', async () => {
    const { app, admin } = await setup();
    const res = await request(app).get('/api/v1/users/options?branchId=abc').set(authHeader(admin));
    expect(res.status).toBe(400);
  });

  it('editor và giáo viên (không có lead.read/appointment.read) → 403; chưa đăng nhập → 401', async () => {
    const { app, editorA, instructorA } = await setup();
    expect((await request(app).get('/api/v1/users/options').set(authHeader(editorA))).status).toBe(403);
    expect((await request(app).get('/api/v1/users/options').set(authHeader(instructorA))).status).toBe(403);
    expect((await request(app).get('/api/v1/users/options')).status).toBe(401);
  });

  it('người dùng đã xoá mềm không xuất hiện', async () => {
    const { app, a, consultantA } = await setup();
    const { user: removed } = await createUser({ role: 'consultant', branchIds: [a.id], name: 'Ánh đã xoá' });
    removed.set('deletedAt', new Date());
    await removed.save();
    const res = await request(app).get('/api/v1/users/options').set(authHeader(consultantA));
    expect(res.body.data.map((u: { id: string }) => u.id)).not.toContain(removed.id);
  });
});
