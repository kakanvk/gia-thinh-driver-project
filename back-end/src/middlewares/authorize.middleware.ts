import type { RequestHandler } from 'express';
import { Types } from 'mongoose';
import { hasPermission } from '../config/roles';
import { ApiError } from '../utils/ApiError';

export function authorize(permission: string, opts: { branchScoped?: boolean } = {}): RequestHandler {
  return (req, _res, next) => {
    const user = req.user;
    if (!user) return next(ApiError.unauthorized());
    if (!hasPermission(user.role, permission)) return next(ApiError.forbidden());
    if (opts.branchScoped) req.scope = { all: user.role === 'super_admin', branchIds: user.branchIds };
    next();
  };
}

export function branchFilter(scope: Express.BranchScope | undefined, field = 'branchId'): Record<string, unknown> {
  if (!scope) throw new Error('Route chưa bật authorize(..., { branchScoped: true })');
  if (scope.all) return {};
  return { [field]: { $in: scope.branchIds.map((id) => new Types.ObjectId(id)) } };
}

export function assertBranchAccess(scope: Express.BranchScope | undefined, branchIds: string | string[]): void {
  if (!scope) throw new Error('Route chưa bật authorize(..., { branchScoped: true })');
  if (scope.all) return;
  const ids = Array.isArray(branchIds) ? branchIds : [branchIds];
  if (ids.some((id) => !scope.branchIds.includes(String(id)))) throw ApiError.branchForbidden();
}

// Cho qua khi người dùng có ít nhất một trong các quyền
export function authorizeAny(permissions: string[], opts: { branchScoped?: boolean } = {}): RequestHandler {
  return (req, _res, next) => {
    const user = req.user;
    if (!user) return next(ApiError.unauthorized());
    if (!permissions.some((permission) => hasPermission(user.role, permission))) return next(ApiError.forbidden());
    if (opts.branchScoped) req.scope = { all: user.role === 'super_admin', branchIds: user.branchIds };
    next();
  };
}
