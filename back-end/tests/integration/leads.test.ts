import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { Appointment } from '../../src/modules/appointments/appointment.model';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { LeadActivity } from '../../src/modules/leads/lead-activity.model';
import { Lead } from '../../src/modules/leads/lead.model';
import { toVnIso } from '../../src/shared/time';
import { authHeader, createBranch, createCourse, createLead, createUser } from '../helpers/factories';

async function setup() {
  const [a, b] = await Promise.all([createBranch({ name: 'A' }), createBranch({ name: 'B' })]);
  const { user: consultantA } = await createUser({ role: 'consultant', branchIds: [a.id], name: 'Tư vấn A' });
  const { user: consultantB } = await createUser({ role: 'consultant', branchIds: [b.id] });
  const { user: managerA } = await createUser({ role: 'branch_manager', branchIds: [a.id] });
  const { user: admin } = await createUser();
  return { app: createApp(), a, b, consultantA, consultantB, managerA, admin };
}

describe('tạo và xem khách', () => {
  it('tư vấn viên A tạo khách tại quầy: mã GT-, SĐT chuẩn hóa, có hoạt động "created"', async () => {
    const { app, a, consultantA } = await setup();
    const course = await createCourse({ code: 'B' });
    const res = await request(app)
      .post('/api/v1/leads')
      .set(authHeader(consultantA))
      .send({
        name: 'Nguyễn Văn An',
        phone: '+84 903 412 869',
        branchId: a.id,
        courseId: course.id,
        note: 'Hỏi lịch cuối tuần',
      });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ phone: '0903412869', status: 'new', source: 'walk_in', courseCode: 'B' });
    expect(res.body.data.code).toMatch(/^GT-\d{6}-\d{2,}$/);
    expect(await LeadActivity.countDocuments({ leadId: res.body.data.id, type: 'created' })).toBe(1);
  });

  it('tạo cho chi nhánh khác → 403 BRANCH_FORBIDDEN; editor không có quyền → 403', async () => {
    const { app, b, consultantA } = await setup();
    const { user: editor } = await createUser({ role: 'editor' });
    const body = { name: 'Khách B', phone: '0909000111', branchId: b.id };
    const res = await request(app).post('/api/v1/leads').set(authHeader(consultantA)).send(body);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('BRANCH_FORBIDDEN');
    expect((await request(app).get('/api/v1/leads').set(authHeader(editor))).status).toBe(403);
  });

  it('danh sách chỉ gồm khách chi nhánh mình; id chi nhánh khác → 404 ở mọi endpoint', async () => {
    const { app, a, b, consultantA, managerA } = await setup();
    await createLead({ branchId: a.id, name: 'Của A' });
    const leadB = await createLead({ branchId: b.id, name: 'Của B' });
    const list = await request(app).get('/api/v1/leads').set(authHeader(consultantA));
    expect(list.body.data.map((l: { name: string }) => l.name)).toEqual(['Của A']);
    for (const [method, path] of [
      ['get', `/api/v1/leads/${leadB.id}`],
      ['patch', `/api/v1/leads/${leadB.id}`],
      ['get', `/api/v1/leads/${leadB.id}/activities`],
      ['patch', `/api/v1/leads/${leadB.id}/status`],
      ['patch', `/api/v1/leads/${leadB.id}/assign`],
      ['post', `/api/v1/leads/${leadB.id}/activities`],
    ] as const) {
      const agent = request(app)[method](path);
      const res = await agent
        .set(authHeader(consultantA))
        .send({ name: 'Tên mới', status: 'contacted', assigneeId: null, type: 'note', content: 'x' });
      expect(res.status, `${method} ${path}`).toBe(404);
    }
    const del = await request(app).delete(`/api/v1/leads/${leadB.id}`).set(authHeader(managerA));
    expect(del.status).toBe(404);
  });

  it('lọc theo trạng thái, nguồn, q (tên/SĐT/mã), khoảng ngày tạo theo giờ VN, hạn liên hệ', async () => {
    const { app, a, admin } = await setup();
    await createLead({ branchId: a.id, name: 'Trần Quốc Bảo', phone: '0786205114', status: 'contacted' });
    await createLead({
      branchId: a.id,
      name: 'Lê Hoài Thương',
      source: 'facebook',
      createdAt: new Date('2026-09-22T18:00:00Z'),
    });
    await createLead({ branchId: a.id, name: 'Đến hạn', nextFollowUpAt: new Date(Date.now() - 60_000) });
    await createLead({
      branchId: a.id,
      name: 'Đến hạn nhưng đã lost',
      status: 'lost',
      nextFollowUpAt: new Date(Date.now() - 60_000),
    });
    const get = (qs: string) => request(app).get(`/api/v1/leads?${qs}`).set(authHeader(admin));
    expect((await get('status=contacted')).body.meta.total).toBe(1);
    expect((await get('source=facebook')).body.data[0].name).toBe('Lê Hoài Thương');
    expect((await get('q=0786%20205')).body.data[0].name).toBe('Trần Quốc Bảo');
    expect((await get('from=2026-09-23&to=2026-09-23')).body.data[0].name).toBe('Lê Hoài Thương');
    expect((await get('q=()')).body.meta.total).toBe(0);
    expect((await get('q=%2B84')).body.meta.total).toBe(0);
    expect((await get('followUpDue=true')).body.data.map((l: { name: string }) => l.name)).toEqual(['Đến hạn']);
  });
});

