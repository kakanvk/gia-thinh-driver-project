import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import * as jobs from '../../src/jobs';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { Lead } from '../../src/modules/leads/lead.model';
import { Payment } from '../../src/modules/tuition/payment.model';
import { Student } from '../../src/modules/students/student.model';
import { TuitionAccount } from '../../src/modules/tuition/tuition-account.model';
import { reconcilePaidAmounts, refreshTuitionStatuses } from '../../src/modules/tuition/tuition.job';
import * as tuitionJob from '../../src/modules/tuition/tuition.job';
import { authHeader, createBranch, createCourse, createLead, createUser } from '../helpers/factories';

async function setup() {
  const branch = await createBranch({ name: 'A' });
  const course = await createCourse({ code: 'A1', defaultPrice: 1_000_000 });
  const { user: manager } = await createUser({ role: 'branch_manager', branchIds: [branch.id] });
  const { user: admin } = await createUser();
  const app = createApp();
  return { app, branch, course, manager, admin };
}

async function newStudent(ctx: Awaited<ReturnType<typeof setup>>, extra: Record<string, unknown> = {}) {
  const res = await request(ctx.app)
    .post('/api/v1/students')
    .set(authHeader(ctx.manager))
    .send({ name: 'Trần Quốc Bảo', phone: '0786205114', courseId: ctx.course.id, branchId: ctx.branch.id, ...extra });
  const id = res.body.data.id as string;
  return { id, account: (await TuitionAccount.findOne({ studentId: id }))! };
}

