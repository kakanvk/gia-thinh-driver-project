import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { hasPermission } from '../../config/roles';
import { assertBranchAccess } from '../../middlewares/authorize.middleware';
import { validated } from '../../middlewares/validate.middleware';
import { objectIdSchema } from '../../shared/zod';
import { ApiError } from '../../utils/ApiError';
import { sendData } from '../../utils/response';
import { User } from './user.model';

export const USER_OPTION_ROLES = ['consultant', 'branch_manager', 'instructor'] as const;
type UserOptionRole = (typeof USER_OPTION_ROLES)[number];

export const userOptionsQuerySchema = z.object({
  branchId: objectIdSchema.optional(),
  role: z.enum(USER_OPTION_ROLES).optional(),
});

// Quyền cần để xem từng nhóm: tài khoản giáo viên cho màn giáo viên, nhân viên phụ trách cho khách/lịch hẹn.
export const USER_OPTIONS_PERMISSIONS = {
  staff: ['lead.read', 'appointment.read'],
  instructor: ['instructor.create', 'instructor.update'],
} as const;

// Danh sách người có thể phụ trách khách / lịch hẹn (mặc định) hoặc tài khoản giáo viên (role=instructor):
// không lộ SĐT, username. Plugin xoá mềm của User tự lọc deletedAt: null cho find.
export async function listUserOptions(scope: Express.BranchScope, branchId?: string, role?: UserOptionRole) {
  if (branchId) assertBranchAccess(scope, branchId);
  const branchIds = branchId ? [branchId] : scope.all ? null : scope.branchIds;
  const roles = role ? [role] : ['consultant', 'branch_manager'];
  const filter: Record<string, unknown> = { status: 'active', role: { $in: roles } };
  if (branchIds) filter.branchIds = { $in: branchIds.map((id) => new Types.ObjectId(id)) };
  const users = await User.find(filter).sort({ name: 1 }).select('name role branchIds').lean();
  return users.map((user) => ({
    id: String(user._id),
    name: user.name,
    role: user.role,
    branchIds: (user.branchIds ?? []).map(String),
  }));
}

export async function options(req: Request, res: Response): Promise<void> {
  const { branchId, role } = validated<z.infer<typeof userOptionsQuerySchema>>(req, 'query');
  const needed = role === 'instructor' ? USER_OPTIONS_PERMISSIONS.instructor : USER_OPTIONS_PERMISSIONS.staff;
  if (!needed.some((permission) => hasPermission(req.user!.role, permission))) throw ApiError.forbidden();
  sendData(res, await listUserOptions(req.scope!, branchId, role));
}
