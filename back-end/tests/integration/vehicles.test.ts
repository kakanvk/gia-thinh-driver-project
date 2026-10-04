import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { Vehicle } from '../../src/modules/vehicles/vehicle.model';
import { formatVn } from '../../src/shared/time';
import { authHeader, createBranch, createCourse, createUser } from '../helpers/factories';

const day = (offset: number) => formatVn(new Date(Date.now() + offset * 86_400_000), 'yyyy-MM-dd');

async function setup() {
  const [a, b] = await Promise.all([createBranch({ name: 'A' }), createBranch({ name: 'B' })]);
  await createCourse({ code: 'B', vehicleType: 'car' });
  const { user: managerA } = await createUser({ role: 'branch_manager', branchIds: [a.id] });
  return { app: createApp(), a, b, managerA };
}

const vehicle = (branchId: string, extra: Record<string, unknown> = {}) => ({
  plate: ' 64a-123.45 ',
  model: 'Toyota Vios 1.5G',
  courseCode: 'b',
  transmission: 'automatic',
  branchId,
  odometer: 128_400,
  datKm: 1_240,
  nextServiceAt: day(100),
  registrationExpiresAt: day(200),
  ...extra,
});

describe('/vehicles', () => {
  it('tạo xe: biển số chuẩn hóa, mã hạng viết hoa, ngày giờ VN, có audit', async () => {
    const { app, a, managerA } = await setup();
    const res = await request(app).post('/api/v1/vehicles').set(authHeader(managerA)).send(vehicle(a.id));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      plate: '64A-123.45',
      courseCode: 'B',
      transmission: 'automatic',
      status: 'active',
    });
    expect(res.body.data.nextServiceAt).toMatch(/T00:00:00\+07:00$/);
    expect(await AuditLog.countDocuments({ action: 'vehicle.create' })).toBe(1);
  });

  it('400: biển số sai định dạng, hạng không tồn tại; 409 trùng biển số', async () => {
    const { app, a, managerA } = await setup();
    const h = authHeader(managerA);
    expect(
      (
        await request(app)
          .post('/api/v1/vehicles')
          .set(h)
          .send(vehicle(a.id, { plate: 'ABC' }))
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/v1/vehicles')
          .set(h)
          .send(vehicle(a.id, { courseCode: 'Z9' }))
      ).status,
    ).toBe(400);
    await Vehicle.init();
    await request(app).post('/api/v1/vehicles').set(h).send(vehicle(a.id));
    expect(
      (
        await request(app)
          .post('/api/v1/vehicles')
          .set(h)
          .send(vehicle(a.id, { plate: '64A-123.45' }))
      ).status,
    ).toBe(409);
  });

  it('biển số của xe đã xóa mềm được tái sử dụng', async () => {
    const { app, a, managerA } = await setup();
    const h = authHeader(managerA);
    await Vehicle.init();
    const first = await request(app).post('/api/v1/vehicles').set(h).send(vehicle(a.id));
    expect(first.status).toBe(201);
    expect((await request(app).delete(`/api/v1/vehicles/${first.body.data.id}`).set(h)).status).toBe(204);
    const again = await request(app).post('/api/v1/vehicles').set(h).send(vehicle(a.id));
    expect(again.status).toBe(201);
    expect((await request(app).post('/api/v1/vehicles').set(h).send(vehicle(a.id))).status).toBe(409);
  });

  it('chi nhánh khác → 403 khi tạo, 404 khi đọc', async () => {
    const { app, a, b, managerA } = await setup();
    const { user: admin } = await createUser();
    expect((await request(app).post('/api/v1/vehicles').set(authHeader(managerA)).send(vehicle(b.id))).status).toBe(403);
    const other = await request(app)
      .post('/api/v1/vehicles')
      .set(authHeader(admin))
      .send(vehicle(b.id, { plate: '64C-045.90' }));
    expect((await request(app).get(`/api/v1/vehicles/${other.body.data.id}`).set(authHeader(managerA))).status).toBe(404);
    expect(a.id).toBeTruthy();
  });

  it('cảnh báo: sắp đến hạn hoặc quá hạn trong N ngày, bỏ xe tạm dừng, sắp theo hạn gần nhất', async () => {
    const { app, a, managerA } = await setup();
    const h = authHeader(managerA);
    await request(app)
      .post('/api/v1/vehicles')
      .set(h)
      .send(vehicle(a.id, { plate: '64A-000.01', registrationExpiresAt: day(10) }));
    await request(app)
      .post('/api/v1/vehicles')
      .set(h)
      .send(vehicle(a.id, { plate: '64A-000.02', nextServiceAt: day(-3) }));
    await request(app)
      .post('/api/v1/vehicles')
      .set(h)
      .send(vehicle(a.id, { plate: '64A-000.03' }));
    await request(app)
      .post('/api/v1/vehicles')
      .set(h)
      .send(vehicle(a.id, { plate: '64A-000.04', nextServiceAt: day(5), status: 'paused' }));
    const res = await request(app).get('/api/v1/vehicles/alerts?days=30').set(h);
    expect(res.status).toBe(200);
    expect(res.body.data.map((x: { vehicle: { plate: string } }) => x.vehicle.plate)).toEqual(['64A-000.02', '64A-000.01']);
    expect(res.body.data[0].reasons[0]).toMatchObject({ type: 'service', overdue: true, daysLeft: -3 });
    expect(res.body.data[1].reasons[0]).toMatchObject({ type: 'registration', overdue: false, daysLeft: 10 });
  });

  it('lọc theo trạng thái / hạng; sửa trạng thái; PATCH rỗng 400; xóa mềm', async () => {
    const { app, a, managerA } = await setup();
    const h = authHeader(managerA);
    const { body } = await request(app).post('/api/v1/vehicles').set(h).send(vehicle(a.id));
    const id = body.data.id;
    expect(
      (await request(app).patch(`/api/v1/vehicles/${id}`).set(h).send({ status: 'maintenance', odometer: 128_900 })).body
        .data.status,
    ).toBe('maintenance');
    expect((await request(app).get('/api/v1/vehicles?status=maintenance&courseCode=B').set(h)).body.meta.total).toBe(1);
    expect((await request(app).patch(`/api/v1/vehicles/${id}`).set(h).send({})).status).toBe(400);
    expect((await request(app).delete(`/api/v1/vehicles/${id}`).set(h)).status).toBe(204);
    expect((await request(app).get(`/api/v1/vehicles/${id}`).set(h)).status).toBe(404);
  });
});
