import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { PriceItem } from '../../src/modules/pricing/price-item.model';
import { authHeader, createBranch, createCourse, createUser } from '../helpers/factories';

async function setup() {
  const [a, b] = await Promise.all([
    createBranch({ name: 'A', slug: 'chi-nhanh-a' }),
    createBranch({ name: 'B', slug: 'chi-nhanh-b' }),
  ]);
  const courseA = await createCourse({ code: 'A', defaultPrice: 1_750_000, order: 1 });
  const { user: admin } = await createUser();
  const { user: managerA } = await createUser({ role: 'branch_manager', branchIds: [a.id] });
  const { user: consultantA } = await createUser({ role: 'consultant', branchIds: [a.id] });
  return { app: createApp(), a, b, courseA, admin, managerA, consultantA };
}

describe('giá ghi đè theo chi nhánh', () => {
  it('quản lý A đặt giá riêng cho A; có audit; chi nhánh B → BRANCH_FORBIDDEN', async () => {
    const { app, a, b, courseA, managerA } = await setup();
    const res = await request(app)
      .put(`/api/v1/pricing/branches/${a.id}/courses/${courseA.id}`)
      .set(authHeader(managerA))
      .send({ price: 1_595_000 });
    expect(res.status).toBe(200);
    expect(res.body.data.courses[0]).toMatchObject({
      code: 'A',
      price: 1_595_000,
      priceSource: 'override',
      defaultPrice: 1_750_000,
    });
    expect(await AuditLog.countDocuments({ action: 'price_override.set' })).toBe(1);

    const other = await request(app)
      .put(`/api/v1/pricing/branches/${b.id}/courses/${courseA.id}`)
      .set(authHeader(managerA))
      .send({ price: 1 });
    expect(other.status).toBe(403);
    expect(other.body.error.code).toBe('BRANCH_FORBIDDEN');
  });

  it('xóa giá riêng → về giá mặc định; xóa khi không có → 404', async () => {
    const { app, a, courseA, admin } = await setup();
    const url = `/api/v1/pricing/branches/${a.id}/courses/${courseA.id}`;
    await request(app).put(url).set(authHeader(admin)).send({ price: 1_000_000 });
    expect((await request(app).delete(url).set(authHeader(admin))).status).toBe(204);
    const pricing = await request(app).get(`/api/v1/pricing/branches/${a.id}`).set(authHeader(admin));
    expect(pricing.body.data.courses[0]).toMatchObject({ price: 1_750_000, priceSource: 'default' });
    expect((await request(app).delete(url).set(authHeader(admin))).status).toBe(404);
  });

  it('consultant xem được bảng giá chi nhánh nhưng không sửa được (403)', async () => {
    const { app, a, courseA, consultantA } = await setup();
    expect((await request(app).get(`/api/v1/pricing/branches/${a.id}`).set(authHeader(consultantA))).status).toBe(200);
    const put = await request(app)
      .put(`/api/v1/pricing/branches/${a.id}/courses/${courseA.id}`)
      .set(authHeader(consultantA))
      .send({ price: 1 });
    expect(put.status).toBe(403);
    expect(put.body.error.code).toBe('FORBIDDEN');
  });

  it('quản lý A xóa giá riêng của chi nhánh B → 403 BRANCH_FORBIDDEN', async () => {
    const { app, b, courseA, admin, managerA } = await setup();
    const url = `/api/v1/pricing/branches/${b.id}/courses/${courseA.id}`;
    expect((await request(app).put(url).set(authHeader(admin)).send({ price: 1_000_000 })).status).toBe(200);
    const res = await request(app).delete(url).set(authHeader(managerA));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('BRANCH_FORBIDDEN');
  });

  it('404 khi chi nhánh hoặc gói không tồn tại', async () => {
    const { app, a, courseA, admin } = await setup();
    const missing = '0123456789abcdef01234567';
    expect(
      (
        await request(app)
          .put(`/api/v1/pricing/branches/${missing}/courses/${courseA.id}`)
          .set(authHeader(admin))
          .send({ price: 1 })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .put(`/api/v1/pricing/branches/${a.id}/courses/${missing}`)
          .set(authHeader(admin))
          .send({ price: 1 })
      ).status,
    ).toBe(404);
  });
});

