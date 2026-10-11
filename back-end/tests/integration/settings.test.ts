import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { authHeader, createBranch, createUser } from '../helpers/factories';

const playbook = [
  { title: 'Tiếp nhận hồ sơ mới', steps: 'Đối chiếu CCCD…', href: '/admin/lich-dang-ky', linkLabel: 'Mở lịch đăng ký' },
];

describe('/settings', () => {
  it('super_admin cập nhật nhiều key, GET trả gộp; mỗi key một audit', async () => {
    const { user: admin } = await createUser();
    const app = createApp();
    const res = await request(app)
      .patch('/api/v1/settings')
      .set(authHeader(admin))
      .send({ hotline: '0779 666 664', supportPlaybook: playbook });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ hotline: '0779 666 664', supportPlaybook: playbook });

    await request(app).patch('/api/v1/settings').set(authHeader(admin)).send({ hotline: '0909 000 000' });
    const get = await request(app).get('/api/v1/settings').set(authHeader(admin));
    expect(get.body.data.hotline).toBe('0909 000 000');
    expect(get.body.data.supportPlaybook).toEqual(playbook);

    const logs = await AuditLog.find({ action: 'setting.update', entityId: 'hotline' }).sort({ _id: 1 });
    expect(logs).toHaveLength(2);
    expect(logs[1]).toMatchObject({ before: '0779 666 664', after: '0909 000 000' });
  });

  it('400 khi key lạ hoặc giá trị sai kiểu', async () => {
    const { user: admin } = await createUser();
    const app = createApp();
    expect((await request(app).patch('/api/v1/settings').set(authHeader(admin)).send({ khongCo: 1 })).status).toBe(400);
    expect((await request(app).patch('/api/v1/settings').set(authHeader(admin)).send({ supportEmail: 'sai' })).status).toBe(
      400,
    );
  });

  it('nhân viên khác đọc được nhưng không sửa được', async () => {
    const branch = await createBranch();
    const { user } = await createUser({ role: 'consultant', branchIds: [branch.id] });
    const app = createApp();
    expect((await request(app).get('/api/v1/settings').set(authHeader(user))).status).toBe(200);
    expect((await request(app).patch('/api/v1/settings').set(authHeader(user)).send({ hotline: '0909000000' })).status).toBe(
      403,
    );
  });
});

describe('GET /public/settings', () => {
  it('chỉ trả key công khai', async () => {
    const { user: admin } = await createUser();
    const app = createApp();
    await request(app)
      .patch('/api/v1/settings')
      .set(authHeader(admin))
      .send({ hotline: '0779 666 664', supportPlaybook: playbook });
    const res = await request(app).get('/api/v1/public/settings');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ hotline: '0779 666 664' });
  });
});
