import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { ExamCandidate } from '../../src/modules/exams/exam-candidate.model';
import { Student } from '../../src/modules/students/student.model';
import { formatVn } from '../../src/shared/time';
import { authHeader, createBranch, createCourse, createStudent, createUser } from '../helpers/factories';

const day = (offset: number) => formatVn(new Date(Date.now() + offset * 86_400_000), 'yyyy-MM-dd');

async function setup() {
  const [a, b] = await Promise.all([
    createBranch({ name: 'Tân Ngãi', slug: 'tan-ngai' }),
    createBranch({ name: 'B', slug: 'b' }),
  ]);
  const [courseA1, courseB] = await Promise.all([
    createCourse({ code: 'A1', name: 'Hạng A1' }),
    createCourse({ code: 'B', name: 'Hạng B' }),
  ]);
  const { user: managerA } = await createUser({ role: 'branch_manager', branchIds: [a.id] });
  return { app: createApp(), a, b, courseA1, courseB, managerA };
}

const session = (branchId: string, courseId: string, extra: Record<string, unknown> = {}) => ({
  code: 'sh-2610-01',
  type: 'official',
  courseId,
  branchId,
  date: day(7),
  location: 'Sân sát hạch Tân Ngãi',
  ...extra,
});

describe('/exams', () => {
  it('tạo ca thi + thêm thí sinh: chỉ học viên đang học cùng chi nhánh & gói; báo bỏ qua; trùng không thêm lại', async () => {
    const { app, a, b, courseA1, courseB, managerA } = await setup();
    const h = authHeader(managerA);
    const created = await request(app).post('/api/v1/exams').set(h).send(session(a.id, courseA1.id));
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ code: 'SH-2610-01', courseCode: 'A1', status: 'scheduled' });
    const ok1 = await createStudent({ branchId: a.id, courseId: courseA1.id });
    const ok2 = await createStudent({ branchId: a.id, courseId: courseA1.id });
    const wrongCourse = await createStudent({ branchId: a.id, courseId: courseB.id });
    const dropped = await createStudent({ branchId: a.id, courseId: courseA1.id, status: 'dropped' });
    const url = `/api/v1/exams/${created.body.data.id}/candidates`;
    const bad = await request(app)
      .post(url)
      .set(h)
      .send({ studentIds: [ok1.id, wrongCourse.id] });
    expect(bad.status).toBe(400);
    expect(await ExamCandidate.countDocuments()).toBe(0);
    const added = await request(app)
      .post(url)
      .set(h)
      .send({ studentIds: [ok1.id, ok2.id] });
    expect(added.body.data).toEqual({ added: 2, skipped: [] });
    const again = await request(app)
      .post(url)
      .set(h)
      .send({ studentIds: [ok1.id] });
    expect(again.body.data).toEqual({ added: 0, skipped: [ok1.id] });
    expect(
      (
        await request(app)
          .post(url)
          .set(h)
          .send({ studentIds: [dropped.id] })
      ).status,
    ).toBe(400);
    expect(b.id).toBeTruthy();
  });

  it('nhập kết quả: thống kê ca thi; đậu sát hạch → học viên hoàn thành; lần thi thứ 2 có attempt 2; có audit', async () => {
    const { app, a, courseA1, managerA } = await setup();
    const h = authHeader(managerA);
    const s1 = await request(app)
      .post('/api/v1/exams')
      .set(h)
      .send(session(a.id, courseA1.id, { date: day(-7) }));
    const student = await createStudent({ branchId: a.id, courseId: courseA1.id });
    const other = await createStudent({ branchId: a.id, courseId: courseA1.id });
    await request(app)
      .post(`/api/v1/exams/${s1.body.data.id}/candidates`)
      .set(h)
      .send({ studentIds: [student.id, other.id] });
    const candidates = await request(app).get(`/api/v1/exams/${s1.body.data.id}/candidates`).set(h);
    const mine = candidates.body.data.find((c: { student: { id: string } }) => c.student.id === student.id);
    const theirs = candidates.body.data.find((c: { student: { id: string } }) => c.student.id === other.id);
    expect(mine).toMatchObject({ result: 'pending', attempt: 1, student: { code: student.code, name: student.name } });
    await request(app)
      .patch(`/api/v1/exams/${s1.body.data.id}/candidates/${mine.id}`)
      .set(h)
      .send({ result: 'failed', score: 18 });
    await request(app)
      .patch(`/api/v1/exams/${s1.body.data.id}/candidates/${theirs.id}`)
      .set(h)
      .send({ result: 'passed', score: 24 });
    expect((await Student.findById(other.id))?.status).toBe('completed');
    expect(await AuditLog.countDocuments({ action: 'exam.result' })).toBe(2);
    const list = await request(app).get('/api/v1/exams').set(h);
    expect(list.body.data[0].stats).toEqual({ candidates: 2, passed: 1, failed: 1, absent: 0, pending: 0 });

    const s2 = await request(app)
      .post('/api/v1/exams')
      .set(h)
      .send(session(a.id, courseA1.id, { code: 'SH-2610-02' }));
    await request(app)
      .post(`/api/v1/exams/${s2.body.data.id}/candidates`)
      .set(h)
      .send({ studentIds: [student.id] });
    expect((await ExamCandidate.findOne({ sessionId: s2.body.data.id }))?.attempt).toBe(2);
  });

  it('attempt chỉ đếm lần thi đã có kết quả ở ca đã qua, không tính ca chờ/hủy/tương lai', async () => {
    const { app, a, courseA1, managerA } = await setup();
    const h = authHeader(managerA);
    const mk = (code: string, d: number) =>
      request(app)
        .post('/api/v1/exams')
        .set(h)
        .send(session(a.id, courseA1.id, { code, date: day(d) }));
    const [f1, f2] = [await mk('SH-F1', 10), await mk('SH-F2', 20)];
    const student = await createStudent({ branchId: a.id, courseId: courseA1.id });
    for (const f of [f2, f1]) {
      await request(app)
        .post(`/api/v1/exams/${f.body.data.id}/candidates`)
        .set(h)
        .send({ studentIds: [student.id] });
    }
    const attempts = await ExamCandidate.find({ studentId: student.id }).sort({ _id: 1 });
    expect(attempts.map((c) => c.attempt)).toEqual([1, 1]);
  });

  it('giảng viên xem danh sách thí sinh không thấy số điện thoại', async () => {
    const { app, a, courseA1, managerA } = await setup();
    const s = await request(app).post('/api/v1/exams').set(authHeader(managerA)).send(session(a.id, courseA1.id));
    const student = await createStudent({ branchId: a.id, courseId: courseA1.id });
    await request(app)
      .post(`/api/v1/exams/${s.body.data.id}/candidates`)
      .set(authHeader(managerA))
      .send({ studentIds: [student.id] });
    const { user: instructor } = await createUser({ role: 'instructor', branchIds: [a.id] });
    const asInstructor = await request(app).get(`/api/v1/exams/${s.body.data.id}/candidates`).set(authHeader(instructor));
    expect(asInstructor.status).toBe(200);
    expect(asInstructor.body.data[0].student.name).toBe(student.name);
    expect(asInstructor.body.data[0].student).not.toHaveProperty('phone');
    const asManager = await request(app).get(`/api/v1/exams/${s.body.data.id}/candidates`).set(authHeader(managerA));
    expect(asManager.body.data[0].student).toHaveProperty('phone');
  });

  it('ca thi đã hủy không nhập kết quả (409); không xóa ca đã có kết quả (409); thí sinh chưa có kết quả xóa được', async () => {
    const { app, a, courseA1, managerA } = await setup();
    const h = authHeader(managerA);
    const s = await request(app).post('/api/v1/exams').set(h).send(session(a.id, courseA1.id));
    const [x, y] = await Promise.all([
      createStudent({ branchId: a.id, courseId: courseA1.id }),
      createStudent({ branchId: a.id, courseId: courseA1.id }),
    ]);
    await request(app)
      .post(`/api/v1/exams/${s.body.data.id}/candidates`)
      .set(h)
      .send({ studentIds: [x.id, y.id] });
    const [cx, cy] = await ExamCandidate.find({ sessionId: s.body.data.id }).sort({ _id: 1 });
    expect((await request(app).delete(`/api/v1/exams/${s.body.data.id}/candidates/${cy!.id}`).set(h)).status).toBe(204);
    await request(app).patch(`/api/v1/exams/${s.body.data.id}/candidates/${cx!.id}`).set(h).send({ result: 'absent' });
    expect((await request(app).delete(`/api/v1/exams/${s.body.data.id}`).set(h)).status).toBe(409);
    await request(app).patch(`/api/v1/exams/${s.body.data.id}`).set(h).send({ status: 'cancelled' });
    expect(
      (await request(app).patch(`/api/v1/exams/${s.body.data.id}/candidates/${cx!.id}`).set(h).send({ result: 'passed' }))
        .status,
    ).toBe(409);
  });

  it('chi nhánh khác: tạo 403, đọc 404; giáo viên đọc được ca thi chi nhánh mình nhưng không tạo được', async () => {
    const { app, a, b, courseA1, managerA } = await setup();
    const { user: admin } = await createUser();
    const { user: teacher } = await createUser({ role: 'instructor', branchIds: [a.id] });
    expect(
      (await request(app).post('/api/v1/exams').set(authHeader(managerA)).send(session(b.id, courseA1.id))).status,
    ).toBe(403);
    const other = await request(app)
      .post('/api/v1/exams')
      .set(authHeader(admin))
      .send(session(b.id, courseA1.id, { code: 'SH-B' }));
    expect((await request(app).get(`/api/v1/exams/${other.body.data.id}`).set(authHeader(managerA))).status).toBe(404);
    await request(app).post('/api/v1/exams').set(authHeader(managerA)).send(session(a.id, courseA1.id));
    expect((await request(app).get('/api/v1/exams').set(authHeader(teacher))).body.meta.total).toBe(1);
    expect(
      (
        await request(app)
          .post('/api/v1/exams')
          .set(authHeader(teacher))
          .send(session(a.id, courseA1.id, { code: 'X' }))
      ).status,
    ).toBe(403);
  });

  it('GET /public/exams/upcoming: ca "scheduled" từ hôm nay (giờ VN), không lộ thí sinh/id', async () => {
    const { app, a, courseA1, managerA } = await setup();
    const h = authHeader(managerA);
    await request(app)
      .post('/api/v1/exams')
      .set(h)
      .send(session(a.id, courseA1.id, { code: 'HOM-NAY', date: day(0) }));
    await request(app)
      .post('/api/v1/exams')
      .set(h)
      .send(session(a.id, courseA1.id, { code: 'HOM-QUA', date: day(-1) }));
    await request(app)
      .post('/api/v1/exams')
      .set(h)
      .send(session(a.id, courseA1.id, { code: 'HUY', date: day(3), status: 'cancelled' }));
    await request(app)
      .post('/api/v1/exams')
      .set(h)
      .send(session(a.id, courseA1.id, { code: 'TUAN-SAU', date: day(7), type: 'graduation' }));
    const res = await request(app).get('/api/v1/public/exams/upcoming?branch=tan-ngai');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toEqual({
      type: 'official',
      course: { code: 'A1', name: 'Hạng A1' },
      branch: { name: 'Tân Ngãi', slug: 'tan-ngai' },
      date: `${day(0)}T00:00:00+07:00`,
      location: 'Sân sát hạch Tân Ngãi',
    });
  });

  it('ngày thi đã qua trong giờ VN thì không còn ở lịch công khai', async () => {
    const { app, a, courseA1, managerA } = await setup();
    await request(app)
      .post('/api/v1/exams')
      .set(authHeader(managerA))
      .send(session(a.id, courseA1.id, { date: '2026-10-05' }));
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-10-05T16:59:00Z')); // 23:59 ngày 05/10 giờ VN
      expect((await request(app).get('/api/v1/public/exams/upcoming')).body.data).toHaveLength(1);
      vi.setSystemTime(new Date('2026-10-05T17:00:00Z')); // 00:00 ngày 06/10 giờ VN
      expect((await request(app).get('/api/v1/public/exams/upcoming')).body.data).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
