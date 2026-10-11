import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { PriceOverride } from '../../src/modules/pricing/price-override.model';
import { Student } from '../../src/modules/students/student.model';
import { TuitionAccount } from '../../src/modules/tuition/tuition-account.model';
import { authHeader, createBranch, createCourse, createLead, createUser } from '../helpers/factories';

async function setup() {
  const [a, b] = await Promise.all([createBranch({ name: 'A' }), createBranch({ name: 'Vũng Liêm' })]);
  const course = await createCourse({ code: 'A', defaultPrice: 1_750_000 });
  await PriceOverride.create({ branchId: b._id, courseId: course._id, price: 1_595_000 });
  const { user: managerA } = await createUser({ role: 'branch_manager', branchIds: [a.id] });
  const { user: consultantA } = await createUser({ role: 'consultant', branchIds: [a.id] });
  const { user: admin } = await createUser();
  return { app: createApp(), a, b, course, managerA, consultantA, admin };
}

async function newStudent(
  app: ReturnType<typeof createApp>,
  user: Parameters<typeof authHeader>[0],
  branchId: string,
  courseId: string,
) {
  const res = await request(app)
    .post('/api/v1/students')
    .set(authHeader(user))
    .send({ name: 'Nguyễn Minh Anh', phone: '0903412869', courseId, branchId, enrolledAt: '2026-10-01' });
  return res.body.data as { id: string; code: string };
}

