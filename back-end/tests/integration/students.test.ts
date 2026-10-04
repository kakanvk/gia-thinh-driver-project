import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { Student } from '../../src/modules/students/student.model';
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
  const [courseB, courseA1] = await Promise.all([createCourse({ code: 'B' }), createCourse({ code: 'A1' })]);
  const { user: consultantA } = await createUser({ role: 'consultant', branchIds: [a.id] });
  const { user: managerA } = await createUser({ role: 'branch_manager', branchIds: [a.id] });
  return { app: createApp(), a, b, courseB, courseA1, consultantA, managerA };
}

const newStudent = (branchId: string, courseId: string, extra: Record<string, unknown> = {}) => ({
  name: 'Nguyễn Minh Anh',
  phone: '0903 412 869',
  dob: '2004-05-20',
  idNumber: '086204001234',
  address: 'Tân Ngãi, Vĩnh Long',
  courseId,
  branchId,
  ...extra,
});

describe('/students', () => {
  it('tư vấn viên tạo học viên: mã HV-yyMMdd-NN, mã gói, ngày nhập học mặc định hôm nay, có audit', async () => {
    const { app, a, courseB, consultantA } = await setup();
    const res = await request(app).post('/api/v1/students').set(authHeader(consultantA)).send(newStudent(a.id, courseB.id));
    expect(res.status).toBe(201);
    expect(res.body.data.code).toMatch(/^HV-\d{6}-\d{2,}$/);
    expect(res.body.data).toMatchObject({
      phone: '0903412869',
      courseCode: 'B',
      status: 'studying',
      classId: null,
      dob: '2004-05-20T00:00:00+07:00',
    });
    expect(res.body.data.enrolledAt).toMatch(/T00:00:00\+07:00$/);
    expect(await AuditLog.countDocuments({ action: 'student.create' })).toBe(1);
  });

  it('400: CCCD không đủ 12 số; 409: trùng CCCD; 403: chi nhánh khác', async () => {
    const { app, a, b, courseB, consultantA } = await setup();
    const h = authHeader(consultantA);
    expect(
      (
        await request(app)
          .post('/api/v1/students')
          .set(h)
          .send(newStudent(a.id, courseB.id, { idNumber: '123' }))
      ).status,
    ).toBe(400);
    await Student.init();
    await request(app).post('/api/v1/students').set(h).send(newStudent(a.id, courseB.id));
    expect(
      (
        await request(app)
          .post('/api/v1/students')
          .set(h)
          .send(newStudent(a.id, courseB.id, { phone: '0909000000' }))
      ).status,
    ).toBe(409);
    const other = await request(app)
      .post('/api/v1/students')
      .set(h)
      .send(newStudent(b.id, courseB.id, { idNumber: '086204009999' }));
    expect(other.body.error.code).toBe('BRANCH_FORBIDDEN');
  });

  it('xếp lớp: cùng chi nhánh + cùng gói + lớp chưa kết thúc + còn chỗ', async () => {
    const { app, a, b, courseB, courseA1, consultantA } = await setup();
    const student = await createStudent({ branchId: a.id, courseId: courseB.id });
    const full = await createClass({ branchId: a.id, courseId: courseB.id, capacity: 1 });
    await createStudent({ branchId: a.id, courseId: courseB.id, classId: full.id });
    const wrongCourse = await createClass({ branchId: a.id, courseId: courseA1.id });
    const finished = await createClass({ branchId: a.id, courseId: courseB.id, status: 'finished' });
    const otherBranch = await createClass({ branchId: b.id, courseId: courseB.id });
    const ok = await createClass({ branchId: a.id, courseId: courseB.id, capacity: 2 });
    const url = `/api/v1/students/${student.id}/class`;
    const h = authHeader(consultantA);
    expect((await request(app).patch(url).set(h).send({ classId: full.id })).status).toBe(409);
    expect((await request(app).patch(url).set(h).send({ classId: wrongCourse.id })).status).toBe(400);
    expect((await request(app).patch(url).set(h).send({ classId: finished.id })).status).toBe(409);
    expect((await request(app).patch(url).set(h).send({ classId: otherBranch.id })).status).toBe(404);
    const assigned = await request(app).patch(url).set(h).send({ classId: ok.id });
    expect(assigned.body.data.classId).toBe(ok.id);
    expect(await AuditLog.countDocuments({ action: 'student.class' })).toBe(1);
    expect((await request(app).patch(url).set(h).send({ classId: null })).body.data.classId).toBeNull();
  });

  it('409: đổi trạng thái dropped -> studying khi lớp đã đủ chỗ hoặc đã kết thúc', async () => {
    const { app, a, courseB, consultantA } = await setup();
    const h = authHeader(consultantA);
    const cls = await createClass({ branchId: a.id, courseId: courseB.id, capacity: 1 });
    const dropped = await createStudent({ branchId: a.id, courseId: courseB.id, classId: cls.id, status: 'dropped' });
    await createStudent({ branchId: a.id, courseId: courseB.id, classId: cls.id });
    const url = `/api/v1/students/${dropped.id}`;
    expect((await request(app).patch(url).set(h).send({ status: 'studying' })).status).toBe(409);
    expect((await Student.findById(dropped.id))?.status).toBe('dropped');
    expect((await request(app).patch(url).set(h).send({ note: 'ghi chú' })).status).toBe(200);

    const done = await createClass({ branchId: a.id, courseId: courseB.id, status: 'finished' });
    const inFinished = await createStudent({
      branchId: a.id,
      courseId: courseB.id,
      classId: done.id,
      status: 'dropped',
    });
    expect((await request(app).patch(`/api/v1/students/${inFinished.id}`).set(h).send({ status: 'paused' })).status).toBe(
      409,
    );

    const roomy = await createClass({ branchId: a.id, courseId: courseB.id, capacity: 2 });
    const ok = await createStudent({ branchId: a.id, courseId: courseB.id, classId: roomy.id, status: 'dropped' });
    expect((await request(app).patch(`/api/v1/students/${ok.id}`).set(h).send({ status: 'studying' })).status).toBe(200);
  });

  it('giáo viên chỉ thấy học viên lớp mình, không có CCCD/địa chỉ/ngày sinh; không sửa được', async () => {
    const { app, a, courseB } = await setup();
    const { user: teacherUser } = await createUser({ role: 'instructor', branchIds: [a.id] });
    const profile = await createInstructor({ branchId: a.id, userId: teacherUser.id });
    const myClass = await createClass({ branchId: a.id, courseId: courseB.id, instructorId: profile.id });
    const mine = await createStudent({
      branchId: a.id,
      courseId: courseB.id,
      classId: myClass.id,
      idNumber: '086204001111',
    });
    const notMine = await createStudent({ branchId: a.id, courseId: courseB.id });
    const h = authHeader(teacherUser);
    const list = await request(app).get('/api/v1/students').set(h);
    expect(list.body.data.map((s: { id: string }) => s.id)).toEqual([mine.id]);
    expect(list.body.data[0]).not.toHaveProperty('idNumber');
    expect(list.body.data[0]).not.toHaveProperty('address');
    expect(list.body.data[0]).not.toHaveProperty('dob');
    expect((await request(app).get(`/api/v1/students/${notMine.id}`).set(h)).status).toBe(404);
    expect((await request(app).patch(`/api/v1/students/${mine.id}`).set(h).send({ name: 'Đổi tên' })).status).toBe(403);
    const roster = await request(app).get(`/api/v1/classes/${myClass.id}/students`).set(h);
    expect(roster.body.data.map((s: { id: string }) => s.id)).toEqual([mine.id]);
  });

  it('lọc theo trạng thái, lớp, q (tên/SĐT/mã/CCCD); sửa; PATCH rỗng 400; tư vấn viên không xóa được, quản lý xóa mềm', async () => {
    const { app, a, courseB, consultantA, managerA } = await setup();
    const student = await createStudent({
      branchId: a.id,
      courseId: courseB.id,
      name: 'Lê Hoài Thương',
      idNumber: '086204007777',
    });
    await createStudent({ branchId: a.id, courseId: courseB.id, status: 'paused' });
    const h = authHeader(consultantA);
    expect((await request(app).get('/api/v1/students?status=paused').set(h)).body.meta.total).toBe(1);
    expect((await request(app).get('/api/v1/students?q=086204007777').set(h)).body.data[0].id).toBe(student.id);
    expect(
      (await request(app).patch(`/api/v1/students/${student.id}`).set(h).send({ status: 'dropped', note: 'Chuyển nơi ở' }))
        .body.data.status,
    ).toBe('dropped');
    expect((await request(app).patch(`/api/v1/students/${student.id}`).set(h).send({})).status).toBe(400);
    expect((await request(app).delete(`/api/v1/students/${student.id}`).set(h)).status).toBe(403);
    expect((await request(app).delete(`/api/v1/students/${student.id}`).set(authHeader(managerA))).status).toBe(204);
    expect((await request(app).get(`/api/v1/students/${student.id}`).set(h)).status).toBe(404);
  });
});
