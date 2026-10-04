import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { LeadActivity } from '../../src/modules/leads/lead-activity.model';
import { Lead } from '../../src/modules/leads/lead.model';
import { Student } from '../../src/modules/students/student.model';
import { authHeader, createBranch, createClass, createCourse, createLead, createUser } from '../helpers/factories';

async function setup() {
  const [a, b] = await Promise.all([createBranch({ name: 'A' }), createBranch({ name: 'B' })]);
  const course = await createCourse({ code: 'B' });
  const { user: consultantA } = await createUser({ role: 'consultant', branchIds: [a.id] });
  return { app: createApp(), a, b, course, consultantA };
}

describe('POST /leads/:id/convert', () => {
  it('khách đã đặt cọc → tạo học viên (lấy tên/SĐT/chi nhánh/gói), xếp lớp, khách "enrolled", có hoạt động', async () => {
    const { app, a, course, consultantA } = await setup();
    const lead = await createLead({ branchId: a.id, name: 'Phạm Gia Huy', phone: '0918440327', status: 'deposited' });
    await Lead.updateOne({ _id: lead._id }, { courseId: course._id, courseCode: 'B' });
    const cls = await createClass({ branchId: a.id, courseId: course.id });
    const res = await request(app)
      .post(`/api/v1/leads/${lead.id}/convert`)
      .set(authHeader(consultantA))
      .send({ classId: cls.id, idNumber: '086204005555', dob: '2003-01-15' });
    expect(res.status).toBe(201);
    expect(res.body.data.student).toMatchObject({
      name: 'Phạm Gia Huy',
      phone: '0918440327',
      courseCode: 'B',
      classId: cls.id,
      leadId: lead.id,
      branchId: a.id,
    });
    expect(res.body.data.lead).toMatchObject({ status: 'enrolled', studentId: res.body.data.student.id });
    const activity = await LeadActivity.findOne({ leadId: lead._id, type: 'status_change', toStatus: 'enrolled' });
    expect(activity?.content).toContain(res.body.data.student.code);
  });

  it('khách chưa chọn gói thì phải gửi courseId; khách "new"/"lost"/"enrolled" → 409', async () => {
    const { app, a, course, consultantA } = await setup();
    const noCourse = await createLead({ branchId: a.id, status: 'docs_completed' });
    const h = authHeader(consultantA);
    expect((await request(app).post(`/api/v1/leads/${noCourse.id}/convert`).set(h).send({})).status).toBe(400);
    expect(
      (await request(app).post(`/api/v1/leads/${noCourse.id}/convert`).set(h).send({ courseId: course.id })).status,
    ).toBe(201);
    for (const status of ['new', 'lost'] as const) {
      const lead = await createLead({ branchId: a.id, status });
      expect((await request(app).post(`/api/v1/leads/${lead.id}/convert`).set(h).send({ courseId: course.id })).status).toBe(
        409,
      );
    }
    expect(
      (await request(app).post(`/api/v1/leads/${noCourse.id}/convert`).set(h).send({ courseId: course.id })).status,
    ).toBe(409);
  });

  it('chuyển đồng thời 2 lần → chỉ 1 học viên', async () => {
    const { app, a, course, consultantA } = await setup();
    const lead = await createLead({ branchId: a.id, status: 'deposited' });
    const h = authHeader(consultantA);
    const results = await Promise.all([
      request(app).post(`/api/v1/leads/${lead.id}/convert`).set(h).send({ courseId: course.id }),
      request(app).post(`/api/v1/leads/${lead.id}/convert`).set(h).send({ courseId: course.id }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await Student.countDocuments({ leadId: lead._id })).toBe(1);
  });

  it('khách chi nhánh khác → 404; lớp đầy → 409 và không tạo học viên', async () => {
    const { app, a, b, course, consultantA } = await setup();
    const other = await createLead({ branchId: b.id, status: 'deposited' });
    const h = authHeader(consultantA);
    expect((await request(app).post(`/api/v1/leads/${other.id}/convert`).set(h).send({ courseId: course.id })).status).toBe(
      404,
    );
    const lead = await createLead({ branchId: a.id, status: 'deposited' });
    const full = await createClass({ branchId: a.id, courseId: course.id, capacity: 1 });
    await Student.create({
      code: 'HV-FULL',
      name: 'Đã có',
      phone: '0911111111',
      courseId: course._id,
      courseCode: 'B',
      branchId: a._id,
      classId: full._id,
      status: 'studying',
      enrolledAt: new Date(),
    });
    expect(
      (await request(app).post(`/api/v1/leads/${lead.id}/convert`).set(h).send({ courseId: course.id, classId: full.id }))
        .status,
    ).toBe(409);
    expect(await Student.countDocuments({ leadId: lead._id })).toBe(0);
    expect((await Lead.findById(lead.id))?.status).toBe('deposited');
  });
});
