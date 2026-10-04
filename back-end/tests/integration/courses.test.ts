import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { Course } from '../../src/modules/courses/course.model';
import { authHeader, createBranch, createCourse, createUser } from '../helpers/factories';

const payload = {
  code: 'b',
  name: 'Hạng B (số sàn & tự động)',
  vehicleType: 'car',
  description: 'Giáo viên kèm từ đầu đến lúc lấy bằng.',
  duration: '3–4 tuần',
  defaultPrice: 16_500_000,
  priceNote: 'Đã gồm xăng DAT',
  image: { url: '/vehicles/car-b.png', alt: 'Xe tập lái hạng B' },
};

describe('admin /courses', () => {
  it('super_admin tạo gói: mã tự viết hoa, có ảnh, có audit', async () => {
    const { user: admin } = await createUser();
    const res = await request(createApp()).post('/api/v1/courses').set(authHeader(admin)).send(payload);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ code: 'B', defaultPrice: 16_500_000, active: true, image: { url: '/vehicles/car-b.png' } });
    expect(await AuditLog.countDocuments({ action: 'course.create' })).toBe(1);
  });

  it('400 khi giá không nguyên hoặc âm, ảnh có url nguy hiểm', async () => {
    const { user: admin } = await createUser();
    const app = createApp();
    for (const body of [
      { ...payload, defaultPrice: 1.5 },
      { ...payload, defaultPrice: -1 },
      { ...payload, image: { url: 'javascript:alert(1)', alt: '' } },
    ]) {
      expect((await request(app).post('/api/v1/courses').set(authHeader(admin)).send(body)).status).toBe(400);
    }
  });

  it('409 khi trùng mã', async () => {
    const { user: admin } = await createUser();
    await Course.init();
    await createCourse({ code: 'B' });
    expect((await request(createApp()).post('/api/v1/courses').set(authHeader(admin)).send(payload)).status).toBe(409);
  });

  it('branch_manager không sửa được giá mặc định (403), consultant đọc được danh sách', async () => {
    const branch = await createBranch();
    const course = await createCourse({ defaultPrice: 620_000 });
    const { user: manager } = await createUser({ role: 'branch_manager', branchIds: [branch.id] });
    const { user: consultant } = await createUser({ role: 'consultant', branchIds: [branch.id] });
    const app = createApp();
    const patch = await request(app).patch(`/api/v1/courses/${course.id}`).set(authHeader(manager)).send({ defaultPrice: 1 });
    expect(patch.status).toBe(403);
    const list = await request(app).get('/api/v1/courses').set(authHeader(consultant));
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(1);
  });

  it('sửa giá mặc định ghi audit before/after', async () => {
    const { user: admin } = await createUser();
    const course = await createCourse({ defaultPrice: 620_000 });
    const res = await request(createApp())
      .patch(`/api/v1/courses/${course.id}`)
      .set(authHeader(admin))
      .send({ defaultPrice: 650_000 });
    expect(res.status).toBe(200);
    const log = await AuditLog.findOne({ action: 'course.update' });
    expect(log?.before).toMatchObject({ defaultPrice: 620_000 });
    expect(log?.after).toMatchObject({ defaultPrice: 650_000 });
  });

  it('reorder đặt order theo thứ tự id gửi lên; id lạ → 400', async () => {
    const { user: admin } = await createUser();
    const [a, b, c] = await Promise.all([createCourse(), createCourse(), createCourse()]);
    const app = createApp();
    const res = await request(app)
      .patch('/api/v1/courses/reorder')
      .set(authHeader(admin))
      .send({ ids: [c!.id, a!.id, b!.id] });
    expect(res.status).toBe(200);
    const list = await request(app).get('/api/v1/courses?sort=order').set(authHeader(admin));
    expect(list.body.data.map((x: { id: string }) => x.id)).toEqual([c!.id, a!.id, b!.id]);
    const bad = await request(app)
      .patch('/api/v1/courses/reorder')
      .set(authHeader(admin))
      .send({ ids: ['0123456789abcdef01234567'] });
    expect(bad.status).toBe(400);
  });

  it('lọc active; xóa mềm → 404', async () => {
    const { user: admin } = await createUser();
    await createCourse({ active: false });
    const course = await createCourse();
    const app = createApp();
    expect((await request(app).get('/api/v1/courses?active=true').set(authHeader(admin))).body.meta.total).toBe(1);
    expect((await request(app).delete(`/api/v1/courses/${course.id}`).set(authHeader(admin))).status).toBe(204);
    expect((await request(app).get(`/api/v1/courses/${course.id}`).set(authHeader(admin))).status).toBe(404);
  });
});
