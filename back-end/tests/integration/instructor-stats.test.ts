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

describe('GET /instructors/:id/stats', () => {
  it('đếm lớp, học viên, kết quả sát hạch của học viên các lớp giáo viên phụ trách', async () => {
    const a = await createBranch();
    const course = await createCourse({ code: 'B' });
    const { user: manager } = await createUser({ role: 'branch_manager', branchIds: [a.id] });
    const teacher = await createInstructor({ branchId: a.id });
    const ongoing = await createClass({ branchId: a.id, courseId: course.id, instructorId: teacher.id, status: 'ongoing' });
    await createClass({ branchId: a.id, courseId: course.id, instructorId: teacher.id, status: 'finished' });
    await createClass({ branchId: a.id, courseId: course.id });
    const [s1, s2, s3] = await Promise.all(
      [1, 2, 3].map(() => createStudent({ branchId: a.id, courseId: course.id, classId: ongoing.id })),
    );
    await createStudent({ branchId: a.id, courseId: course.id, classId: ongoing.id, status: 'dropped' });
    const official = await ExamSession.create({
      code: 'SH-1',
      type: 'official',
      courseId: course._id,
      courseCode: 'B',
      branchId: a._id,
      date: new Date(),
    });
    const graduation = await ExamSession.create({
      code: 'TN-1',
      type: 'graduation',
      courseId: course._id,
      courseCode: 'B',
      branchId: a._id,
      date: new Date(),
    });
    await ExamCandidate.create([
      { sessionId: official._id, studentId: s1!._id, result: 'passed', attempt: 1 },
      { sessionId: official._id, studentId: s2!._id, result: 'passed', attempt: 1 },
      { sessionId: official._id, studentId: s3!._id, result: 'failed', attempt: 1 },
      { sessionId: graduation._id, studentId: s3!._id, result: 'absent', attempt: 1 },
    ]);
    const res = await request(createApp()).get(`/api/v1/instructors/${teacher.id}/stats`).set(authHeader(manager));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      classes: { total: 2, active: 1 },
      students: 3,
      official: { passed: 2, failed: 1, absent: 0, passRate: 66.7 },
    });
  });

  it('chưa có kết quả → passRate null; giáo viên chi nhánh khác → 404', async () => {
    const [a, b] = await Promise.all([createBranch(), createBranch()]);
    const { user: manager } = await createUser({ role: 'branch_manager', branchIds: [a.id] });
    const mine = await createInstructor({ branchId: a.id });
    const other = await createInstructor({ branchId: b.id });
    const app = createApp();
    expect(
      (await request(app).get(`/api/v1/instructors/${mine.id}/stats`).set(authHeader(manager))).body.data.official.passRate,
    ).toBeNull();
    expect((await request(app).get(`/api/v1/instructors/${other.id}/stats`).set(authHeader(manager))).status).toBe(404);
  });
});