describe('trạng thái, phân công, lịch sử', () => {
  it('chuyển tiến được; lùi → 409; lost thiếu lý do → 400; lost có lý do rồi mở lại', async () => {
    const { app, a, consultantA } = await setup();
    const lead = await createLead({ branchId: a.id });
    const url = `/api/v1/leads/${lead.id}/status`;
    const h = authHeader(consultantA);
    expect(
      (await request(app).patch(url).set(h).send({ status: 'consulted', note: 'Đã gọi tư vấn hạng B' })).body.data.status,
    ).toBe('consulted');
    expect((await request(app).patch(url).set(h).send({ status: 'new' })).status).toBe(409);
    expect((await request(app).patch(url).set(h).send({ status: 'lost' })).status).toBe(400);
    const lost = await request(app).patch(url).set(h).send({ status: 'lost', lostReason: 'Chọn trung tâm khác' });
    expect(lost.body.data).toMatchObject({ status: 'lost', lostReason: 'Chọn trung tâm khác' });
    const reopened = await request(app).patch(url).set(h).send({ status: 'contacted' });
    expect(reopened.body.data).toMatchObject({ status: 'contacted', lostReason: null });
    const changes = await LeadActivity.find({ leadId: lead._id, type: 'status_change' }).sort({ at: 1, _id: 1 });
    expect(changes.map((c) => [c.fromStatus, c.toStatus])).toEqual([
      ['new', 'consulted'],
      ['consulted', 'lost'],
      ['lost', 'contacted'],
    ]);
    expect(changes[0]?.content).toBe('Đã gọi tư vấn hạng B');
  });

  it('enrolled không chọn được ở đợt này → 400', async () => {
    const { app, a, consultantA } = await setup();
    const lead = await createLead({ branchId: a.id });
    const res = await request(app)
      .patch(`/api/v1/leads/${lead.id}/status`)
      .set(authHeader(consultantA))
      .send({ status: 'enrolled' });
    expect(res.status).toBe(400);
  });

  it('phân công: chỉ người thuộc chi nhánh của khách; bỏ phân công bằng null', async () => {
    const { app, a, consultantA, consultantB, managerA } = await setup();
    const lead = await createLead({ branchId: a.id });
    const url = `/api/v1/leads/${lead.id}/assign`;
    expect((await request(app).patch(url).set(authHeader(managerA)).send({ assigneeId: consultantB.id })).status).toBe(400);
    const ok = await request(app).patch(url).set(authHeader(managerA)).send({ assigneeId: consultantA.id });
    expect(ok.body.data.assigneeId).toBe(consultantA.id);
    expect((await LeadActivity.findOne({ leadId: lead._id, type: 'assign' }))?.content).toContain('Tư vấn A');
    expect(
      (await request(app).patch(url).set(authHeader(managerA)).send({ assigneeId: null })).body.data.assigneeId,
    ).toBeNull();
  });

  it('chuyển khách sang chi nhánh khác: phải có quyền cả 2 chi nhánh; người phụ trách không thuộc chi nhánh mới bị bỏ', async () => {
    const { app, a, b, consultantA, admin } = await setup();
    const lead = await createLead({ branchId: a.id, assigneeId: consultantA.id });
    const denied = await request(app)
      .patch(`/api/v1/leads/${lead.id}`)
      .set(authHeader(consultantA))
      .send({ branchId: b.id });
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('BRANCH_FORBIDDEN');
    const moved = await request(app).patch(`/api/v1/leads/${lead.id}`).set(authHeader(admin)).send({ branchId: b.id });
    expect(moved.body.data).toMatchObject({ branchId: b.id, assigneeId: null });
  });

  it('ghi chú/cuộc gọi tay cập nhật lastActivityAt và hẹn liên hệ; danh sách hoạt động mới nhất trước', async () => {
    const { app, a, consultantA } = await setup();
    const lead = await createLead({ branchId: a.id });
    const followUp = '2026-12-01T09:00';
    const res = await request(app)
      .post(`/api/v1/leads/${lead.id}/activities`)
      .set(authHeader(consultantA))
      .send({ type: 'call', content: 'Khách hẹn gọi lại tuần sau', nextFollowUpAt: followUp });
    expect(res.status).toBe(201);
    const fresh = await Lead.findById(lead.id);
    expect(fresh?.nextFollowUpAt?.toISOString()).toBe('2026-12-01T02:00:00.000Z');
    await request(app)
      .post(`/api/v1/leads/${lead.id}/activities`)
      .set(authHeader(consultantA))
      .send({ type: 'note', content: 'Ghi chú 2' });
    const list = await request(app).get(`/api/v1/leads/${lead.id}/activities`).set(authHeader(consultantA));
    expect(list.body.data.map((x: { type: string }) => x.type)).toEqual(['note', 'call']);
    expect(
      (
        await request(app)
          .post(`/api/v1/leads/${lead.id}/activities`)
          .set(authHeader(consultantA))
          .send({ type: 'status_change', content: 'x' })
      ).status,
    ).toBe(400);
  });

  it('xóa: tư vấn viên không được (403); quản lý xóa mềm, có audit', async () => {
    const { app, a, consultantA, managerA } = await setup();
    const lead = await createLead({ branchId: a.id });
    expect((await request(app).delete(`/api/v1/leads/${lead.id}`).set(authHeader(consultantA))).status).toBe(403);
    expect((await request(app).delete(`/api/v1/leads/${lead.id}`).set(authHeader(managerA))).status).toBe(204);
    expect(await Lead.countDocuments()).toBe(0);
    expect(await AuditLog.countDocuments({ action: 'lead.delete' })).toBe(1);
  });
});

