import { Types } from 'mongoose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { recordAudit } from '../../src/modules/audit/audit.service';
import { authHeader, createUser } from '../helpers/factories';

describe('GET /audit', () => {
  it('super_admin xem được, lọc theo entity, mới nhất trước', async () => {
    const { user: admin } = await createUser({ role: 'super_admin' });
    const id = new Types.ObjectId().toString();
    await recordAudit({ actorId: admin.id, action: 'branch.create', entity: 'branch', entityId: id, after: { name: 'A' } });
    await recordAudit({ actorId: admin.id, action: 'setting.update', entity: 'setting', entityId: 'hotline' });

    const res = await request(createApp()).get('/api/v1/audit?entity=branch').set(authHeader(admin));
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0]).toMatchObject({ action: 'branch.create', entityId: id, after: { name: 'A' } });
    expect(res.body.data[0].at).toMatch(/\+07:00$/);
  });

  it('lọc from/to theo ngày giờ VN', async () => {
    const { user: admin } = await createUser({ role: 'super_admin' });
    await AuditLog.create({
      actorId: admin._id,
      action: 'x.y',
      entity: 'x',
      entityId: '1',
      at: new Date('2026-10-04T18:00:00Z'), // 05/10/2026 01:00 giờ VN
    });
    const app = createApp();
    const included = await request(app).get('/api/v1/audit?from=2026-10-05&to=2026-10-05').set(authHeader(admin));
    const excluded = await request(app).get('/api/v1/audit?to=2026-10-04').set(authHeader(admin));
    expect(included.body.meta.total).toBe(1);
    expect(excluded.body.meta.total).toBe(0);
  });

  it('vai trò khác bị 403', async () => {
    const { user } = await createUser({ role: 'branch_manager', branchIds: [new Types.ObjectId().toString()] });
    expect((await request(createApp()).get('/api/v1/audit').set(authHeader(user))).status).toBe(403);
  });
});
