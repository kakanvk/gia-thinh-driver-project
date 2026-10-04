import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { LeadActivity } from '../../src/modules/leads/lead-activity.model';
import { authHeader, createBranch, createLead, createUser } from '../helpers/factories';

async function setup() {
  const [a, b] = await Promise.all([createBranch({ name: 'A' }), createBranch({ name: 'B' })]);
  const { user: consultantA } = await createUser({ role: 'consultant', branchIds: [a.id], name: 'Tư vấn A' });
  const { user: consultantB } = await createUser({ role: 'consultant', branchIds: [b.id] });
  const lead = await createLead({ branchId: a.id, name: 'Nguyễn Minh Anh', phone: '0903412869' });
  return { app: createApp(), a, b, consultantA, consultantB, lead };
}

const book = (extra: Record<string, unknown>) => ({ startAt: '2026-10-24T08:00', type: 'consult', ...extra });

describe('lịch hẹn', () => {
  it('đặt lịch cho khách: lấy chi nhánh của khách, endAt = start + 30 phút, ghi hoạt động vào khách', async () => {
    const { app, a, consultantA, lead } = await setup();
    const res = await request(app)
      .post('/api/v1/appointments')
      .set(authHeader(consultantA))
      .send(book({ leadId: lead.id, assigneeId: consultantA.id }));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      branchId: a.id,
      startAt: '2026-10-24T08:00:00+07:00',
      endAt: '2026-10-24T08:30:00+07:00',
      durationMinutes: 30,
      status: 'scheduled',
    });
    const activity = await LeadActivity.findOne({ leadId: lead._id, type: 'appointment' });
    expect(activity?.content).toBe('Hẹn tư vấn lúc 24/10/2026 08:00');
  });

  it('branchId gửi lên khác chi nhánh của khách → 400; lịch không gắn khách cho chi nhánh khác → 403', async () => {
    const { app, b, consultantA, lead } = await setup();
    expect(
      (
        await request(app)
          .post('/api/v1/appointments')
          .set(authHeader(consultantA))
          .send(book({ leadId: lead.id, branchId: b.id }))
      ).status,
    ).toBe(400);
    const other = await request(app)
      .post('/api/v1/appointments')
      .set(authHeader(consultantA))
      .send(book({ branchId: b.id, title: 'Họp' }));
    expect(other.status).toBe(403);
    expect(other.body.error.code).toBe('BRANCH_FORBIDDEN');
    expect(
      (
        await request(app)
          .post('/api/v1/appointments')
          .set(authHeader(consultantA))
          .send(book({ title: 'Thiếu chi nhánh' }))
      ).status,
    ).toBe(400);
  });

  it('tư vấn viên B không thấy/không sửa được lịch của A (404) và không đặt được lịch cho khách của A (404)', async () => {
    const { app, consultantA, consultantB, lead } = await setup();
    const { body } = await request(app)
      .post('/api/v1/appointments')
      .set(authHeader(consultantA))
      .send(book({ leadId: lead.id }));
    const id = body.data.id;
    expect((await request(app).get(`/api/v1/appointments/${id}`).set(authHeader(consultantB))).status).toBe(404);
    expect(
      (await request(app).patch(`/api/v1/appointments/${id}`).set(authHeader(consultantB)).send({ note: 'x' })).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .post('/api/v1/appointments')
          .set(authHeader(consultantB))
          .send(book({ leadId: lead.id }))
      ).status,
    ).toBe(404);
  });

  it('cùng người phụ trách trùng giờ lịch đang "scheduled" → 409; lịch đã hủy không tính', async () => {
    const { app, a, consultantA } = await setup();
    const h = authHeader(consultantA);
    const first = await request(app)
      .post('/api/v1/appointments')
      .set(h)
      .send(book({ branchId: a.id, title: 'Lịch 1', assigneeId: consultantA.id, durationMinutes: 60 }));
    expect(first.status).toBe(201);
    const clash = book({ branchId: a.id, title: 'Lịch 2', assigneeId: consultantA.id, startAt: '2026-10-24T08:30' });
    expect((await request(app).post('/api/v1/appointments').set(h).send(clash)).status).toBe(409);
    await request(app).patch(`/api/v1/appointments/${first.body.data.id}/status`).set(h).send({ status: 'cancelled' });
    expect((await request(app).post('/api/v1/appointments').set(h).send(clash)).status).toBe(201);
    const adjacent = book({ branchId: a.id, title: 'Lịch 3', assigneeId: consultantA.id, startAt: '2026-10-24T09:00' });
    expect((await request(app).post('/api/v1/appointments').set(h).send(adjacent)).status).toBe(201);
  });

  it('đổi trạng thái ghi hoạt động vào khách; dời giờ tính lại endAt và vẫn kiểm tra trùng', async () => {
    const { app, consultantA, lead } = await setup();
    const h = authHeader(consultantA);
    const { body } = await request(app)
      .post('/api/v1/appointments')
      .set(h)
      .send(book({ leadId: lead.id }));
    const moved = await request(app)
      .patch(`/api/v1/appointments/${body.data.id}`)
      .set(h)
      .send({ startAt: '2026-10-25T14:00', durationMinutes: 45 });
    expect(moved.body.data).toMatchObject({ startAt: '2026-10-25T14:00:00+07:00', endAt: '2026-10-25T14:45:00+07:00' });
    const done = await request(app)
      .patch(`/api/v1/appointments/${body.data.id}/status`)
      .set(h)
      .send({ status: 'done', note: 'Khách đã đặt cọc' });
    expect(done.body.data.status).toBe('done');
    expect(await LeadActivity.countDocuments({ leadId: lead._id, type: 'appointment' })).toBe(3);
    expect(
      (await request(app).patch(`/api/v1/appointments/${body.data.id}/status`).set(h).send({ status: 'done' })).status,
    ).toBe(409);
  });

  it('lịch tháng theo giờ VN: lịch 00:30 ngày 01/11 giờ VN thuộc tháng 11; chỉ chi nhánh mình', async () => {
    const { app, a, b, consultantA, lead } = await setup();
    const { user: admin } = await createUser();
    const h = authHeader(consultantA);
    await request(app)
      .post('/api/v1/appointments')
      .set(h)
      .send(book({ leadId: lead.id, startAt: '2026-10-31T23:00', assigneeId: consultantA.id }));
    await request(app)
      .post('/api/v1/appointments')
      .set(h)
      .send(book({ branchId: a.id, title: 'Đầu tháng 11', startAt: '2026-11-01T00:30' }));
    await request(app)
      .post('/api/v1/appointments')
      .set(authHeader(admin))
      .send(book({ branchId: b.id, title: 'Của B', startAt: '2026-10-10T08:00' }));
    const oct = await request(app).get('/api/v1/appointments/calendar?month=2026-10').set(h);
    expect(oct.status).toBe(200);
    expect(oct.body.data.month).toBe('2026-10');
    expect(oct.body.data.items).toHaveLength(1);
    expect(oct.body.data.items[0]).toMatchObject({
      date: '2026-10-31',
      time: '23:00',
      lead: { code: lead.code, name: 'Nguyễn Minh Anh', phone: '0903412869' },
      assignee: { name: 'Tư vấn A' },
    });
    const nov = await request(app).get('/api/v1/appointments/calendar?month=2026-11').set(h);
    expect(nov.body.data.items.map((x: { title: string }) => x.title)).toEqual(['Đầu tháng 11']);
    expect((await request(app).get('/api/v1/appointments/calendar?month=2026-13').set(h)).status).toBe(400);
  });

  it('danh sách lọc theo khách và khoảng ngày; xóa mềm', async () => {
    const { app, consultantA, lead } = await setup();
    const h = authHeader(consultantA);
    const { body } = await request(app)
      .post('/api/v1/appointments')
      .set(h)
      .send(book({ leadId: lead.id }));
    expect((await request(app).get(`/api/v1/appointments?leadId=${lead.id}`).set(h)).body.meta.total).toBe(1);
    expect((await request(app).get('/api/v1/appointments?from=2026-10-25&to=2026-10-31').set(h)).body.meta.total).toBe(0);
    expect((await request(app).delete(`/api/v1/appointments/${body.data.id}`).set(h)).status).toBe(204);
    expect((await request(app).get(`/api/v1/appointments/${body.data.id}`).set(h)).status).toBe(404);
  });

  it('PATCH: dời giờ/đổi người phụ trách trùng lịch → 409; mở lại lịch đã hủy bị trùng → 409', async () => {
    const { app, a, consultantA } = await setup();
    const { user: other } = await createUser({ role: 'consultant', branchIds: [a.id] });
    const h = authHeader(consultantA);
    const mk = (title: string, startAt: string, assigneeId: string) =>
      request(app)
        .post('/api/v1/appointments')
        .set(h)
        .send(book({ branchId: a.id, title, startAt, assigneeId }));
    const first = await mk('L1', '2026-10-24T08:00', consultantA.id);
    const second = await mk('L2', '2026-10-24T09:00', consultantA.id);
    const third = await mk('L3', '2026-10-24T08:00', other.id);
    expect([first.status, second.status, third.status]).toEqual([201, 201, 201]);
    const move = await request(app)
      .patch(`/api/v1/appointments/${second.body.data.id}`)
      .set(h)
      .send({ startAt: '2026-10-24T08:15' });
    expect(move.status).toBe(409);
    const swap = await request(app)
      .patch(`/api/v1/appointments/${third.body.data.id}`)
      .set(h)
      .send({ assigneeId: consultantA.id });
    expect(swap.status).toBe(409);
    await request(app).patch(`/api/v1/appointments/${second.body.data.id}/status`).set(h).send({ status: 'cancelled' });
    await request(app).patch(`/api/v1/appointments/${second.body.data.id}`).set(h).send({ startAt: '2026-10-24T08:15' });
    const reopen = await request(app)
      .patch(`/api/v1/appointments/${second.body.data.id}/status`)
      .set(h)
      .send({ status: 'scheduled' });
    expect(reopen.status).toBe(409);
  });

  it('người phụ trách sai chi nhánh hoặc bị khóa → 400 (tạo và sửa)', async () => {
    const { app, a, consultantA, consultantB } = await setup();
    const { user: suspended } = await createUser({ role: 'consultant', branchIds: [a.id], status: 'suspended' });
    const h = authHeader(consultantA);
    const base = book({ branchId: a.id, title: 'X' });
    expect(
      (
        await request(app)
          .post('/api/v1/appointments')
          .set(h)
          .send({ ...base, assigneeId: consultantB.id })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/v1/appointments')
          .set(h)
          .send({ ...base, assigneeId: suspended.id })
      ).status,
    ).toBe(400);
    const ok = await request(app).post('/api/v1/appointments').set(h).send(base);
    const id = ok.body.data.id;
    expect((await request(app).patch(`/api/v1/appointments/${id}`).set(h).send({ assigneeId: consultantB.id })).status).toBe(
      400,
    );
    expect((await request(app).patch(`/api/v1/appointments/${id}`).set(h).send({ assigneeId: suspended.id })).status).toBe(
      400,
    );
  });

  it('xóa lịch ghi hoạt động "Xóa lịch" vào khách', async () => {
    const { app, consultantA, lead } = await setup();
    const h = authHeader(consultantA);
    const { body } = await request(app)
      .post('/api/v1/appointments')
      .set(h)
      .send(book({ leadId: lead.id }));
    await request(app).delete(`/api/v1/appointments/${body.data.id}`).set(h);
    const acts = await LeadActivity.find({ leadId: lead._id, type: 'appointment' });
    expect(acts.map((x) => x.content)).toContain('Xóa lịch tư vấn 24/10/2026 08:00');
  });

  it('khách chuyển chi nhánh: lịch đi theo, bỏ người phụ trách không thuộc chi nhánh mới', async () => {
    const { app, b, consultantA, lead } = await setup();
    const { user: admin } = await createUser();
    const { user: staffB } = await createUser({ role: 'consultant', branchIds: [b.id] });
    const h = authHeader(admin);
    const keep = await request(app)
      .post('/api/v1/appointments')
      .set(h)
      .send(book({ leadId: lead.id, assigneeId: consultantA.id }));
    const none = await request(app)
      .post('/api/v1/appointments')
      .set(h)
      .send(book({ leadId: lead.id, startAt: '2026-10-25T08:00' }));
    expect(keep.status).toBe(201);
    const res = await request(app).patch(`/api/v1/leads/${lead.id}`).set(h).send({ branchId: b.id });
    expect(res.status).toBe(200);
    const a1 = await request(app).get(`/api/v1/appointments/${keep.body.data.id}`).set(authHeader(staffB));
    expect(a1.status).toBe(200);
    expect(a1.body.data).toMatchObject({ branchId: b.id, assigneeId: null });
    const a2 = await request(app).get(`/api/v1/appointments/${none.body.data.id}`).set(authHeader(staffB));
    expect(a2.body.data.branchId).toBe(b.id);
    expect((await request(app).get(`/api/v1/appointments/${keep.body.data.id}`).set(authHeader(consultantA))).status).toBe(
      404,
    );
  });
});

describe('PATCH lịch hẹn', () => {
  it('body rỗng → 400 "Không có thay đổi nào"', async () => {
    const { app, consultantA, lead } = await setup();
    const created = await request(app)
      .post('/api/v1/appointments')
      .set(authHeader(consultantA))
      .send(book({ leadId: lead.id }));
    const before = await LeadActivity.countDocuments({ leadId: lead._id });
    const res = await request(app)
      .patch(`/api/v1/appointments/${created.body.data.id}`)
      .set(authHeader(consultantA))
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(res.body)).toContain('Không có thay đổi nào');
    expect(await LeadActivity.countDocuments({ leadId: lead._id })).toBe(before);
  });
});