describe('mục giá (phụ phí / ưu đãi)', () => {
  const globalFee = (courseId: string) => ({
    kind: 'fee',
    key: 'thi-thu-may-tinh',
    courseId,
    label: 'Thi thử máy tính',
    amount: 10_000,
    unit: 'lượt',
  });

  it('chỉ super_admin tạo mục chung; quản lý A tạo mục riêng cho A', async () => {
    const { app, a, courseA, admin, managerA } = await setup();
    const denied = await request(app).post('/api/v1/pricing/items').set(authHeader(managerA)).send(globalFee(courseA.id));
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');
    expect(
      (await request(app).post('/api/v1/pricing/items').set(authHeader(admin)).send(globalFee(courseA.id))).status,
    ).toBe(201);
    const own = await request(app)
      .post('/api/v1/pricing/items')
      .set(authHeader(managerA))
      .send({ ...globalFee(courseA.id), branchId: a.id, hidden: true });
    expect(own.status).toBe(201);
  });

  it('ẩn mục chung ở A, B vẫn thấy (qua /public/pricing)', async () => {
    const { app, a, courseA, admin, managerA } = await setup();
    await request(app).post('/api/v1/pricing/items').set(authHeader(admin)).send(globalFee(courseA.id));
    await request(app)
      .post('/api/v1/pricing/items')
      .set(authHeader(managerA))
      .send({ ...globalFee(courseA.id), branchId: a.id, hidden: true });
    const atA = await request(app).get('/api/v1/public/pricing?branch=chi-nhanh-a');
    const atB = await request(app).get('/api/v1/public/pricing?branch=chi-nhanh-b');
    expect(atA.body.data.courses[0].fees).toEqual([]);
    expect(atB.body.data.courses[0].fees).toEqual([
      { key: 'thi-thu-may-tinh', label: 'Thi thử máy tính', amount: 10_000, amountMax: null, unit: 'lượt', note: null },
    ]);
  });

  it('400: hidden trên mục chung, amountMax < amount; 409 khi trùng; PATCH mục chung bởi quản lý → 403', async () => {
    const { app, courseA, admin, managerA } = await setup();
    await PriceItem.init();
    expect(
      (
        await request(app)
          .post('/api/v1/pricing/items')
          .set(authHeader(admin))
          .send({ ...globalFee(courseA.id), hidden: true })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/v1/pricing/items')
          .set(authHeader(admin))
          .send({ ...globalFee(courseA.id), amount: 600_000, amountMax: 300_000 })
      ).status,
    ).toBe(400);
    const created = await request(app).post('/api/v1/pricing/items').set(authHeader(admin)).send(globalFee(courseA.id));
    expect(
      (await request(app).post('/api/v1/pricing/items').set(authHeader(admin)).send(globalFee(courseA.id))).status,
    ).toBe(409);
    const patch = await request(app)
      .patch(`/api/v1/pricing/items/${created.body.data.id}`)
      .set(authHeader(managerA))
      .send({ amount: 1 });
    expect(patch.status).toBe(403);
    expect(patch.body.error.code).toBe('FORBIDDEN');
  });

  it('quản lý A sửa/xóa mục giá của chi nhánh B → 403 BRANCH_FORBIDDEN', async () => {
    const { app, b, courseA, admin, managerA } = await setup();
    const created = await request(app)
      .post('/api/v1/pricing/items')
      .set(authHeader(admin))
      .send({ ...globalFee(courseA.id), branchId: b.id });
    expect(created.status).toBe(201);
    const url = `/api/v1/pricing/items/${created.body.data.id}`;
    const patch = await request(app).patch(url).set(authHeader(managerA)).send({ amount: 1 });
    expect(patch.status).toBe(403);
    expect(patch.body.error.code).toBe('BRANCH_FORBIDDEN');
    const del = await request(app).delete(url).set(authHeader(managerA));
    expect(del.status).toBe(403);
    expect(del.body.error.code).toBe('BRANCH_FORBIDDEN');
  });

  it('super_admin sửa và xóa mục; danh sách lọc theo branchId=global', async () => {
    const { app, a, courseA, admin } = await setup();
    const created = await request(app).post('/api/v1/pricing/items').set(authHeader(admin)).send(globalFee(courseA.id));
    await request(app)
      .post('/api/v1/pricing/items')
      .set(authHeader(admin))
      .send({ ...globalFee(courseA.id), branchId: a.id, amount: 5_000 });
    const patched = await request(app)
      .patch(`/api/v1/pricing/items/${created.body.data.id}`)
      .set(authHeader(admin))
      .send({ amount: 15_000 });
    expect(patched.body.data.amount).toBe(15_000);
    const globals = await request(app).get('/api/v1/pricing/items?branchId=global').set(authHeader(admin));
    expect(globals.body.meta.total).toBe(1);
    expect((await request(app).delete(`/api/v1/pricing/items/${created.body.data.id}`).set(authHeader(admin))).status).toBe(
      204,
    );
    expect(await AuditLog.countDocuments({ entity: 'price_item' })).toBe(4);
  });
});

describe('GET /public/pricing', () => {
  it('không cần đăng nhập; trả mọi chi nhánh active; không lộ trường nội bộ; gói inactive bị ẩn', async () => {
    const { app } = await setup();
    await createCourse({ code: 'OFF', active: false });
    await createBranch({ name: 'Ẩn', slug: 'an', status: 'inactive' });
    const res = await request(app).get('/api/v1/public/pricing');
    expect(res.status).toBe(200);
    expect(res.body.data.map((entry: { branch: { slug: string } }) => entry.branch.slug)).toEqual([
      'chi-nhanh-a',
      'chi-nhanh-b',
    ]);
    const course = res.body.data[0].courses[0];
    expect(course).toMatchObject({ code: 'A', price: 1_750_000 });
    expect(course).not.toHaveProperty('defaultPrice');
    expect(course).not.toHaveProperty('priceSource');
    expect(course).not.toHaveProperty('id');
    expect(res.body.data[0].courses.map((c: { code: string }) => c.code)).not.toContain('OFF');
  });

  it('slug không tồn tại hoặc chi nhánh inactive → 404', async () => {
    const { app } = await setup();
    await createBranch({ slug: 'dong-cua', status: 'inactive' });
    expect((await request(app).get('/api/v1/public/pricing?branch=khong-co')).status).toBe(404);
    expect((await request(app).get('/api/v1/public/pricing?branch=dong-cua')).status).toBe(404);
  });
});
