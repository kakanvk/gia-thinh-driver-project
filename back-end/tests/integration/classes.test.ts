import mongoose from 'mongoose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { formatVn } from '../../src/shared/time';
import { authHeader, createBranch, createClass, createCourse, createInstructor, createUser } from '../helpers/factories';

const day = (offset: number) => formatVn(new Date(Date.now() + offset * 86_400_000), 'yyyy-MM-dd');

async function setup() {
  const [a, b] = await Promise.all([
    createBranch({ name: 'Tân Ngãi', slug: 'tan-ngai' }),
    createBranch({ name: 'B', slug: 'b' }),
  ]);
  const course = await createCourse({ code: 'B', name: 'Hạng B', vehicleType: 'car' });
  const { user: managerA } = await createUser({ role: 'branch_manager', branchIds: [a.id] });
  const teacher = await createInstructor({ branchId: a.id, name: 'Trần Quốc Hưng' });
  return { app: createApp(), a, b, course, managerA, teacher };
}

const newClass = (branchId: string, courseId: string, extra: Record<string, unknown> = {}) => ({
  code: 'b-td-2610',
  courseId,
  transmission: 'automatic',
  branchId,
  startDate: day(10),
  endDate: day(38),
  scheduleText: 'T2–T7 · 13:30',
  capacity: 50,
  ...extra,
});

describe('/classes', () => {
  it('tạo lớp: mã viết hoa, lưu mã gói, giáo viên cùng chi nhánh, có audit; trả filled/seatsLeft', async () => {
    const { app, a, course, managerA, teacher } = await setup();
    const res = await request(app)
      .post('/api/v1/classes')
      .set(authHeader(managerA))
      .send(newClass(a.id, course.id, { instructorId: teacher.id }));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      code: 'B-TD-2610',
      courseCode: 'B',
      status: 'enrolling',
      filled: 0,
      seatsLeft: 50,
    });
    expect(res.body.data.instructor).toEqual({ id: teacher.id, name: 'Trần Quốc Hưng' });
    expect(await AuditLog.countDocuments({ action: 'class.create' })).toBe(1);
  });

  it('400: ngày kết thúc trước ngày khai giảng, giáo viên chi nhánh khác; 409 trùng mã', async () => {
    const { app, a, b, course, managerA } = await setup();
    const otherTeacher = await createInstructor({ branchId: b.id });
    const h = authHeader(managerA);
    expect(
      (
        await request(app)
          .post('/api/v1/classes')
          .set(h)
          .send(newClass(a.id, course.id, { endDate: day(5) }))
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/v1/classes')
          .set(h)
          .send(newClass(a.id, course.id, { instructorId: otherTeacher.id }))
      ).status,
    ).toBe(400);
    await request(app).post('/api/v1/classes').set(h).send(newClass(a.id, course.id));
    expect((await request(app).post('/api/v1/classes').set(h).send(newClass(a.id, course.id))).status).toBe(409);
  });

  it('filled đếm học viên studying/paused/completed của lớp (không đếm dropped)', async () => {
    const { app, a, course, managerA } = await setup();
    const cls = await createClass({ branchId: a.id, courseId: course.id, capacity: 3 });
    const students = mongoose.connection.collection('students');
    await students.insertMany(
      ['studying', 'paused', 'completed', 'dropped'].map((status, i) => ({
        code: `HV-T-${i}`,
        name: `HV ${i}`,
        phone: `090000000${i}`,
        classId: cls._id,
        branchId: cls.branchId,
        courseId: cls.courseId,
        status,
        deletedAt: null,
      })),
    );
    const res = await request(app).get(`/api/v1/classes/${cls.id}`).set(authHeader(managerA));
    expect(res.body.data).toMatchObject({ filled: 3, seatsLeft: 0 });
  });

  it('giáo viên (vai trò instructor) chỉ thấy lớp mình phụ trách', async () => {
    const { app, a, course } = await setup();
    const { user: teacherUser } = await createUser({ role: 'instructor', branchIds: [a.id] });
    const mine = await createInstructor({ branchId: a.id, userId: teacherUser.id });
    const myClass = await createClass({ branchId: a.id, courseId: course.id, instructorId: mine.id, code: 'CUA-TOI' });
    const other = await createClass({ branchId: a.id, courseId: course.id, code: 'LOP-KHAC' });
    const h = authHeader(teacherUser);
    const list = await request(app).get('/api/v1/classes').set(h);
    expect(list.body.data.map((c: { code: string }) => c.code)).toEqual(['CUA-TOI']);
    expect((await request(app).get(`/api/v1/classes/${other.id}`).set(h)).status).toBe(404);
    expect((await request(app).post('/api/v1/classes').set(h).send(newClass(a.id, course.id))).status).toBe(403);
    expect(myClass.id).toBeTruthy();
  });

  it('xóa lớp còn học viên → 409; xóa giáo viên còn lớp đang hoạt động → 409', async () => {
    const { app, a, course, managerA, teacher } = await setup();
    const cls = await createClass({ branchId: a.id, courseId: course.id, instructorId: teacher.id });
    await mongoose.connection
      .collection('students')
      .insertOne({ code: 'HV-X', classId: cls._id, status: 'studying', deletedAt: null });
    const h = authHeader(managerA);
    expect((await request(app).delete(`/api/v1/classes/${cls.id}`).set(h)).status).toBe(409);
    expect((await request(app).delete(`/api/v1/instructors/${teacher.id}`).set(h)).status).toBe(409);
  });

  it('GET /public/classes/upcoming: chỉ lớp enrolling/upcoming, theo ngày khai giảng, lọc chi nhánh/hạng, không lộ id nội bộ', async () => {
    const { app, a, b, course } = await setup();
    await createClass({
      branchId: a.id,
      courseId: course.id,
      code: 'SAU',
      startDate: new Date(Date.now() + 20 * 86_400_000),
    });
    await createClass({
      branchId: a.id,
      courseId: course.id,
      code: 'TRUOC',
      status: 'upcoming',
      startDate: new Date(Date.now() + 5 * 86_400_000),
      capacity: 40,
    });
    await createClass({ branchId: a.id, courseId: course.id, code: 'DANG-HOC', status: 'ongoing' });
    await createClass({ branchId: b.id, courseId: course.id, code: 'CUA-B' });
    const res = await request(app).get('/api/v1/public/classes/upcoming?branch=tan-ngai&course=b');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toMatchObject({
      course: { code: 'B', name: 'Hạng B' },
      branch: { name: 'Tân Ngãi', slug: 'tan-ngai' },
      status: 'upcoming',
      seatsLeft: 40,
      scheduleText: 'T2–T6 · 08:00',
    });
    expect(res.body.data[0]).not.toHaveProperty('id');
    expect(res.body.data[0]).not.toHaveProperty('instructorId');
    expect((await request(app).get('/api/v1/public/classes/upcoming')).body.data).toHaveLength(3);
  });
});
