import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { assertBranchAccess } from '../../middlewares/authorize.middleware';
import { validated } from '../../middlewares/validate.middleware';
import { objectIdSchema } from '../../shared/zod';
import { sendData } from '../../utils/response';
import { User } from './user.model';

export const userOptionsQuerySchema = z.object({
  branchId: objectIdSchema.optional(),
});

// Danh sách người có thể phụ trách khách / lịch hẹn: không lộ SĐT, username.
// Plugin xoá mềm của User tự lọc deletedAt: null cho find.
export async function listUserOptions(scope: Express.BranchScope, branchId?: string) {
  if (branchId) assertBranchAccess(scope, branchId);
  const branchIds = branchId ? [branchId] : scope.all ? null : scope.branchIds;
  const filter: Record<string, unknown> = { status: 'active', role: { $in: ['consultant', 'branch_manager'] } };
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
  const { branchId } = validated<z.infer<typeof userOptionsQuerySchema>>(req, 'query');
  sendData(res, await listUserOptions(req.scope!, branchId));
}
