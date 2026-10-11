import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { ExamCandidate } from '../../src/modules/exams/exam-candidate.model';
import { ExamSession } from '../../src/modules/exams/exam-session.model';
import {
  authHeader,
  createBranch,
  createClass,
  createCourse,
  createInstructor,
  createStudent,
  createUser,
} from '../helpers/factories';

async function setup() {
  const [a, b] = await Promise.all([createBranch({ name: 'A' }), createBranch({ name: 'B' })]);
  const course = await createCourse({ code: 'B', name: 'Hạng B' });
  const { user: managerA } = await createUser({ role: 'branch_manager', branchIds: [a.id] });
  const { user: consultantA } = await createUser({ role: 'consultant', branchIds: [a.id] });
  return { app: createApp(), a, b, course, managerA, consultantA };
}

async function createSession(
  branchId: string,
  courseId: string,
  extra: Partial<{ code: string; type: 'graduation' | 'official'; date: Date; location: string | null }>,
) {
  return ExamSession.create({
    code: extra.code ?? 'SH-1',
    type: extra.type ?? 'official',
    courseId,
    courseCode: 'B',
    branchId,
    date: extra.date ?? new Date('2026-10-20T00:30:00.000Z'),
    location: extra.location ?? null,
    status: 'scheduled',
  });
}

describe('GET /students/:id/exams', () => {
  it('trả các lần thi của học viên, đúng shape, sắp ngày thi giảm dần', async () => {
    const { app, a, course, managerA } = await setup();
    const student = await createStudent({ branchId: a.id, courseId: course.id });
    const other = await createStudent({ branchId: a.id, courseId: course.id });
    const grad = await createSession(a.id, course.id, {
      code: 'TN-2610-01',
      type: 'graduation',
      date: new Date('2026-10-05T01:00:00.000Z'),
      location: 'Sân trường',
    });
    const official = await createSession(a.id, course.id, {
      code: 'SH-2610-01',
      type: 'official',
      date: new Date('2026-10-20T00:30:00.000Z'),
      location: 'Sân sát hạch',
    });
    const c1 = await ExamCandidate.create({
      sessionId: grad._id,
      studentId: student._id,
      result: 'passed',
      score: 92,
      attempt: 1,
      note: 'Tốt',
    });
    const c2 = await ExamCandidate.create({
      sessionId: official._id,
      studentId: student._id,
      result: 'pending',
      score: null,
      attempt: 1,
    });
    await ExamCandidate.create({ sessionId: official._id, studentId: other._id, result: 'pending', attempt: 1 });

    const res = await request(app).get(`/api/v1/students/${student.id}/exams`).set(authHeader(managerA));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      {
        candidateId: c2.id,
        sessionId: official.id,
        sessionCode: 'SH-2610-01',
        type: 'official',
        date: '2026-10-20T07:30:00+07:00',
        location: 'Sân sát hạch',
        courseCode: 'B',
        result: 'pending',
        score: null,
        attempt: 1,
        note: null,
      },
      {
        candidateId: c1.id,
        sessionId: grad.id,
        sessionCode: 'TN-2610-01',
        type: 'graduation',
        date: '2026-10-05T08:00:00+07:00',
        location: 'Sân trường',
        courseCode: 'B',
        result: 'passed',
        score: 92,
        attempt: 1,
        note: 'Tốt',
      },
    ]);
  });

  it('học viên chưa thi → mảng rỗng', async () => {
    const { app, a, course, managerA } = await setup();
    const student = await createStudent({ branchId: a.id, courseId: course.id });
    const res = await request(app).get(`/api/v1/students/${student.id}/exams`).set(authHeader(managerA));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('học viên chi nhánh khác → 404; id sai → 400', async () => {
    const { app, b, course, managerA } = await setup();
    const studentB = await createStudent({ branchId: b.id, courseId: course.id });
    expect((await request(app).get(`/api/v1/students/${studentB.id}/exams`).set(authHeader(managerA))).status).toBe(404);
    expect((await request(app).get('/api/v1/students/abc/exams').set(authHeader(managerA))).status).toBe(400);
  });

  it('tư vấn viên (không có exam.read) → 403; chưa đăng nhập → 401', async () => {
    const { app, a, course, consultantA } = await setup();
    const student = await createStudent({ branchId: a.id, courseId: course.id });
    expect((await request(app).get(`/api/v1/students/${student.id}/exams`).set(authHeader(consultantA))).status).toBe(403);
    expect((await request(app).get(`/api/v1/students/${student.id}/exams`)).status).toBe(401);
  });

  it('tài khoản giáo viên chỉ xem học viên lớp mình', async () => {
    const { app, a, course } = await setup();
    const { user: teacherUser } = await createUser({ role: 'instructor', branchIds: [a.id] });
    const profile = await createInstructor({ branchId: a.id, userId: teacherUser.id });
    const myClass = await createClass({ branchId: a.id, courseId: course.id, instructorId: profile.id });
    const mine = await createStudent({ branchId: a.id, courseId: course.id, classId: myClass.id });
    const notMine = await createStudent({ branchId: a.id, courseId: course.id });
    const session = await createSession(a.id, course.id, { code: 'SH-2610-02' });
    await ExamCandidate.create({ sessionId: session._id, studentId: mine._id, result: 'failed', score: 70, attempt: 1 });
    const h = authHeader(teacherUser);
    const res = await request(app).get(`/api/v1/students/${mine.id}/exams`).set(h);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ sessionId: session.id, result: 'failed', score: 70 });
    expect((await request(app).get(`/api/v1/students/${notMine.id}/exams`).set(h)).status).toBe(404);
  });
});
