import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { LeadActivity } from '../../src/modules/leads/lead-activity.model';
import { LeadSubmission } from '../../src/modules/leads/lead-submission.model';
import { Lead } from '../../src/modules/leads/lead.model';
import { createBranch, createCourse } from '../helpers/factories';

const form = (extra: Record<string, unknown> = {}) => ({
  name: 'Nguyễn Văn An',
  phone: '0779 666 664',
  branch: 'tan-ngai',
  courseCode: 'b',
  preferredContactTime: 'Buổi chiều (13:00–17:30)',
  note: 'Học phí trọn khóa?',
  consent: true,
  ...extra,
});

async function setup() {
  const branch = await createBranch({ name: 'Tân Ngãi', slug: 'tan-ngai' });
  const course = await createCourse({ code: 'B' });
  return { app: createApp(), branch, course };
}

describe('POST /public/leads', () => {
  it('tạo lead nguồn website, không trả thông tin khách', async () => {
    const { app, branch, course } = await setup();
    const res = await request(app)
      .post('/api/v1/public/leads')
      .send(form({ utm: { source: 'facebook', campaign: 'thang10' } }));
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ data: { received: true } });
    const lead = await Lead.findOne();
    expect(lead).toMatchObject({
      phone: '0779666664',
      source: 'website',
      status: 'new',
      courseCode: 'B',
      note: 'Học phí trọn khóa?',
    });
    expect(lead?.branchId.toString()).toBe(branch.id);
    expect(lead?.courseId?.toString()).toBe(course.id);
    expect(lead?.utm).toMatchObject({ source: 'facebook', campaign: 'thang10' });
    expect(await LeadActivity.countDocuments({ type: 'created', byUserId: null })).toBe(1);
  });

  it('không chọn hạng bằng → courseCode null', async () => {
    const { app } = await setup();
    await request(app)
      .post('/api/v1/public/leads')
      .send(form({ courseCode: undefined }));
    expect((await Lead.findOne())?.courseCode).toBeNull();
  });

  it('chuỗi rỗng/khoảng trắng ở trường tùy chọn được coi như không nhập', async () => {
    const { app } = await setup();
    const res = await request(app)
      .post('/api/v1/public/leads')
      .send(form({ email: '', note: '   ', courseCode: '', preferredContactTime: ' ' }));
    expect(res.status).toBe(201);
    const lead = await Lead.findOne();
    expect(lead?.email).toBeNull();
    expect(lead?.note).toBeNull();
    expect(lead?.courseCode).toBeNull();
    expect(lead?.preferredContactTime).toBeNull();
  });

  it('gửi lại cùng SĐT (viết khác) khi lead còn mở → không tạo mới, thêm form_resubmit', async () => {
    const { app } = await setup();
    await request(app).post('/api/v1/public/leads').send(form());
    const again = await request(app)
      .post('/api/v1/public/leads')
      .send(form({ phone: '+84 779.666.664', note: 'Hỏi thêm lịch thi' }));
    expect(again.status).toBe(201);
    expect(await Lead.countDocuments()).toBe(1);
    const resubmit = await LeadActivity.findOne({ type: 'form_resubmit' });
    expect(resubmit?.content).toContain('Hỏi thêm lịch thi');
  });

  it('lead cũ đã "lost" → tạo lead mới', async () => {
    const { app } = await setup();
    await request(app).post('/api/v1/public/leads').send(form());
    await Lead.updateOne({}, { status: 'lost', lostReason: 'Không liên lạc được' });
    await request(app).post('/api/v1/public/leads').send(form());
    expect(await Lead.countDocuments()).toBe(2);
  });

  it('honeypot có giá trị → 201 nhưng không lưu gì', async () => {
    const { app } = await setup();
    const res = await request(app)
      .post('/api/v1/public/leads')
      .send(form({ website: 'http://spam.example' }));
    expect(res.status).toBe(201);
    expect(await Lead.countDocuments()).toBe(0);
    expect(await LeadSubmission.countDocuments()).toBe(0);
  });

  it('400: thiếu consent, SĐT sai, chi nhánh hoặc hạng bằng không tồn tại', async () => {
    const { app } = await setup();
    for (const body of [
      form({ consent: false }),
      form({ phone: '12345' }),
      form({ branch: 'khong-co' }),
      form({ courseCode: 'Z9' }),
    ]) {
      expect((await request(app).post('/api/v1/public/leads').send(body)).status).toBe(400);
    }
    expect(await Lead.countDocuments()).toBe(0);
  });

  it('chi nhánh ngừng hoạt động hoặc gói không bán → 400', async () => {
    const { app } = await setup();
    await createBranch({ slug: 'dong-cua', status: 'inactive' });
    await createCourse({ code: 'OFF', active: false });
    expect(
      (
        await request(app)
          .post('/api/v1/public/leads')
          .send(form({ branch: 'dong-cua' }))
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/v1/public/leads')
          .send(form({ courseCode: 'OFF' }))
      ).status,
    ).toBe(400);
  });

  it('tối đa 3 lần gửi/24h/SĐT → lần 4 bị 429', async () => {
    const { app } = await setup();
    for (let i = 0; i < 3; i += 1) expect((await request(app).post('/api/v1/public/leads').send(form())).status).toBe(201);
    const res = await request(app).post('/api/v1/public/leads').send(form());
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });

  it('tối đa 10 lần/giờ/IP → lần 11 bị 429', async () => {
    const { app } = await setup();
    for (let i = 0; i < 10; i += 1) {
      await request(app)
        .post('/api/v1/public/leads')
        .send(form({ phone: `09000000${String(i).padStart(2, '0')}` }));
    }
    const res = await request(app)
      .post('/api/v1/public/leads')
      .send(form({ phone: '0912345678' }));
    expect(res.status).toBe(429);
  });
});
