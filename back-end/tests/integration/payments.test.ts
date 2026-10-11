import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { syncStatus } from '../../src/modules/tuition/payments.service';
import { createApp } from '../../src/app';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { Payment } from '../../src/modules/tuition/payment.model';
import { TuitionAccount } from '../../src/modules/tuition/tuition-account.model';
import { authHeader, createBranch, createCourse, createUser } from '../helpers/factories';

async function setup(price = 1_000_000) {
  const [a, b] = await Promise.all([createBranch({ name: 'A' }), createBranch({ name: 'B' })]);
  const course = await createCourse({ code: 'A1', defaultPrice: price });
  const { user: managerA } = await createUser({ role: 'branch_manager', branchIds: [a.id] });
  const { user: consultantA } = await createUser({ role: 'consultant', branchIds: [a.id] });
  const { user: admin } = await createUser();
  const app = createApp();
  const student = await request(app)
    .post('/api/v1/students')
    .set(authHeader(managerA))
    .send({ name: 'Trần Quốc Bảo', phone: '0786205114', courseId: course.id, branchId: a.id });
  const account = (await TuitionAccount.findOne({ studentId: student.body.data.id }))!;
  return { app, a, b, course, managerA, consultantA, admin, account };
}

const pay = (amount: number, extra: Record<string, unknown> = {}) => ({ amount, method: 'cash', ...extra });

describe('thu tiền', () => {
  it('thu một phần: số phiếu PT-yyMMdd-NN, cập nhật đã thu/còn lại, người thu, có audit; thu đủ → paid', async () => {
    const { app, managerA, account } = await setup();
    const url = `/api/v1/tuition/${account.id}/payments`;
    const first = await request(app)
      .post(url)
      .set(authHeader(managerA))
      .send(pay(400_000, { note: 'Đợt 1' }));
    expect(first.status).toBe(201);
    expect(first.body.data.payment).toMatchObject({
      amount: 400_000,
      method: 'cash',
      courseCode: 'A1',
      receivedBy: managerA.id,
    });
    expect(first.body.data.payment.receiptNo).toMatch(/^PT-\d{6}-\d{2,}$/);
    expect(first.body.data.account).toMatchObject({ paidAmount: 400_000, remaining: 600_000, status: 'partial' });
    const second = await request(app)
      .post(url)
      .set(authHeader(managerA))
      .send(pay(600_000, { method: 'transfer' }));
    expect(second.body.data.account).toMatchObject({ paidAmount: 1_000_000, remaining: 0, status: 'paid', nextDue: null });
    expect(await AuditLog.countDocuments({ action: 'tuition.payment' })).toBe(2);
  });

  it('không thu vượt số còn lại (409); số tiền 0 hoặc lẻ → 400', async () => {
    const { app, managerA, account } = await setup();
    const url = `/api/v1/tuition/${account.id}/payments`;
    expect((await request(app).post(url).set(authHeader(managerA)).send(pay(1_000_001))).status).toBe(409);
    expect((await request(app).post(url).set(authHeader(managerA)).send(pay(0))).status).toBe(400);
    expect((await request(app).post(url).set(authHeader(managerA)).send(pay(10.5))).status).toBe(400);
  });

  it('hai phiếu đồng thời vượt tổng → đúng một thành công, đã thu không vượt tổng', async () => {
    const { app, managerA, account } = await setup();
    const url = `/api/v1/tuition/${account.id}/payments`;
    const results = await Promise.all([
      request(app).post(url).set(authHeader(managerA)).send(pay(800_000)),
      request(app).post(url).set(authHeader(managerA)).send(pay(800_000)),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await TuitionAccount.findById(account.id))?.paidAmount).toBe(800_000);
    expect(await Payment.countDocuments({ tuitionAccountId: account._id })).toBe(1);
  });

  it('tư vấn viên không thu được (403); sổ chi nhánh khác → 404', async () => {
    const { app, b, course, consultantA, managerA, admin, account } = await setup();
    expect(
      (await request(app).post(`/api/v1/tuition/${account.id}/payments`).set(authHeader(consultantA)).send(pay(1))).status,
    ).toBe(403);
    const other = await request(app)
      .post('/api/v1/students')
      .set(authHeader(admin))
      .send({ name: 'Khác', phone: '0911222333', courseId: course.id, branchId: b.id });
    const foreign = await TuitionAccount.findOne({ studentId: other.body.data.id });
    expect(
      (await request(app).post(`/api/v1/tuition/${foreign!.id}/payments`).set(authHeader(managerA)).send(pay(1))).status,
    ).toBe(404);
  });
});

