import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { Branch } from '../../src/modules/branches/branch.model';
import { Setting } from '../../src/modules/settings/setting.model';
import { User } from '../../src/modules/users/user.model';
import { runSeed } from '../../src/scripts/seed';

const admin = { adminUsername: 'Admin', adminPhone: '0779 666 664', adminPassword: 'Matkhau123' };

describe('runSeed', () => {
  it('tạo 5 chi nhánh, cài đặt và super_admin; chạy lại không nhân đôi', async () => {
    await runSeed(admin);
    await runSeed(admin);
    expect(await Branch.countDocuments()).toBe(5);
    expect(await User.countDocuments({ role: 'super_admin' })).toBe(1);
    expect(await Setting.countDocuments({ key: { $ne: '__seed_catalog_v1' } })).toBe(8);

    const vungLiem = await Branch.findOne({ slug: 'vung-liem' });
    expect(vungLiem).toMatchObject({ officeName: 'VP Vũng Liêm', order: 5 });

    const login = await request(createApp())
      .post('/api/v1/auth/login')
      .send({ identifier: '0779666664', password: 'Matkhau123' });
    expect(login.status).toBe(200);
  });

  it('không ghi đè giá trị admin đã sửa', async () => {
    await runSeed();
    await Setting.updateOne({ key: 'hotline' }, { value: '0909 000 000' });
    await runSeed();
    expect((await Setting.findOne({ key: 'hotline' }))?.value).toBe('0909 000 000');
  });

  it('bỏ qua tạo admin khi không khai báo SEED_ADMIN_*', async () => {
    await runSeed();
    expect(await User.countDocuments()).toBe(0);
  });

  it('báo lỗi khi chỉ khai báo một phần SEED_ADMIN_*', async () => {
    await expect(runSeed({ adminUsername: 'admin', adminPassword: 'Matkhau123' })).rejects.toThrow('SEED_ADMIN_PHONE');
    expect(await Branch.countDocuments()).toBe(0);
  });
});