describe('sổ học phí', () => {
  it('tạo học viên → tự tạo sổ: giá theo chi nhánh, 1 đợt hạn nhập học + 14 ngày, trạng thái tính theo ngày', async () => {
    const { app, a, b, course, consultantA, admin } = await setup();
    const sa = await newStudent(app, consultantA, a.id, course.id);
    const sb = await newStudent(app, admin, b.id, course.id);
    const accA = await TuitionAccount.findOne({ studentId: sa.id });
    const accB = await TuitionAccount.findOne({ studentId: sb.id });
    expect(accA).toMatchObject({ listPrice: 1_750_000, total: 1_750_000, paidAmount: 0, plan: 'one_time', courseCode: 'A' });
    expect(accB?.listPrice).toBe(1_595_000);
    expect(accA?.installments).toHaveLength(1);
    expect(accA?.installments[0]?.dueDate.toISOString()).toBe('2026-10-14T17:00:00.000Z'); // 15/10/2026 00:00 VN
  });

  it('chi tiết: kèm học viên, còn phải đóng, đợt tiếp theo; tư vấn viên xem được nhưng không sửa được', async () => {
    const { app, a, course, consultantA } = await setup();
    const student = await newStudent(app, consultantA, a.id, course.id);
    const account = await TuitionAccount.findOne({ studentId: student.id });
    const res = await request(app).get(`/api/v1/tuition/${account!.id}`).set(authHeader(consultantA));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      student: { id: student.id, code: student.code, name: 'Nguyễn Minh Anh', phone: '0903412869' },
      remaining: 1_750_000,
      nextDue: { dueDate: '2026-10-15T00:00:00+07:00', amount: 1_750_000 },
      payments: [],
    });
    expect(
      (await request(app).patch(`/api/v1/tuition/${account!.id}`).set(authHeader(consultantA)).send({ note: 'x' })).status,
    ).toBe(403);
  });

  it('sửa: giảm trừ HSSV cập nhật total và đợt duy nhất; chia 3 đợt phải đủ tổng; có audit', async () => {
    const { app, a, managerA } = await setup();
    const courseB = await createCourse({ code: 'B', defaultPrice: 16_500_000 });
    const student = await newStudent(app, managerA, a.id, courseB.id);
    const account = await TuitionAccount.findOne({ studentId: student.id });
    const url = `/api/v1/tuition/${account!.id}`;
    const h = authHeader(managerA);
    const discounted = await request(app)
      .patch(url)
      .set(h)
      .send({ discounts: [{ label: 'HSSV', amount: 1_000_000 }] });
    expect(discounted.body.data).toMatchObject({ total: 15_500_000, installments: [{ amount: 15_500_000 }] });
    const wrong = await request(app)
      .patch(url)
      .set(h)
      .send({
        plan: 'installments',
        installments: [
          { dueDate: '2026-10-10', amount: 5_000_000 },
          { dueDate: '2026-11-10', amount: 5_000_000 },
        ],
      });
    expect(wrong.status).toBe(400);
    const split = await request(app)
      .patch(url)
      .set(h)
      .send({
        plan: 'installments',
        installments: [
          { dueDate: '2026-10-10', amount: 5_500_000 },
          { dueDate: '2026-10-25', amount: 5_000_000 },
          { dueDate: '2026-11-10', amount: 5_000_000 },
        ],
      });
    expect(split.status).toBe(200);
    expect(split.body.data.installments).toHaveLength(3);
    expect(await AuditLog.countDocuments({ action: 'tuition.update' })).toBe(2);
  });

  it('danh sách: lọc trạng thái, tìm theo tên/mã/SĐT học viên; chỉ chi nhánh mình; chi nhánh khác 404', async () => {
    const { app, a, b, course, managerA, admin } = await setup();
    await newStudent(app, managerA, a.id, course.id);
    const other = await newStudent(app, admin, b.id, course.id);
    await TuitionAccount.updateOne({ studentId: other.id }, { status: 'overdue' });
    const h = authHeader(managerA);
    const list = await request(app).get('/api/v1/tuition').set(h);
    expect(list.body.meta.total).toBe(1);
    expect(list.body.data[0]).toMatchObject({ remaining: 1_750_000, student: { name: 'Nguyễn Minh Anh' } });
    expect((await request(app).get('/api/v1/tuition?q=0903412869').set(h)).body.meta.total).toBe(1);
    expect((await request(app).get('/api/v1/tuition?status=overdue').set(h)).body.meta.total).toBe(0);
    const foreign = await TuitionAccount.findOne({ studentId: other.id });
    expect((await request(app).get(`/api/v1/tuition/${foreign!.id}`).set(h)).status).toBe(404);
  });

  it('tạo bù cho học viên chưa có sổ; đã có → 409', async () => {
    const { app, a, course, managerA } = await setup();
    const student = await Student.create({
      code: 'HV-CU-01',
      name: 'Học viên cũ',
      phone: '0911000000',
      courseId: course._id,
      courseCode: 'A',
      branchId: a._id,
      classId: null,
      status: 'studying',
      enrolledAt: new Date('2026-09-01T00:00:00+07:00'),
    });
    const h = authHeader(managerA);
    const created = await request(app).post('/api/v1/tuition').set(h).send({ studentId: student.id });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ total: 1_750_000, status: 'overdue' });
    expect((await request(app).post('/api/v1/tuition').set(h).send({ studentId: student.id })).status).toBe(409);
  });

  it('chuyển khách thành học viên cũng tạo sổ; xóa học viên chưa thu đồng nào thì xóa sổ', async () => {
    const { app, a, course, managerA } = await setup();
    const lead = await createLead({ branchId: a.id, status: 'deposited' });
    const converted = await request(app)
      .post(`/api/v1/leads/${lead.id}/convert`)
      .set(authHeader(managerA))
      .send({ courseId: course.id });
    const studentId = converted.body.data.student.id;
    expect(await TuitionAccount.countDocuments({ studentId })).toBe(1);
    await request(app).delete(`/api/v1/students/${studentId}`).set(authHeader(managerA));
    expect(await TuitionAccount.countDocuments({ studentId })).toBe(0);
  });

  it('sửa sổ khi có thanh toán chen giữa lúc đọc và ghi thì trả 409 và không ghi đè', async () => {
    const { app, a, course, consultantA, managerA } = await setup();
    const student = await newStudent(app, consultantA, a.id, course.id);
    const account = (await TuitionAccount.findOne({ studentId: student.id }))!;
    const realFind = TuitionAccount.findOneAndUpdate.bind(TuitionAccount);
    const spy = vi
      .spyOn(TuitionAccount, 'findOneAndUpdate')
      .mockImplementation(((...args: unknown[]) =>
        TuitionAccount.updateOne({ _id: account._id }, { $inc: { paidAmount: 100_000 } }).then(() =>
          (realFind as (...a: unknown[]) => unknown)(...args),
        )) as never);
    const res = await request(app)
      .patch(`/api/v1/tuition/${account.id}`)
      .set(authHeader(managerA))
      .send({ discounts: [{ label: 'Giảm giá', amount: 100_000 }] });
    spy.mockRestore();
    expect(res.status).toBe(409);
    const after = (await TuitionAccount.findById(account.id))!;
    expect(after.paidAmount).toBe(100_000);
    expect(after.total).toBe(1_750_000);
  });
});
