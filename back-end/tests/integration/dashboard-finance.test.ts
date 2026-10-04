import { Types } from 'mongoose';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import { ExamCandidate } from '../../src/modules/exams/exam-candidate.model';
import { ExamSession } from '../../src/modules/exams/exam-session.model';
import { Payment } from '../../src/modules/tuition/payment.model';
import { authHeader, createBranch, createCourse, createUser } from '../helpers/factories';

afterEach(() => vi.useRealTimers());

async function setup() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-14T03:00:00Z'));
  const [a, b] = await Promise.all([createBranch({ name: 'A' }), createBranch({ name: 'B' })]);
  const { user: managerA } = await createUser({ role: 'branch_manager', branchIds: [a.id] });
  return { app: createApp(), a, b, managerA };
}

let receipt = 0;
const payment = (branchId: Types.ObjectId, courseCode: string, amount: number, paidAt: string, voided = false) => {
  receipt += 1;
  return {
    tuitionAccountId: new Types.ObjectId(),
    studentId: new Types.ObjectId(),
    branchId,
    courseCode,
    amount,
    method: 'cash',
    paidAt: new Date(paidAt),
    receivedBy: new Types.ObjectId(),
    receiptNo: `PT-TEST-${receipt}`,
    voidedAt: voided ? new Date() : null,
  };
};

describe('GET /dashboard/revenue', () => {
  it('thực thu theo tháng giờ VN, bỏ phiếu đã hủy và chi nhánh khác, kèm cơ cấu theo hạng', async () => {
    const { app, a, b, managerA } = await setup();
    await Payment.create([
      payment(a._id, 'B', 16_000_000, '2026-10-02T03:00:00Z'),
      payment(a._id, 'A1', 4_000_000, '2026-10-05T03:00:00Z'),
      payment(a._id, 'B', 5_000_000, '2026-09-30T16:30:00Z'), // 23:30 30/09 VN → tháng 9
      payment(a._id, 'B', 9_000_000, '2026-10-06T03:00:00Z', true),
      payment(b._id, 'B', 7_000_000, '2026-10-06T03:00:00Z'),
    ]);
    const res = await request(app).get('/api/v1/dashboard/revenue?months=3').set(authHeader(managerA));
    expect(res.status).toBe(200);
    expect(res.body.data.months).toEqual([
      { month: '2026-08', amount: 0 },
      { month: '2026-09', amount: 5_000_000 },
      { month: '2026-10', amount: 20_000_000 },
    ]);
    expect(res.body.data.byCourse).toEqual([
      { courseCode: 'B', amount: 21_000_000, share: 84 },
      { courseCode: 'A1', amount: 4_000_000, share: 16 },
    ]);
  });
});

describe('GET /dashboard/pass-rate', () => {
  it('chỉ lần thi đầu, ca sát hạch không hủy, trong khoảng tháng; theo hạng', async () => {
    const { app, a, managerA } = await setup();
    const [a1, bCourse] = await Promise.all([createCourse({ code: 'A1' }), createCourse({ code: 'B' })]);
    const session = (code: string, courseId: Types.ObjectId, courseCode: string, extra: Record<string, unknown> = {}) =>
      ExamSession.create({
        code,
        type: 'official',
        courseId,
        courseCode,
        branchId: a._id,
        date: new Date('2026-10-01T00:00:00+07:00'),
        ...extra,
      });
    const shA1 = await session('SH-A1', a1._id, 'A1');
    const shB = await session('SH-B', bCourse._id, 'B');
    const graduation = await session('TN-B', bCourse._id, 'B', { type: 'graduation' });
    const cancelled = await session('SH-HUY', bCourse._id, 'B', { status: 'cancelled' });
    const old = await session('SH-CU', bCourse._id, 'B', { date: new Date('2025-01-10T00:00:00+07:00') });
    const cand = (sessionId: Types.ObjectId, result: string, attempt = 1) => ({
      sessionId,
      studentId: new Types.ObjectId(),
      result,
      attempt,
    });
    await ExamCandidate.create([
      cand(shA1._id, 'passed'),
      cand(shA1._id, 'passed'),
      cand(shA1._id, 'failed'),
      cand(shA1._id, 'absent'),
      cand(shB._id, 'passed'),
      cand(shB._id, 'failed', 2),
      cand(graduation._id, 'failed'),
      cand(cancelled._id, 'failed'),
      cand(old._id, 'failed'),
    ]);
    const res = await request(app).get('/api/v1/dashboard/pass-rate?months=12').set(authHeader(managerA));
    expect(res.body.data).toEqual([
      { courseCode: 'A1', passed: 2, failed: 1, rate: 66.7 },
      { courseCode: 'B', passed: 1, failed: 0, rate: 100 },
    ]);
  });
});
