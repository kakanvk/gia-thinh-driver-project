import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { Branch } from '../../src/modules/branches/branch.model';
import { authHeader, createBranch, createUser } from '../helpers/factories';

const payload = {
  name: 'Tân Ngãi',
  officeName: 'VP1 — Tân Ngãi',
  address: 'Số 331A, P. Tân Ngãi, T. Vĩnh Long',
  openingHours: '7:30–17:30 · T2–T7',
};

describe('admin /branches', () => {
  it('super_admin tạo chi nhánh, slug tự sinh, có audit', async () => {
    const { user: admin } = await createUser();
    const res = await request(createApp()).post('/api/v1/branches').set(authHeader(admin)).send(payload);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: 'Tân Ngãi', slug: 'tan-ngai', status: 'active' });
    expect(await AuditLog.countDocuments({ action: 'branch.create', entityId: res.body.data.id })).toBe(1);
  });

  it('409 khi trùng slug', async () => {
    const { user: admin } = await createUser();
    await Branch.init();
    await createBranch({ slug: 'tan-ngai' });
    const res = await request(createApp()).post('/api/v1/branches').set(authHeader(admin)).send(payload);
    expect(res.status).toBe(409);
  });

  it('branch_manager không được tạo (403) nhưng đọc được danh sách', async () => {
    const branch = await createBranch();
    const { user } = await createUser({ role: 'branch_manager', branchIds: [branch.id] });
    const app = createApp();
    expect((await request(app).post('/api/v1/branches').set(authHeader(user)).send(payload)).status).toBe(403);
    const list = await request(app).get('/api/v1/branches').set(authHeader(user));
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(1);
  });

  it('managerId phải là tài khoản branch_manager', async () => {
    const { user: admin } = await createUser();
    const { user: editor } = await createUser({ role: 'editor' });
    const res = await request(createApp())
      .post('/api/v1/branches')
      .set(authHeader(admin))
      .send({ ...payload, managerId: editor.id });
    expect(res.status).toBe(400);
  });

  it('cập nhật và ghi before/after vào audit', async () => {
    const { user: admin } = await createUser();
    const branch = await createBranch({ name: 'Cũ' });
    const res = await request(createApp())
      .patch(`/api/v1/branches/${branch.id}`)
      .set(authHeader(admin))
      .send({ openingHours: '8:00–17:00 · T2–T6' });
    expect(res.status).toBe(200);
    expect(res.body.data.openingHours).toBe('8:00–17:00 · T2–T6');
    const log = await AuditLog.findOne({ action: 'branch.update' });
    expect(log?.before).toMatchObject({ name: 'Cũ' });
  });

  it('xóa mềm: GET trả 404, không còn trong danh sách', async () => {
    const { user: admin } = await createUser();
    const branch = await createBranch();
    const app = createApp();
    expect((await request(app).delete(`/api/v1/branches/${branch.id}`).set(authHeader(admin))).status).toBe(204);
    expect((await request(app).get(`/api/v1/branches/${branch.id}`).set(authHeader(admin))).status).toBe(404);
    expect((await request(app).get('/api/v1/branches').set(authHeader(admin))).body.meta.total).toBe(0);
  });

  it('ID sai định dạng trả 400, không phải 500', async () => {
    const { user: admin } = await createUser();
    const res = await request(createApp()).get('/api/v1/branches/abc').set(authHeader(admin));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /public/branches', () => {
  it('không cần đăng nhập, chỉ trả chi nhánh active, theo thứ tự', async () => {
    await createBranch({ name: 'B', order: 2 });
    await createBranch({ name: 'A', order: 1 });
    await createBranch({ name: 'Ẩn', status: 'inactive' });
    const res = await request(createApp()).get('/api/v1/public/branches');
    expect(res.status).toBe(200);
    expect(res.body.data.map((b: { name: string }) => b.name)).toEqual(['A', 'B']);
    expect(res.body.data[0]).not.toHaveProperty('managerId');
  });
});
