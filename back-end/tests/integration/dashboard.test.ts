import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import { Appointment } from '../../src/modules/appointments/appointment.model';
import { LeadActivity } from '../../src/modules/leads/lead-activity.model';
import { TuitionAccount } from '../../src/modules/tuition/tuition-account.model';
import { authHeader, createBranch, createCourse, createLead, createStudent, createUser } from '../helpers/factories';

const NOW = new Date('2026-10-14T03:00:00Z'); // T4 14/10/2026 10:00 VN

afterEach(() => vi.useRealTimers());

async function setup() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  const [a, b] = await Promise.all([createBranch({ name: 'A' }), createBranch({ name: 'B' })]);
  const { user: managerA } = await createUser({ role: 'branch_manager', branchIds: [a.id] });
  return { app: createApp(), a, b, managerA };
}

describe('GET /dashboard/summary', () => {
  it('đếm theo tháng/tuần/ngày giờ VN, chỉ chi nhánh mình', async () => {
    const { app, a, b, managerA } = await setup();
    await createLead({ branchId: a.id, createdAt: new Date('2026-10-02T03:00:00Z') });
    await createLead({ branchId: a.id, createdAt: new Date('2026-10-13T03:00:00Z') });
    await createLead({ branchId: a.id, createdAt: new Date('2026-09-30T16:30:00Z') }); // 23:30 30/09 VN → tháng 9
    await createLead({ branchId: b.id, createdAt: new Date('2026-10-05T03:00:00Z') });
    const course = await createCourse();
    await createStudent({ branchId: a.id, courseId: course.id });
    await createStudent({ branchId: a.id, courseId: course.id, status: 'completed' });
    const base = { branchId: a._id, durationMinutes: 30, type: 'consult', status: 'scheduled', createdBy: managerA._id };
    await Appointment.create([
      { ...base, startAt: new Date('2026-10-14T01:00:00Z'), endAt: new Date('2026-10-14T01:30:00Z') }, // hôm nay
      { ...base, startAt: new Date('2026-10-16T01:00:00Z'), endAt: new Date('2026-10-16T01:30:00Z') }, // tuần này
      { ...base, startAt: new Date('2026-10-20T01:00:00Z'), endAt: new Date('2026-10-20T01:30:00Z') }, // tuần sau
      { ...base, startAt: new Date('2026-10-15T01:00:00Z'), endAt: new Date('2026-10-15T01:30:00Z'), status: 'cancelled' },
    ]);
    const course2 = await createCourse();
    const s1 = await createStudent({ branchId: a.id, courseId: course2.id });
    const s2 = await createStudent({ branchId: a.id, courseId: course2.id, status: 'paused' });
    for (const student of [s1, s2]) {
      await TuitionAccount.create({
        studentId: student._id,
        courseId: course2._id,
        courseCode: course2.code,
        branchId: a._id,
        listPrice: 1_000_000,
        total: 1_000_000,
        installments: [],
        paidAmount: 250_000,
        status: 'overdue',
      });
    }
    const res = await request(app).get('/api/v1/dashboard/summary').set(authHeader(managerA));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      leads: { thisMonth: 2, lastMonth: 1, changePct: 100 },
      students: { studying: 2, newThisMonth: 4 },
      appointments: { thisWeek: 2, today: 1 },
      tuition: { overdueAccounts: 2, outstanding: 1_500_000 },
    });
  });

  it('branchId ngoài phạm vi → 403; tư vấn viên xem được; giáo viên không (403)', async () => {
    const { app, a, b, managerA } = await setup();
    const { user: consultant } = await createUser({ role: 'consultant', branchIds: [a.id] });
    const { user: teacher } = await createUser({ role: 'instructor', branchIds: [a.id] });
    expect((await request(app).get(`/api/v1/dashboard/summary?branchId=${b.id}`).set(authHeader(managerA))).status).toBe(
      403,
    );
    expect((await request(app).get('/api/v1/dashboard/summary').set(authHeader(consultant))).status).toBe(200);
    expect((await request(app).get('/api/v1/dashboard/summary').set(authHeader(teacher))).status).toBe(403);
  });
});

describe('đăng ký, nguồn, phễu', () => {
  it('registrations: đủ 7 ngày gần nhất theo giờ VN, ngày trống = 0', async () => {
    const { app, a, managerA } = await setup();
    await createLead({ branchId: a.id, createdAt: new Date('2026-10-13T16:30:00Z') }); // 23:30 13/10 VN
    await createLead({ branchId: a.id, createdAt: new Date('2026-10-13T17:30:00Z') }); // 00:30 14/10 VN
    await createLead({ branchId: a.id, createdAt: new Date('2026-10-01T03:00:00Z') }); // ngoài 7 ngày
    const res = await request(app).get('/api/v1/dashboard/registrations?days=7').set(authHeader(managerA));
    expect(res.body.data).toHaveLength(7);
    expect(res.body.data[0]).toEqual({ date: '2026-10-08', count: 0 });
    expect(res.body.data.slice(-2)).toEqual([
      { date: '2026-10-13', count: 1 },
      { date: '2026-10-14', count: 1 },
    ]);
  });

  it('sources: theo nguồn trong tháng, giảm dần', async () => {
    const { app, a, managerA } = await setup();
    await createLead({ branchId: a.id, source: 'facebook', createdAt: new Date('2026-10-02T03:00:00Z') });
    await createLead({ branchId: a.id, source: 'facebook', createdAt: new Date('2026-10-03T03:00:00Z') });
    await createLead({ branchId: a.id, source: 'website', createdAt: new Date('2026-10-04T03:00:00Z') });
    await createLead({ branchId: a.id, source: 'zalo', createdAt: new Date('2026-09-04T03:00:00Z') });
    const res = await request(app).get('/api/v1/dashboard/sources?month=2026-10').set(authHeader(managerA));
    expect(res.body.data).toEqual([
      { source: 'facebook', count: 2 },
      { source: 'website', count: 1 },
    ]);
  });

  it('funnel: đếm khách đã từng đạt mỗi mốc (kể cả khách sau đó lost)', async () => {
    const { app, a, managerA } = await setup();
    const at = new Date('2026-10-05T03:00:00Z');
    await createLead({ branchId: a.id, status: 'new', createdAt: at });
    await createLead({ branchId: a.id, status: 'consulted', createdAt: at });
    await createLead({ branchId: a.id, status: 'enrolled', createdAt: at });
    const lostAfterDeposit = await createLead({ branchId: a.id, status: 'lost', createdAt: at });
    await LeadActivity.create({
      leadId: lostAfterDeposit._id,
      type: 'status_change',
      fromStatus: 'consulted',
      toStatus: 'deposited',
      at,
    });
    await createLead({ branchId: a.id, status: 'deposited', createdAt: new Date('2026-09-05T03:00:00Z') }); // tháng khác
    const res = await request(app).get('/api/v1/dashboard/funnel?month=2026-10').set(authHeader(managerA));
    expect(res.body.data).toEqual([
      { stage: 'new', label: 'Tiếp nhận', count: 4 },
      { stage: 'contacted', label: 'Đã liên hệ', count: 3 },
      { stage: 'consulted', label: 'Đã tư vấn', count: 3 },
      { stage: 'deposited', label: 'Đặt cọc', count: 2 },
      { stage: 'docs_completed', label: 'Hoàn tất hồ sơ', count: 1 },
      { stage: 'enrolled', label: 'Nhập học', count: 1 },
    ]);
  });
});
