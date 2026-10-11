import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { authHeader, createBranch, createInstructor, createUser } from '../helpers/factories';

async function setup() {
  const [a, b] = await Promise.all([createBranch({ name: 'A' }), createBranch({ name: 'B' })]);
  const { user: managerA } = await createUser({ role: 'branch_manager', branchIds: [a.id] });
  const { user: consultantA } = await createUser({ role: 'consultant', branchIds: [a.id] });
  return { app: createApp(), a, b, managerA, consultantA };
}

describe('/instructors', () => {
  it('quản lý tạo giáo viên chi nhánh mình: SĐT chuẩn hóa, chuyên môn viết hoa, có audit', async () => {
    const { app, a, managerA } = await setup();
    const res = await request(app)
      .post('/api/v1/instructors')
      .set(authHeader(managerA))
      .send({ name: 'Nguyễn Hoàng Đức', phone: '0907 226 880', specialties: ['b', 'c1'], branchId: a.id });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ phone: '0907226880', specialties: ['B', 'C1'], status: 'active', userId: null });
    expect(await AuditLog.countDocuments({ action: 'instructor.create' })).toBe(1);
  });

  it('chi nhánh khác: tạo → 403 BRANCH_FORBIDDEN, đọc → 404; tư vấn viên không có quyền (403)', async () => {
    const { app, b, managerA, consultantA } = await setup();
    const created = await request(app)
      .post('/api/v1/instructors')
      .set(authHeader(managerA))
      .send({ name: 'GV B', phone: '0907000001', branchId: b.id });
    expect(created.status).toBe(403);
    expect(created.body.error.code).toBe('BRANCH_FORBIDDEN');
    const other = await createInstructor({ branchId: b.id });
    expect((await request(app).get(`/api/v1/instructors/${other.id}`).set(authHeader(managerA))).status).toBe(404);
    expect((await request(app).get('/api/v1/instructors').set(authHeader(consultantA))).status).toBe(403);
  });

  it('liên kết tài khoản: phải là user vai trò instructor cùng chi nhánh, mỗi tài khoản một hồ sơ', async () => {
    const { app, a, b, managerA } = await setup();
    const { user: teacherA } = await createUser({ role: 'instructor', branchIds: [a.id] });
    const { user: teacherB } = await createUser({ role: 'instructor', branchIds: [b.id] });
    const { user: consultant } = await createUser({ role: 'consultant', branchIds: [a.id] });
    const body = (userId: string) => ({ name: 'GV', phone: '0907000002', branchId: a.id, userId });
    expect((await request(app).post('/api/v1/instructors').set(authHeader(managerA)).send(body(teacherB.id))).status).toBe(
      400,
    );
    expect((await request(app).post('/api/v1/instructors').set(authHeader(managerA)).send(body(consultant.id))).status).toBe(
      400,
    );
    expect((await request(app).post('/api/v1/instructors').set(authHeader(managerA)).send(body(teacherA.id))).status).toBe(
      201,
    );
    expect((await request(app).post('/api/v1/instructors').set(authHeader(managerA)).send(body(teacherA.id))).status).toBe(
      409,
    );
  });

  it('danh sách lọc theo trạng thái và q; sửa; PATCH rỗng → 400; xóa mềm', async () => {
    const { app, a, managerA } = await setup();
    await createInstructor({ branchId: a.id, name: 'Phạm Minh Tuấn', status: 'on_leave' });
    const target = await createInstructor({ branchId: a.id, name: 'Lê Văn Tám' });
    const h = authHeader(managerA);
    expect((await request(app).get('/api/v1/instructors?status=on_leave').set(h)).body.data[0].name).toBe('Phạm Minh Tuấn');
    expect((await request(app).get('/api/v1/instructors?q=t%C3%A1m').set(h)).body.meta.total).toBe(1);
    expect(
      (await request(app).patch(`/api/v1/instructors/${target.id}`).set(h).send({ status: 'inactive' })).body.data.status,
    ).toBe('inactive');
    expect((await request(app).patch(`/api/v1/instructors/${target.id}`).set(h).send({})).status).toBe(400);
    expect((await request(app).delete(`/api/v1/instructors/${target.id}`).set(h)).status).toBe(204);
    expect((await request(app).get(`/api/v1/instructors/${target.id}`).set(h)).status).toBe(404);
  });
});
