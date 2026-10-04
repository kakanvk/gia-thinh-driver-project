import { describe, expect, it } from 'vitest';
import { hasPermission } from '../../src/config/roles';

describe('hasPermission', () => {
  it('super_admin có mọi quyền', () => {
    expect(hasPermission('super_admin', 'audit.read')).toBe(true);
    expect(hasPermission('super_admin', 'bat.ky')).toBe(true);
  });

  it('wildcard theo resource', () => {
    expect(hasPermission('consultant', 'appointment.delete')).toBe(true);
  });

  it('chặn quyền không được cấp', () => {
    expect(hasPermission('consultant', 'user.manage')).toBe(false);
    expect(hasPermission('editor', 'setting.manage')).toBe(false);
    expect(hasPermission('branch_manager', 'branch.manage')).toBe(false);
  });

  it('mọi vai trò đọc được cài đặt và chi nhánh', () => {
    for (const role of ['branch_manager', 'consultant', 'editor', 'instructor'] as const) {
      expect(hasPermission(role, 'setting.read')).toBe(true);
      expect(hasPermission(role, 'branch.read')).toBe(true);
    }
  });

  it('gallery.manage cho quản lý chi nhánh, biên tập viên; không cho tư vấn viên, giáo viên', () => {
    expect(hasPermission('branch_manager', 'gallery.manage')).toBe(true);
    expect(hasPermission('editor', 'gallery.manage')).toBe(true);
    expect(hasPermission('super_admin', 'gallery.manage')).toBe(true);
    expect(hasPermission('consultant', 'gallery.manage')).toBe(false);
    expect(hasPermission('instructor', 'gallery.manage')).toBe(false);
  });
});
