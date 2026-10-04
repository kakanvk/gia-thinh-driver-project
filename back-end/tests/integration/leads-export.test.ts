import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { toCsvCell } from '../../src/modules/leads/leads.export';
import { authHeader, createBranch, createLead, createUser } from '../helpers/factories';

describe('toCsvCell', () => {
  it('bọc nháy kép, nhân đôi nháy, vô hiệu hóa công thức', () => {
    expect(toCsvCell('An')).toBe('"An"');
    expect(toCsvCell('Nói "chào"')).toBe('"Nói ""chào"""');
    expect(toCsvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(toCsvCell('+84')).toBe('"\'+84"');
    expect(toCsvCell(null)).toBe('""');
  });

  it('cũng vô hiệu hóa ô bắt đầu bằng TAB hoặc CR', () => {
    expect(toCsvCell('\tcmd')).toBe('"\'\tcmd"');
    expect(toCsvCell('\rcmd')).toBe('"\'\rcmd"');
  });
});

describe('GET /leads/export', () => {
  it('quản lý xuất CSV có BOM, tiêu đề tiếng Việt, chỉ khách chi nhánh mình, theo bộ lọc', async () => {
    const [a, b] = await Promise.all([createBranch({ name: 'Tân Ngãi' }), createBranch({ name: 'B' })]);
    const { user: manager } = await createUser({ role: 'branch_manager', branchIds: [a.id], name: 'Lê Vinh' });
    await createLead({
      branchId: a.id,
      name: 'Khách A',
      status: 'contacted',
      assigneeId: manager.id,
      createdAt: new Date('2026-09-23T03:00:00Z'),
    });
    await createLead({ branchId: a.id, name: '=cmd', status: 'new' });
    await createLead({ branchId: b.id, name: 'Khách B', status: 'contacted' });
    const res = await request(createApp()).get('/api/v1/leads/export?status=contacted').set(authHeader(manager));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv; charset=utf-8/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="khach-hang-\d{8}\.csv"/);
    expect(res.text.charCodeAt(0)).toBe(0xfeff);
    const lines = res.text.slice(1).trim().split('\r\n');
    expect(lines[0]).toBe(
      '"Mã","Họ tên","SĐT","Email","Hạng","Chi nhánh","Nguồn","Trạng thái","Người phụ trách","Hẹn liên hệ","Ngày tạo","Ghi chú"',
    );
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"Khách A"');
    expect(lines[1]).toContain('"Tân Ngãi"');
    expect(lines[1]).toContain('"Đã liên hệ"');
    expect(lines[1]).toContain('"Lê Vinh"');
    expect(lines[1]).toContain('"23/09/2026 10:00"');
  });

  it('tên khách dạng công thức được vô hiệu hóa trong file xuất', async () => {
    const a = await createBranch();
    const { user: manager } = await createUser({ role: 'branch_manager', branchIds: [a.id] });
    await createLead({ branchId: a.id, name: '=HYPERLINK("http://x")', status: 'contacted' });
    const res = await request(createApp()).get('/api/v1/leads/export?status=contacted').set(authHeader(manager));
    expect(res.text).toContain('"\'=HYPERLINK(""http://x"")"');
  });

  it('tư vấn viên không có quyền xuất (403)', async () => {
    const a = await createBranch();
    const { user: consultant } = await createUser({ role: 'consultant', branchIds: [a.id] });
    expect((await request(createApp()).get('/api/v1/leads/export').set(authHeader(consultant))).status).toBe(403);
  });
});