describe('hủy phiếu thu', () => {
  it('chỉ super_admin hủy được (quản lý chi nhánh 403); hủy mềm, giảm đã thu, cần lý do, có audit', async () => {
    const { app, managerA, admin, account } = await setup();
    const { body } = await request(app)
      .post(`/api/v1/tuition/${account.id}/payments`)
      .set(authHeader(managerA))
      .send(pay(1_000_000));
    const url = `/api/v1/tuition/${account.id}/payments/${body.data.payment.id}`;
    expect((await request(app).delete(url).set(authHeader(managerA)).send({ reason: 'Nhập nhầm' })).status).toBe(403);
    expect((await request(app).delete(url).set(authHeader(admin)).send({})).status).toBe(400);
    const voided = await request(app).delete(url).set(authHeader(admin)).send({ reason: 'Nhập nhầm số tiền' });
    expect(voided.status).toBe(200);
    expect(voided.body.data.account).toMatchObject({ paidAmount: 0, status: 'partial' });
    const payment = await Payment.findById(body.data.payment.id);
    expect(payment).toMatchObject({ voidReason: 'Nhập nhầm số tiền' });
    expect(payment?.voidedAt).toBeInstanceOf(Date);
    expect((await request(app).delete(url).set(authHeader(admin)).send({ reason: 'Lần 2' })).status).toBe(409);
    expect(await AuditLog.countDocuments({ action: 'tuition.payment_void' })).toBe(1);
  });

  it('chi tiết sổ liệt kê cả phiếu đã hủy (để đối soát)', async () => {
    const { app, managerA, admin, account } = await setup();
    const { body } = await request(app)
      .post(`/api/v1/tuition/${account.id}/payments`)
      .set(authHeader(managerA))
      .send(pay(300_000));
    await request(app)
      .delete(`/api/v1/tuition/${account.id}/payments/${body.data.payment.id}`)
      .set(authHeader(admin))
      .send({ reason: 'Sai người nộp' });
    const detail = await request(app).get(`/api/v1/tuition/${account.id}`).set(authHeader(managerA));
    expect(detail.body.data.payments).toHaveLength(1);
    expect(detail.body.data.payments[0].voidReason).toBe('Sai người nộp');
  });
});

describe('ghi trạng thái có điều kiện', () => {
  it('ghi cũ không đè: paidAmount đổi chen giữa thì đọc lại và tính lại', async () => {
    const { account } = await setup();
    const stale = (await TuitionAccount.findByIdAndUpdate(
      account._id,
      { $inc: { paidAmount: 400_000 } },
      { returnDocument: 'after' },
    ))!;
    // ghi khác chen vào: thu tiếp 600k trước khi ghi trạng thái của lần 400k
    await TuitionAccount.updateOne({ _id: account._id }, { $inc: { paidAmount: 600_000 } });
    await syncStatus(stale, new Date());
    const final = (await TuitionAccount.findById(account._id))!;
    expect(final.paidAmount).toBe(1_000_000);
    expect(final.status).toBe('paid');
  });

  it('ghi trạng thái cũ khi hai ghi chen nhau không để paid đủ tiền mà status partial', async () => {
    const { account } = await setup();
    const a = (await TuitionAccount.findByIdAndUpdate(
      account._id,
      { $inc: { paidAmount: 400_000 } },
      { returnDocument: 'after' },
    ))!;
    const b = (await TuitionAccount.findByIdAndUpdate(
      account._id,
      { $inc: { paidAmount: 600_000 } },
      { returnDocument: 'after' },
    ))!;
    await syncStatus(b, new Date());
    await syncStatus(a, new Date());
    expect((await TuitionAccount.findById(account._id))!.status).toBe('paid');
    vi.restoreAllMocks();
  });
});
