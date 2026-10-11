import { randomBytes } from 'node:crypto';
import { Types, type FilterQuery } from 'mongoose';
import type { Role } from '../../config/roles';
import { paginate } from '../../shared/mongoose/paginate';
import { ApiError } from '../../utils/ApiError';
import { escapeRegex } from '../../utils/regex';
import { recordAudit, snapshot } from '../audit/audit.service';
import { revokeAllRefreshTokens } from '../auth/auth.service';
import { Branch } from '../branches/branch.model';
import { hashPassword, User, type IUser, type UserDoc, type UserStatus } from './user.model';
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from './users.validation';

type Actor = Express.AuthUser;

const MANAGER_ASSIGNABLE: readonly Role[] = ['consultant', 'instructor'];
const BRANCH_REQUIRED: readonly Role[] = ['branch_manager', 'consultant', 'instructor'];

function assertRoleBranches(role: Role, branchIds: string[]): void {
  if (BRANCH_REQUIRED.includes(role) && branchIds.length === 0) {
    throw ApiError.badRequest('Vai trò này phải được gán ít nhất một chi nhánh', [
      { path: 'body.branchIds', message: 'Bắt buộc' },
    ]);
  }
  if (!BRANCH_REQUIRED.includes(role) && branchIds.length > 0) {
    throw ApiError.badRequest('Vai trò này không gán theo chi nhánh', [
      { path: 'body.branchIds', message: 'Phải để trống' },
    ]);
  }
}

async function assertBranchesExist(branchIds: string[]): Promise<void> {
  const unique = [...new Set(branchIds)];
  if (unique.length === 0) return;
  if ((await Branch.countDocuments({ _id: { $in: unique } })) !== unique.length) {
    throw ApiError.badRequest('Có chi nhánh không tồn tại', [{ path: 'body.branchIds', message: 'Không tồn tại' }]);
  }
}

function assertActorCanAssign(actor: Actor, role: Role, branchIds: string[]): void {
  if (actor.role === 'super_admin') return;
  if (!MANAGER_ASSIGNABLE.includes(role)) throw ApiError.forbidden('Bạn chỉ được quản lý tư vấn viên và giáo viên');
  if (branchIds.some((id) => !actor.branchIds.includes(id))) throw ApiError.branchForbidden();
}

function assertNotSelf(actor: Actor, targetId: string, message: string): void {
  if (actor.id === targetId) throw ApiError.badRequest(message);
}

function visibilityFilter(actor: Actor): FilterQuery<IUser> {
  if (actor.role === 'super_admin') return {};
  return {
    role: { $in: MANAGER_ASSIGNABLE },
    branchIds: { $in: actor.branchIds.map((id) => new Types.ObjectId(id)) },
  };
}

function branchIdsOf(user: UserDoc): string[] {
  return user.branchIds.map(String);
}

export async function listUsers(actor: Actor, query: ListUsersQuery) {
  const conditions: FilterQuery<IUser>[] = [visibilityFilter(actor)];
  if (query.role) conditions.push({ role: query.role });
  if (query.status) conditions.push({ status: query.status });
  if (query.branchId) conditions.push({ branchIds: new Types.ObjectId(query.branchId) });
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    conditions.push({ $or: [{ name: pattern }, { username: pattern }, { phone: pattern }, { email: pattern }] });
  }
  return paginate(User, { $and: conditions }, query);
}

export async function getUser(actor: Actor, id: string): Promise<UserDoc> {
  const user = await User.findOne({ $and: [{ _id: id }, visibilityFilter(actor)] });
  if (!user) throw ApiError.notFound('Không tìm thấy người dùng');
  return user;
}

async function getManageableUser(actor: Actor, id: string): Promise<UserDoc> {
  const user = await getUser(actor, id);
  assertActorCanAssign(actor, user.role, branchIdsOf(user));
  return user;
}

export async function createUser(actor: Actor, input: CreateUserInput): Promise<UserDoc> {
  assertRoleBranches(input.role, input.branchIds);
  assertActorCanAssign(actor, input.role, input.branchIds);
  await assertBranchesExist(input.branchIds);

  const { password, ...rest } = input;
  const user = await User.create({ ...rest, passwordHash: await hashPassword(password) });
  await recordAudit({ actorId: actor.id, action: 'user.create', entity: 'user', entityId: user.id, after: snapshot(user) });
  return user;
}

export async function updateUser(actor: Actor, id: string, input: UpdateUserInput): Promise<UserDoc> {
  if (input.role !== undefined || input.branchIds !== undefined) {
    assertNotSelf(actor, id, 'Không thể tự đổi vai trò hoặc chi nhánh của mình');
  }
  const user = await getManageableUser(actor, id);
  const nextRole = input.role ?? user.role;
  const nextBranchIds = input.branchIds ?? branchIdsOf(user);
  assertRoleBranches(nextRole, nextBranchIds);
  assertActorCanAssign(actor, nextRole, nextBranchIds);
  const current = branchIdsOf(user);
  await assertBranchesExist((input.branchIds ?? []).filter((b) => !current.includes(b)));

  const before = snapshot(user);
  user.set(input);
  await user.save();
  await recordAudit({
    actorId: actor.id,
    action: 'user.update',
    entity: 'user',
    entityId: id,
    before,
    after: snapshot(user),
  });
  return user;
}

export async function setUserStatus(actor: Actor, id: string, status: UserStatus): Promise<UserDoc> {
  assertNotSelf(actor, id, 'Không thể tự khóa hoặc mở khóa tài khoản của mình');
  const user = await getManageableUser(actor, id);
  const before = snapshot(user);
  user.status = status;
  await user.save();
  if (status === 'suspended') await revokeAllRefreshTokens(id);
  await recordAudit({
    actorId: actor.id,
    action: 'user.status',
    entity: 'user',
    entityId: id,
    before,
    after: snapshot(user),
  });
  return user;
}

function temporaryPassword(): string {
  return `Gt${randomBytes(6).toString('base64url')}9`;
}

export async function resetUserPassword(actor: Actor, id: string): Promise<{ temporaryPassword: string }> {
  const user = await getManageableUser(actor, id);
  const password = temporaryPassword();
  user.passwordHash = await hashPassword(password);
  await user.save();
  await revokeAllRefreshTokens(id);
  await recordAudit({ actorId: actor.id, action: 'user.reset_password', entity: 'user', entityId: id });
  return { temporaryPassword: password };
}

export async function removeUser(actor: Actor, id: string): Promise<void> {
  assertNotSelf(actor, id, 'Không thể tự xóa tài khoản của mình');
  const user = await getManageableUser(actor, id);
  const before = snapshot(user);
  user.deletedAt = new Date();
  await user.save();
  await revokeAllRefreshTokens(id);
  await recordAudit({ actorId: actor.id, action: 'user.delete', entity: 'user', entityId: id, before });
}