describe('theo đợt sửa sau phase 3', () => {
  it('đổi trạng thái đồng thời: một 200, một 409; chỉ một hoạt động status_change', async () => {
    const { app, a, consultantA } = await setup();
    const lead = await createLead({ branchId: a.id });
    const url = `/api/v1/leads/${lead.id}/status`;
    const h = authHeader(consultantA);
    const results = await Promise.all([
      request(app).patch(url).set(h).send({ status: 'consulted' }),
      request(app).patch(url).set(h).send({ status: 'consulted' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const winner = results.find((r) => r.status === 200)!;
    expect((await Lead.findById(lead.id))?.status).toBe(winner.body.data.status);
    expect(await LeadActivity.countDocuments({ leadId: lead._id, type: 'status_change' })).toBe(1);
  });

  it('PATCH trả lastActivityAt đúng bằng thời điểm hoạt động "updated"', async () => {
    const { app, a, consultantA } = await setup();
    const lead = await createLead({ branchId: a.id });
    const res = await request(app).patch(`/api/v1/leads/${lead.id}`).set(authHeader(consultantA)).send({ name: 'Tên mới' });
    const activity = await LeadActivity.findOne({ leadId: lead._id, type: 'updated' });
    expect(res.body.data.lastActivityAt).toBe(toVnIso(activity!.at));
  });

  it('assign, status và activity cũng trả lastActivityAt mới', async () => {
    const { app, a, consultantA, managerA } = await setup();
    const lead = await createLead({ branchId: a.id });
    const assign = await request(app)
      .patch(`/api/v1/leads/${lead.id}/assign`)
      .set(authHeader(managerA))
      .send({ assigneeId: consultantA.id });
    expect(assign.body.data.lastActivityAt).toBe(
      toVnIso((await LeadActivity.findOne({ leadId: lead._id, type: 'assign' }))!.at),
    );
    const status = await request(app)
      .patch(`/api/v1/leads/${lead.id}/status`)
      .set(authHeader(managerA))
      .send({ status: 'contacted' });
    expect(status.body.data.lastActivityAt).toBe(
      toVnIso((await LeadActivity.findOne({ leadId: lead._id, type: 'status_change' }))!.at),
    );
    const note = await request(app)
      .post(`/api/v1/leads/${lead.id}/activities`)
      .set(authHeader(managerA))
      .send({ type: 'note', content: 'x' });
    expect(note.status).toBe(201);
    expect(toVnIso((await Lead.findById(lead.id))!.lastActivityAt)).toBe(note.body.data.at);
  });

  it('PATCH body rỗng → 400 "Không có thay đổi nào", không ghi hoạt động', async () => {
    const { app, a, consultantA } = await setup();
    const lead = await createLead({ branchId: a.id });
    const res = await request(app).patch(`/api/v1/leads/${lead.id}`).set(authHeader(consultantA)).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(res.body)).toContain('Không có thay đổi nào');
    expect(await LeadActivity.countDocuments({ leadId: lead._id, type: 'updated' })).toBe(0);
  });

  it('xóa khách hủy lịch hẹn đang chờ, giải phóng khung giờ của người phụ trách', async () => {
    const { app, a, consultantA, managerA } = await setup();
    const lead = await createLead({ branchId: a.id });
    const body = { startAt: '2026-10-24T08:00', type: 'consult', assigneeId: consultantA.id };
    const first = await request(app)
      .post('/api/v1/appointments')
      .set(authHeader(managerA))
      .send({ ...body, leadId: lead.id });
    expect(first.status).toBe(201);
    expect((await request(app).delete(`/api/v1/leads/${lead.id}`).set(authHeader(managerA))).status).toBe(204);
    expect((await Appointment.findById(first.body.data.id))?.status).toBe('cancelled');
    const again = await request(app)
      .post('/api/v1/appointments')
      .set(authHeader(managerA))
      .send({ ...body, branchId: a.id, title: 'Họp' });
    expect(again.status).toBe(201);
  });
});