afterEach(async () => {
  await jobs.stopJobs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('paidAt không ở tương lai', () => {
  it('ngày mai → 400; hôm qua → 201', async () => {
    const ctx = await setup();
    const { account } = await newStudent(ctx);
    const url = `/api/v1/tuition/${account.id}/payments`;
    const day = 86_400_000;
    const future = await request(ctx.app)
      .post(url)
      .set(authHeader(ctx.manager))
      .send({ amount: 100_000, method: 'cash', paidAt: new Date(Date.now() + day).toISOString() });
    expect(future.status).toBe(400);
    expect(JSON.stringify(future.body)).toContain('Ngày thu không được ở tương lai');
    const past = await request(ctx.app)
      .post(url)
      .set(authHeader(ctx.manager))
      .send({ amount: 100_000, method: 'cash', paidAt: new Date(Date.now() - day).toISOString() });
    expect(past.status).toBe(201);
  });
});

const later = () => new Date(Date.now() + 11 * 60 * 1000);

describe('reconcilePaidAmounts', () => {
  it('bỏ qua sổ vừa đặt chỗ thu tiền nhưng chưa có phiếu (grace)', async () => {
    const ctx = await setup();
    const { account } = await newStudent(ctx);
    await TuitionAccount.updateOne({ _id: account._id }, { $inc: { paidAmount: 200_000 } });
    expect(await reconcilePaidAmounts()).toBe(0);
    expect((await TuitionAccount.findById(account.id))?.paidAmount).toBe(200_000);
  });

  it('bỏ qua sổ có phiếu vừa hủy dở (voidedAt mới, paidAmount chưa trừ)', async () => {
    const ctx = await setup();
    const { account } = await newStudent(ctx);
    await request(ctx.app)
      .post(`/api/v1/tuition/${account.id}/payments`)
      .set(authHeader(ctx.manager))
      .send({ amount: 300_000, method: 'cash' });
    await Payment.updateOne({ tuitionAccountId: account._id }, { voidedAt: new Date() });
    const old = new Date(Date.now() - 60 * 60 * 1000);
    await TuitionAccount.collection.updateOne({ _id: account._id }, { $set: { updatedAt: old } });
    expect(await reconcilePaidAmounts()).toBe(0);
    expect((await TuitionAccount.findById(account.id))?.paidAmount).toBe(300_000);
  });

  it('sửa paidAmount lệch theo tổng phiếu chưa hủy; lần hai trả 0', async () => {
    const ctx = await setup();
    const { account } = await newStudent(ctx);
    await request(ctx.app)
      .post(`/api/v1/tuition/${account.id}/payments`)
      .set(authHeader(ctx.manager))
      .send({ amount: 300_000, method: 'cash' });
    await TuitionAccount.updateOne({ _id: account._id }, { paidAmount: 900_000, status: 'partial' });
    expect(await reconcilePaidAmounts(later())).toBe(1);
    expect((await TuitionAccount.findById(account.id))?.paidAmount).toBe(300_000);
    expect(await reconcilePaidAmounts(later())).toBe(0);
  });

  it('sổ không có phiếu nhưng paidAmount > 0 → về 0', async () => {
    const ctx = await setup();
    const { account } = await newStudent(ctx);
    await TuitionAccount.updateOne({ _id: account._id }, { paidAmount: 500_000 });
    expect(await reconcilePaidAmounts(later())).toBe(1);
    expect((await TuitionAccount.findById(account.id))?.paidAmount).toBe(0);
  });
});

describe('sổ học phí lưu trữ (archived)', () => {
  it('xóa học viên đã có phiếu thu → sổ archived, ẩn khỏi danh sách/dashboard/job, includeArchived thì thấy', async () => {
    const ctx = await setup();
    const { id, account } = await newStudent(ctx);
    await request(ctx.app)
      .post(`/api/v1/tuition/${account.id}/payments`)
      .set(authHeader(ctx.manager))
      .send({ amount: 400_000, method: 'cash' });
    await TuitionAccount.updateOne({ _id: account._id }, { status: 'overdue' });
    expect((await request(ctx.app).get('/api/v1/dashboard/summary').set(authHeader(ctx.manager))).body.data.tuition).toEqual(
      { overdueAccounts: 1, outstanding: 600_000 },
    );
    expect((await request(ctx.app).delete(`/api/v1/students/${id}`).set(authHeader(ctx.manager))).status).toBe(204);
    const kept = (await TuitionAccount.findById(account.id))!;
    expect(kept.archived).toBe(true);
    const h = authHeader(ctx.manager);
    expect((await request(ctx.app).get('/api/v1/tuition').set(h)).body.meta.total).toBe(0);
    expect((await request(ctx.app).get('/api/v1/tuition?includeArchived=true').set(h)).body.meta.total).toBe(1);
    expect((await request(ctx.app).get(`/api/v1/tuition/${account.id}`).set(h)).status).toBe(200);
    expect((await request(ctx.app).get('/api/v1/dashboard/summary').set(h)).body.data.tuition).toEqual({
      overdueAccounts: 0,
      outstanding: 0,
    });
    expect((await refreshTuitionStatuses(new Date('2030-01-01T00:00:00Z'))).checked).toBe(0);
    await TuitionAccount.updateOne({ _id: account._id }, { paidAmount: 1 });
    expect(await reconcilePaidAmounts(later())).toBe(0);
  });

  it('sổ có lastPaymentAt (phiếu đã hủy) khi xóa học viên → archived, không bị xóa', async () => {
    const ctx = await setup();
    const { id, account } = await newStudent(ctx);
    await TuitionAccount.updateOne({ _id: account._id }, { lastPaymentAt: new Date() });
    await request(ctx.app).delete(`/api/v1/students/${id}`).set(authHeader(ctx.manager));
    const kept = await TuitionAccount.findById(account.id);
    expect(kept?.archived).toBe(true);
  });
});

describe('audit và idempotency tạo sổ', () => {
  it('tạo học viên qua API ghi đúng một audit tuition.create', async () => {
    const ctx = await setup();
    await newStudent(ctx);
    expect(await AuditLog.countDocuments({ action: 'tuition.create' })).toBe(1);
  });

  it('hai backfill đồng thời → [201, 409], đúng một audit', async () => {
    const ctx = await setup();
    const student = await Student.create({
      code: 'HV-CU-01',
      name: 'Học viên cũ',
      phone: '0911000000',
      courseId: ctx.course._id,
      courseCode: 'A1',
      branchId: ctx.branch._id,
      classId: null,
      status: 'studying',
      enrolledAt: new Date('2026-09-01T00:00:00+07:00'),
    });
    await TuitionAccount.init();
    const post = () => request(ctx.app).post('/api/v1/tuition').set(authHeader(ctx.manager)).send({ studentId: student.id });
    const results = await Promise.all([post(), post()]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await AuditLog.countDocuments({ action: 'tuition.create' })).toBe(1);
  });
});

describe('hủy phiếu đua với reconcile', () => {
  async function paidAccount(ctx: Awaited<ReturnType<typeof setup>>, amounts: number[]) {
    const { account } = await newStudent(ctx);
    for (const amount of amounts) {
      const res = await request(ctx.app)
        .post(`/api/v1/tuition/${account.id}/payments`)
        .set(authHeader(ctx.manager))
        .send({ amount, method: 'cash' });
      expect(res.status).toBe(201);
    }
    const old = new Date(Date.now() - 60 * 60 * 1000);
    await TuitionAccount.collection.updateOne({ _id: account._id }, { $set: { updatedAt: old } });
    await Payment.collection.updateMany({ tuitionAccountId: account._id }, { $set: { createdAt: old, updatedAt: old } });
    return account;
  }

  it('bước 1 của hủy chen giữa các truy vấn của reconcile: reconcile không đổi gì, bước 2 trừ đúng một lần', async () => {
    const ctx = await setup();
    const account = await paidAccount(ctx, [300_000, 200_000]);
    const target = (await Payment.findOne({ tuitionAccountId: account._id, amount: 300_000 }))!;
    const original = Payment.aggregate.bind(Payment);
    let injected = false;
    vi.spyOn(Payment, 'aggregate').mockImplementation(((...args: unknown[]) => {
      if (!injected) {
        injected = true;
        return Payment.updateOne(
          { _id: target._id },
          { voidedAt: new Date(), voidedBy: ctx.manager._id, voidReason: 'race' },
        ).then(() => (original as (...a: unknown[]) => unknown)(...args));
      }
      return (original as (...a: unknown[]) => unknown)(...args);
    }) as never);
    expect(await reconcilePaidAmounts()).toBe(0);
    vi.restoreAllMocks();
    expect(injected).toBe(true);
    expect((await TuitionAccount.findById(account.id))?.paidAmount).toBe(500_000);
    await TuitionAccount.updateOne({ _id: account._id }, { $inc: { paidAmount: -300_000 } });
    expect((await TuitionAccount.findById(account.id))?.paidAmount).toBe(200_000);
    expect(await reconcilePaidAmounts(later())).toBe(0);
  });

  it('hủy chạy song song với reconcile không bao giờ làm paidAmount âm', async () => {
    const ctx = await setup();
    const account = await paidAccount(ctx, [300_000]);
    const payment = (await Payment.findOne({ tuitionAccountId: account._id }))!;
    const [voided] = await Promise.all([
      request(ctx.app)
        .delete(`/api/v1/tuition/${account.id}/payments/${payment.id}`)
        .set(authHeader(ctx.admin))
        .send({ reason: 'nhập sai' }),
      reconcilePaidAmounts(),
    ]);
    expect(voided.status).toBe(200);
    expect((await TuitionAccount.findById(account.id))?.paidAmount).toBe(0);
  });

  it('hủy đồng thời cùng một phiếu: [200, 409] và chỉ trừ một lần', async () => {
    const ctx = await setup();
    const account = await paidAccount(ctx, [300_000, 200_000]);
    const payment = (await Payment.findOne({ tuitionAccountId: account._id, amount: 300_000 }))!;
    const post = () =>
      request(ctx.app)
        .delete(`/api/v1/tuition/${account.id}/payments/${payment.id}`)
        .set(authHeader(ctx.admin))
        .send({ reason: 'nhập sai' });
    const spy = vi.spyOn(TuitionAccount, 'findOneAndUpdate');
    const results = await Promise.all([post(), post()]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await TuitionAccount.findById(account.id))?.paidAmount).toBe(200_000);
    const decrements = spy.mock.calls.filter(
      ([, update]) => ((update as { $inc?: { paidAmount?: number } }).$inc?.paidAmount ?? 0) < 0,
    );
    expect(decrements).toHaveLength(1);
  });
});

describe('đổi ngày nhập học', () => {
  it('sổ one_time chưa lưu trữ: hạn đợt duy nhất = ngày nhập học + 14 ngày', async () => {
    const ctx = await setup();
    const { id, account } = await newStudent(ctx, { enrolledAt: '2026-10-01' });
    const res = await request(ctx.app)
      .patch(`/api/v1/students/${id}`)
      .set(authHeader(ctx.manager))
      .send({ enrolledAt: '2026-11-01' });
    expect(res.status).toBe(200);
    const after = (await TuitionAccount.findById(account.id))!;
    expect(after.installments[0]?.dueDate.toISOString()).toBe('2026-11-14T17:00:00.000Z');
    expect(after.status).toBe('partial');
  });
});

describe('chuyển khách: bồi hoàn khi lỗi', () => {
  it('xóa học viên trước; deleteOne sổ lỗi vẫn không để học viên mồ côi', async () => {
    const ctx = await setup();
    const lead = await createLead({ branchId: ctx.branch.id, status: 'deposited' });
    vi.spyOn(Lead, 'findOneAndUpdate').mockRejectedValueOnce(new Error('boom') as never);
    vi.spyOn(TuitionAccount, 'deleteOne').mockRejectedValueOnce(new Error('cleanup fail') as never);
    const res = await request(ctx.app)
      .post(`/api/v1/leads/${lead.id}/convert`)
      .set(authHeader(ctx.manager))
      .send({ courseId: ctx.course.id });
    expect(res.status).toBe(500);
    expect(await Student.countDocuments({})).toBe(0);
  });
});

describe('jobs không chạy chồng', () => {
  it('chạy chậm: tick tiếp theo bị bỏ qua; stopJobs chờ lượt đang chạy xong', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    vi.spyOn(tuitionJob, 'reconcilePaidAmounts').mockResolvedValue(0);
    const spy = vi.spyOn(tuitionJob, 'refreshTuitionStatuses').mockImplementation(async () => {
      await gate;
      return { checked: 0, changed: 0 };
    });
    jobs.startJobs();
    await vi.advanceTimersByTimeAsync(jobs.JOB_START_DELAY_MS);
    expect(spy).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(jobs.JOB_INTERVAL_MS);
    expect(spy).toHaveBeenCalledTimes(1);
    let stopped = false;
    const stopping = jobs.stopJobs().then(() => (stopped = true));
    await vi.advanceTimersByTimeAsync(10);
    expect(stopped).toBe(false);
    release();
    await stopping;
    expect(stopped).toBe(true);
  });
});
