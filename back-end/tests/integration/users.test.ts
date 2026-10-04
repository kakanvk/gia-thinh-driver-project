import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { User } from '../../src/modules/users/user.model';
import { authHeader, createBranch, createUser } from '../helpers/factories';

async function setup() {
  const [a, b] = await Promise.all([createBranch({ name: 'A' }), createBranch({ name: 'B' })]);
  const { user: admin } = await createUser({ role: 'super_admin' });
  const { user: managerA } = await createUser({ role: 'branch_manager', branchIds: [a.id] });
  return { app: createApp(), a, b, admin, managerA };
}

const newUser = (extra: Record<string, unknown>) => ({
  name: 'Trần Mỹ Duyên',
  username: `duyen${Math.random().toString(36).slice(2, 8)}`,
  phone: `07${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
  password: 'Matkhau123',
  ...extra,
});

describe('POST /users', () => {
  it('super_admin tạo editor không có chi nhánh; không trả passwordHash; có audit', async () => {
    const { app, admin } = await setup();
    const res = await request(app)
      .post('/api/v1/users')
      .set(authHeader(admin))
      .send(newUser({ role: 'editor' }));
    expect(res.status).toBe(201);
    expect(res.body.data).not.toHaveProperty('passwordHash');
    expect(await AuditLog.countDocuments({ action: 'user.create' })).toBe(1);
  });

  it('400 khi consultant không có chi nhánh hoặc editor có chi nhánh', async () => {
    const { app, admin, a } = await setup();
    expect(
      (
        await request(app)
          .post('/api/v1/users')
          .set(authHeader(admin))
          .send(newUser({ role: 'consultant' }))
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/v1/users')
          .set(authHeader(admin))
          .send(newUser({ role: 'editor', branchIds: [a.id] }))
      ).status,
    ).toBe(400);
  });

  it('400 khi chi nhánh không tồn tại', async () => {
    const { app, admin } = await setup();
    const res = await request(app)
      .post('/api/v1/users')
      .set(authHeader(admin))
      .send(newUser({ role: 'consultant', branchIds: ['0123456789abcdef01234567'] }));
    expect(res.status).toBe(400);
  });

  it('branch_manager tạo consultant trong chi nhánh mình; chi nhánh khác → BRANCH_FORBIDDEN; vai trò cao → FORBIDDEN', async () => {
    const { app, managerA, a, b } = await setup();
    const ok = await request(app)
      .post('/api/v1/users')
      .set(authHeader(managerA))
      .send(newUser({ role: 'consultant', branchIds: [a.id] }));
    expect(ok.status).toBe(201);
    const other = await request(app)
      .post('/api/v1/users')
      .set(authHeader(managerA))
      .send(newUser({ role: 'consultant', branchIds: [b.id] }));
    expect(other.body.error.code).toBe('BRANCH_FORBIDDEN');
    const higher = await request(app)
      .post('/api/v1/users')
      .set(authHeader(managerA))
      .send(newUser({ role: 'branch_manager', branchIds: [a.id] }));
    expect(higher.body.error.code).toBe('FORBIDDEN');
  });

  it('409 khi trùng username hoặc SĐT (SĐT so sánh sau chuẩn hóa)', async () => {
    const { app, admin } = await setup();
    await User.init();
    await createUser({ username: 'trung', phone: '0779666664' });
    const sameUsername = await request(app)
      .post('/api/v1/users')
      .set(authHeader(admin))
      .send(newUser({ role: 'editor', username: 'Trung' }));
    expect(sameUsername.status).toBe(409);
    const samePhone = await request(app)
      .post('/api/v1/users')
      .set(authHeader(admin))
      .send(newUser({ role: 'editor', phone: '+84 779 666 664' }));
    expect(samePhone.status).toBe(409);
  });

  it('consultant không có quyền quản lý user', async () => {
    const { app, a } = await setup();
    const { user: consultant } = await createUser({ role: 'consultant', branchIds: [a.id] });
    expect((await request(app).get('/api/v1/users').set(authHeader(consultant))).status).toBe(403);
  });
});

describe('GET /users', () => {
  it('branch_manager chỉ thấy consultant/instructor có chi nhánh của mình', async () => {
    const { app, managerA, a, b } = await setup();
    await createUser({ role: 'consultant', branchIds: [a.id], name: 'Của A' });
    await createUser({ role: 'consultant', branchIds: [b.id], name: 'Của B' });
    await createUser({ role: 'consultant', branchIds: [a.id, b.id], name: 'Cả hai' });
    const res = await request(app).get('/api/v1/users?sort=name').set(authHeader(managerA));
    expect(res.status).toBe(200);
    expect(res.body.data.map((u: { name: string }) => u.name).sort()).toEqual(['Cả hai', 'Của A']);
  });

  it('super_admin lọc theo role và tìm theo q', async () => {
    const { app, admin } = await setup();
    await createUser({ role: 'editor', name: 'Biên tập Hoa' });
    const res = await request(app).get('/api/v1/users?role=editor&q=hoa').set(authHeader(admin));
    expect(res.body.meta.total).toBe(1);
  });
});

describe('PATCH /users/:id', () => {
  it('branch_manager không sửa được người thuộc thêm chi nhánh khác (BRANCH_FORBIDDEN)', async () => {
    const { app, managerA, a, b } = await setup();
    const { user: shared } = await createUser({ role: 'consultant', branchIds: [a.id, b.id] });
    const res = await request(app).patch(`/api/v1/users/${shared.id}`).set(authHeader(managerA)).send({ name: 'Đổi tên' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('BRANCH_FORBIDDEN');
  });

  it('không tự đổi vai trò của mình', async () => {
    const { app, admin } = await setup();
    const res = await request(app).patch(`/api/v1/users/${admin.id}`).set(authHeader(admin)).send({ role: 'editor' });
    expect(res.status).toBe(400);
  });

  it('đổi vai trò sang editor phải bỏ chi nhánh', async () => {
    const { app, admin, a } = await setup();
    const { user } = await createUser({ role: 'consultant', branchIds: [a.id] });
    expect(
      (await request(app).patch(`/api/v1/users/${user.id}`).set(authHeader(admin)).send({ role: 'editor' })).status,
    ).toBe(400);
    const ok = await request(app)
      .patch(`/api/v1/users/${user.id}`)
      .set(authHeader(admin))
      .send({ role: 'editor', branchIds: [] });
    expect(ok.status).toBe(200);
    expect(ok.body.data.role).toBe('editor');
  });
});

describe('status / reset-password / delete', () => {
  it('khóa tài khoản: token đang dùng bị từ chối; không tự khóa mình', async () => {
    const { app, admin, a } = await setup();
    const { user } = await createUser({ role: 'consultant', branchIds: [a.id] });
    const headers = authHeader(user);
    expect(
      (await request(app).patch(`/api/v1/users/${user.id}/status`).set(authHeader(admin)).send({ status: 'suspended' }))
        .status,
    ).toBe(200);
    expect((await request(app).get('/api/v1/auth/me').set(headers)).status).toBe(401);
    expect(
      (await request(app).patch(`/api/v1/users/${admin.id}/status`).set(authHeader(admin)).send({ status: 'suspended' }))
        .status,
    ).toBe(400);
  });

  it('reset-password trả mật khẩu tạm đăng nhập được', async () => {
    const { app, admin, a } = await setup();
    const { user } = await createUser({ role: 'consultant', branchIds: [a.id], username: 'nv_tam' });
    const res = await request(app).post(`/api/v1/users/${user.id}/reset-password`).set(authHeader(admin));
    expect(res.status).toBe(200);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'nv_tam', password: res.body.data.temporaryPassword });
    expect(login.status).toBe(200);
  });

  it('xóa mềm: không đăng nhập được, không còn trong danh sách', async () => {
    const { app, admin, a } = await setup();
    const { user, password } = await createUser({ role: 'consultant', branchIds: [a.id], username: 'nv_xoa' });
    expect((await request(app).delete(`/api/v1/users/${user.id}`).set(authHeader(admin))).status).toBe(204);
    expect((await request(app).post('/api/v1/auth/login').send({ identifier: 'nv_xoa', password })).status).toBe(401);
    expect((await request(app).get(`/api/v1/users/${user.id}`).set(authHeader(admin))).status).toBe(404);
  });
});

describe('cô lập chi nhánh (branch_manager A không chạm dữ liệu chi nhánh B)', () => {
  it('GET /users/:id của người chỉ thuộc B -> 404', async () => {
    const { app, managerA, b } = await setup();
    const { user } = await createUser({ role: 'consultant', branchIds: [b.id] });
    expect((await request(app).get(`/api/v1/users/${user.id}`).set(authHeader(managerA))).status).toBe(404);
  });

  it('status / reset-password / delete người thuộc cả A và B -> 403 BRANCH_FORBIDDEN', async () => {
    const { app, managerA, a, b } = await setup();
    const { user } = await createUser({ role: 'consultant', branchIds: [a.id, b.id] });
    const h = authHeader(managerA);
    const responses = [
      await request(app).patch(`/api/v1/users/${user.id}/status`).set(h).send({ status: 'suspended' }),
      await request(app).post(`/api/v1/users/${user.id}/reset-password`).set(h),
      await request(app).delete(`/api/v1/users/${user.id}`).set(h),
    ];
    for (const res of responses) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('BRANCH_FORBIDDEN');
    }
  });

  it('không chuyển consultant của mình sang chi nhánh B (BRANCH_FORBIDDEN)', async () => {
    const { app, managerA, a, b } = await setup();
    const { user } = await createUser({ role: 'consultant', branchIds: [a.id] });
    const res = await request(app).patch(`/api/v1/users/${user.id}`).set(authHeader(managerA)).send({ branchIds: [b.id] });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('BRANCH_FORBIDDEN');
  });

  it('không nâng consultant lên branch_manager (FORBIDDEN)', async () => {
    const { app, managerA, a } = await setup();
    const { user } = await createUser({ role: 'consultant', branchIds: [a.id] });
    const res = await request(app).patch(`/api/v1/users/${user.id}`).set(authHeader(managerA)).send({ role: 'branch_manager' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('chi nhánh đã xóa mềm', () => {
  it('vẫn sửa được tên người dùng thuộc chi nhánh đó', async () => {
    const { app, admin, a } = await setup();
    const { user } = await createUser({ role: 'consultant', branchIds: [a.id] });
    expect((await request(app).delete(`/api/v1/branches/${a.id}`).set(authHeader(admin))).status).toBe(204);
    const res = await request(app).patch(`/api/v1/users/${user.id}`).set(authHeader(admin)).send({ name: 'Tên mới' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Tên mới');
  });
});
