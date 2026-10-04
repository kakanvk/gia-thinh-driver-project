import type { Role } from '../../src/config/roles';
import { Branch, type BranchDoc } from '../../src/modules/branches/branch.model';
import { hashPassword, User, type UserDoc, type UserStatus } from '../../src/modules/users/user.model';

import { signAccessToken } from '../../src/utils/jwt';

let seq = 0;

export async function createUser(
  overrides: Partial<{
    name: string;
    username: string;
    phone: string;
    role: Role;
    branchIds: string[];
    password: string;
    status: UserStatus;
  }> = {},
): Promise<{ user: UserDoc; password: string }> {
  seq += 1;
  const password = overrides.password ?? 'Matkhau123';
  const user = await User.create({
    name: overrides.name ?? `Nhân viên ${seq}`,
    username: overrides.username ?? `nv${seq}`,
    phone: overrides.phone ?? `09${String(seq).padStart(8, '0')}`,
    role: overrides.role ?? 'super_admin',
    branchIds: overrides.branchIds ?? [],
    status: overrides.status ?? 'active',
    passwordHash: await hashPassword(password),
  });
  return { user, password };
}

export function authHeader(user: UserDoc): { Authorization: string } {
  return { Authorization: `Bearer ${signAccessToken({ id: user.id, role: user.role })}` };
}

let branchSeq = 0;

export async function createBranch(
  overrides: Partial<{ name: string; slug: string; status: 'active' | 'inactive'; order: number }> = {},
): Promise<BranchDoc> {
  branchSeq += 1;
  const name = overrides.name ?? `Chi nhánh ${branchSeq}`;
  return Branch.create({
    name,
    slug: overrides.slug ?? `chi-nhanh-${branchSeq}`,
    officeName: `VP ${name}`,
    address: `Số ${branchSeq}, T. Vĩnh Long`,
    order: overrides.order ?? branchSeq,
    status: overrides.status ?? 'active',
  });
}
