import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import { ExamCandidate } from '../../src/modules/exams/exam-candidate.model';
import { ExamSession } from '../../src/modules/exams/exam-session.model';
import { LeadActivity } from '../../src/modules/leads/lead-activity.model';
import { Lead } from '../../src/modules/leads/lead.model';
import { Student } from '../../src/modules/students/student.model';
import { TrainingClass } from '../../src/modules/classes/class.model';
import { Vehicle } from '../../src/modules/vehicles/vehicle.model';
import { formatVn } from '../../src/shared/time';
import {
  authHeader,
  createBranch,
  createClass,
  createCourse,
  createInstructor,
  createLead,
  createStudent,
  createUser,
} from '../helpers/factories';

const day = (offset: number) => formatVn(new Date(Date.now() + offset * 86_400_000), 'yyyy-MM-dd');

async function setup() {
  const [a, b] = await Promise.all([
    createBranch({ name: 'Tân Ngãi', slug: 'tan-ngai' }),
    createBranch({ name: 'B', slug: 'b' }),
  ]);
  const course = await createCourse({ code: 'B', name: 'Hạng B' });
  const { user: admin } = await createUser({ role: 'super_admin' });
  return { app: createApp(), a, b, course, admin, h: authHeader(admin) };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('1. sort allowlist', () => {
  it('students: sort ngoài danh sách → 400; sort=-name → 200', async () => {
    const { app, h } = await setup();
    expect((await request(app).get('/api/v1/students?sort=idNumber').set(h)).status).toBe(400);
    expect((await request(app).get('/api/v1/students?sort=-name').set(h)).status).toBe(200);
    expect((await request(app).get('/api/v1/students?sort=name,idNumber').set(h)).status).toBe(400);
    expect((await request(app).get('/api/v1/students?sort=address.city').set(h)).status).toBe(400);
  });
  it('users: sort=passwordHash → 400', async () => {
    const { app, h } = await setup();
    expect((await request(app).get('/api/v1/users?sort=passwordHash').set(h)).status).toBe(400);
    expect((await request(app).get('/api/v1/users?sort=-lastLoginAt').set(h)).status).toBe(200);
  });
});

describe('2. thi sát hạch đậu chỉ hoàn thành học viên đang học/tạm dừng', () => {
  it('dropped giữ nguyên, paused → completed', async () => {
    const { app, a, course, h } = await setup();
    const exam = await request(app)
      .post('/api/v1/exams')
      .set(h)
      .send({ code: 'sh-1', type: 'official', courseId: course.id, branchId: a.id, date: day(7) });
    const dropped = await createStudent({ branchId: a.id, courseId: course.id });
    const paused = await createStudent({ branchId: a.id, courseId: course.id, status: 'paused' });
    await ExamCandidate.create({ sessionId: exam.body.data.id, studentId: dropped._id, attempt: 1 });
    await ExamCandidate.create({ sessionId: exam.body.data.id, studentId: paused._id, attempt: 1 });
    await Student.updateOne({ _id: dropped._id }, { status: 'dropped' });
    for (const s of [dropped, paused]) {
      const cand = await ExamCandidate.findOne({ studentId: s._id });
      const res = await request(app)
        .patch(`/api/v1/exams/${exam.body.data.id}/candidates/${cand!.id}`)
        .set(h)
        .send({ result: 'passed' });
      expect(res.status).toBe(200);
    }
    expect((await Student.findById(dropped.id))?.status).toBe('dropped');
    expect((await Student.findById(paused.id))?.status).toBe('completed');
  });
});

describe('3. convert robustness', () => {
  it('Lead.findOneAndUpdate lỗi → 500 và không còn học viên', async () => {
    const { app, a, course, h } = await setup();
    const lead = await createLead({ branchId: a.id, status: 'deposited' });
    vi.spyOn(Lead, 'findOneAndUpdate').mockRejectedValueOnce(new Error('db down'));
    const res = await request(app).post(`/api/v1/leads/${lead.id}/convert`).set(h).send({ courseId: course.id });
    expect(res.status).toBe(500);
    expect(await Student.countDocuments({ leadId: lead._id })).toBe(0);
  });
  it('addActivity lỗi sau khi nhập học → vẫn 201', async () => {
    const { app, a, course, h } = await setup();
    const lead = await createLead({ branchId: a.id, status: 'deposited' });
    vi.spyOn(LeadActivity, 'create').mockRejectedValueOnce(new Error('activity down'));
    const res = await request(app).post(`/api/v1/leads/${lead.id}/convert`).set(h).send({ courseId: course.id });
    expect(res.status).toBe(201);
    expect((await Lead.findById(lead.id))?.status).toBe('enrolled');
    expect(await Student.countDocuments({ leadId: lead._id })).toBe(1);
  });
});

describe('4. xóa học viên', () => {
  it('khách trở lại docs_completed, chuyển lại được; thí sinh pending bị xóa, đã có kết quả giữ', async () => {
    const { app, a, course, h } = await setup();
    const lead = await createLead({ branchId: a.id, status: 'deposited' });
    const conv = await request(app).post(`/api/v1/leads/${lead.id}/convert`).set(h).send({ courseId: course.id });
    const studentId = conv.body.data.student.id as string;
    const exam = await ExamSession.create({
      code: 'SH-X',
      type: 'graduation',
      courseId: course.id,
      courseCode: 'B',
      branchId: a.id,
      date: new Date(Date.now() + 86_400_000),
    });
    const exam2 = await ExamSession.create({
      code: 'SH-Y',
      type: 'graduation',
      courseId: course.id,
      courseCode: 'B',
      branchId: a.id,
      date: new Date(Date.now() + 2 * 86_400_000),
    });
    await ExamCandidate.create({ sessionId: exam._id, studentId, attempt: 1 });
    await ExamCandidate.create({ sessionId: exam2._id, studentId, attempt: 2, result: 'failed' });
    expect((await request(app).delete(`/api/v1/students/${studentId}`).set(h)).status).toBe(204);
    const after = await Lead.findById(lead.id);
    expect(after?.status).toBe('docs_completed');
    expect(after?.studentId).toBeNull();
    expect(await ExamCandidate.countDocuments({ studentId })).toBe(1);
    expect((await ExamCandidate.findOne({ studentId }))?.result).toBe('failed');
    const again = await request(app).post(`/api/v1/leads/${lead.id}/convert`).set(h).send({ courseId: course.id });
    expect(again.status).toBe(201);
  });
});

describe('4b. xóa học viên khi ghi hoạt động lỗi', () => {
  it('addActivity lỗi → vẫn 204, học viên xóa, khách đã hoàn lại', async () => {
    const { app, a, course, h } = await setup();
    const lead = await createLead({ branchId: a.id, status: 'deposited' });
    const conv = await request(app).post(`/api/v1/leads/${lead.id}/convert`).set(h).send({ courseId: course.id });
    vi.spyOn(LeadActivity, 'create').mockRejectedValueOnce(new Error('activity down'));
    expect((await request(app).delete(`/api/v1/students/${conv.body.data.student.id}`).set(h)).status).toBe(204);
    expect(await Student.countDocuments({ _id: conv.body.data.student.id })).toBe(0);
    expect((await Lead.findById(lead.id))?.status).toBe('docs_completed');
  });
});

describe('5. đổi mã gói', () => {
  it('đang dùng → 409 khi đổi mã; đổi tên 200; không dùng → 200', async () => {
    const { app, a, course, h } = await setup();
    await createClass({ branchId: a.id, courseId: course.id });
    expect((await request(app).patch(`/api/v1/courses/${course.id}`).set(h).send({ code: 'B2' })).status).toBe(409);
    expect((await request(app).patch(`/api/v1/courses/${course.id}`).set(h).send({ name: 'Mới' })).status).toBe(200);
    const free = await createCourse({ code: 'FREE' });
    expect((await request(app).patch(`/api/v1/courses/${free.id}`).set(h).send({ code: 'FREE2' })).status).toBe(200);
  });
  it('xe dùng mã gói → 409', async () => {
    const { app, a, h } = await setup();
    const c = await createCourse({ code: 'XE' });
    await Vehicle.create({ plate: '65A-00001', model: 'Vios', courseCode: 'XE', branchId: a.id });
    expect((await request(app).patch(`/api/v1/courses/${c.id}`).set(h).send({ code: 'XE2' })).status).toBe(409);
  });
});

describe('6. xóa lớp', () => {
  it('chỉ có học viên dropped → 204 và classId null; có học viên đang học → 409', async () => {
    const { app, a, course, h } = await setup();
    const cls = await createClass({ branchId: a.id, courseId: course.id });
    const dropped = await createStudent({ branchId: a.id, courseId: course.id, classId: cls.id, status: 'dropped' });
    expect((await request(app).delete(`/api/v1/classes/${cls.id}`).set(h)).status).toBe(204);
    expect((await Student.findById(dropped.id))?.classId).toBeNull();
    const cls2 = await createClass({ branchId: a.id, courseId: course.id });
    await createStudent({ branchId: a.id, courseId: course.id, classId: cls2.id });
    expect((await request(app).delete(`/api/v1/classes/${cls2.id}`).set(h)).status).toBe(409);
  });
});

describe('7. giáo viên inactive', () => {
  it('có lớp đang hoạt động → 409 khi inactive; on_leave vẫn được', async () => {
    const { app, a, course, h } = await setup();
    const teacher = await createInstructor({ branchId: a.id });
    await createClass({ branchId: a.id, courseId: course.id, instructorId: teacher.id });
    expect((await request(app).patch(`/api/v1/instructors/${teacher.id}`).set(h).send({ status: 'inactive' })).status).toBe(
      409,
    );
    expect((await request(app).patch(`/api/v1/instructors/${teacher.id}`).set(h).send({ status: 'on_leave' })).status).toBe(
      200,
    );
  });
});

describe('7b. giáo viên chỉ có lớp đã kết thúc', () => {
  it('inactive → 200', async () => {
    const { app, a, course, h } = await setup();
    const teacher = await createInstructor({ branchId: a.id });
    await createClass({ branchId: a.id, courseId: course.id, instructorId: teacher.id, status: 'finished' });
    expect((await request(app).patch(`/api/v1/instructors/${teacher.id}`).set(h).send({ status: 'inactive' })).status).toBe(
      200,
    );
  });
});

describe('8. đổi chi nhánh khách đã nhập học', () => {
  it('→ 409', async () => {
    const { app, a, b, h } = await setup();
    const lead = await createLead({ branchId: a.id, status: 'enrolled' });
    const res = await request(app).patch(`/api/v1/leads/${lead.id}`).set(h).send({ branchId: b.id });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Khách đã nhập học, không thể chuyển chi nhánh');
  });
});

describe('9. dùng lại mã sau xóa mềm', () => {
  it('CCCD học viên', async () => {
    const { app, a, course, h } = await setup();
    const body = {
      name: 'Nguyễn Văn A',
      phone: '0903412869',
      idNumber: '086204001234',
      courseId: course.id,
      branchId: a.id,
    };
    const first = await request(app).post('/api/v1/students').set(h).send(body);
    expect(first.status).toBe(201);
    await Student.init();
    expect((await request(app).delete(`/api/v1/students/${first.body.data.id}`).set(h)).status).toBe(204);
    expect((await request(app).post('/api/v1/students').set(h).send(body)).status).toBe(201);
  });
  it('mã lớp', async () => {
    const { app, a, course, h } = await setup();
    await TrainingClass.init();
    const body = {
      code: 'LOP-A',
      courseId: course.id,
      branchId: a.id,
      startDate: day(10),
      endDate: day(38),
      scheduleText: 'T2',
      capacity: 10,
    };
    const first = await request(app).post('/api/v1/classes').set(h).send(body);
    expect(first.status).toBe(201);
    expect((await request(app).delete(`/api/v1/classes/${first.body.data.id}`).set(h)).status).toBe(204);
    expect((await request(app).post('/api/v1/classes').set(h).send(body)).status).toBe(201);
  });
  it('mã ca thi', async () => {
    const { app, a, course, h } = await setup();
    await ExamSession.init();
    const body = { code: 'sh-9', type: 'official', courseId: course.id, branchId: a.id, date: day(7) };
    const first = await request(app).post('/api/v1/exams').set(h).send(body);
    expect(first.status).toBe(201);
    expect((await request(app).delete(`/api/v1/exams/${first.body.data.id}`).set(h)).status).toBe(204);
    expect((await request(app).post('/api/v1/exams').set(h).send(body)).status).toBe(201);
  });
});

describe('10. public lists', () => {
  it('lớp của gói ngừng bán không hiện', async () => {
    const { app, a } = await setup();
    const off = await createCourse({ code: 'OFF', active: false });
    await createClass({ branchId: a.id, courseId: off.id });
    const res = await request(app).get('/api/v1/public/classes/upcoming');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
  it('ca thi của gói ngừng bán không hiện; lớp cũng vậy', async () => {
    const { app, a } = await setup();
    const off = await createCourse({ code: 'OFF', active: false });
    await ExamSession.create({
      code: 'SH-OFF',
      type: 'official',
      courseId: off.id,
      courseCode: 'OFF',
      branchId: a.id,
      date: new Date(Date.now() + 86_400_000),
    });
    const res = await request(app).get('/api/v1/public/exams/upcoming');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
  it('gói ngừng bán không chiếm chỗ trong giới hạn 50', async () => {
    const { app, a, course } = await setup();
    const off = await createCourse({ code: 'OFF', active: false });
    await ExamSession.insertMany(
      Array.from({ length: 51 }, (_, i) => ({
        code: `OFF-${i}`,
        type: 'official',
        courseId: off._id,
        courseCode: 'OFF',
        branchId: a._id,
        date: new Date(Date.now() + 86_400_000),
      })),
    );
    await ExamSession.create({
      code: 'OK-1',
      type: 'official',
      courseId: course._id,
      courseCode: 'B',
      branchId: a._id,
      date: new Date(Date.now() + 5 * 86_400_000),
    });
    const res = await request(app).get('/api/v1/public/exams/upcoming');
    expect(res.body.data).toHaveLength(1);
  });
});
