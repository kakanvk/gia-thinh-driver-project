import type { FilterQuery } from 'mongoose';
import { paginate } from '../../shared/mongoose/paginate';
import { WITH_DELETED } from '../../shared/mongoose/softDelete';
import { ApiError } from '../../utils/ApiError';
import { escapeRegex } from '../../utils/regex';
import { slugify } from '../../utils/slugify';
import { recordAudit, snapshot } from '../audit/audit.service';
import { User } from '../users/user.model';
import { Branch, type BranchDoc, type IBranch } from './branch.model';
import type { CreateBranchInput, ListBranchesQuery, UpdateBranchInput } from './branches.validation';

type Actor = Express.AuthUser;

export async function listBranches(query: ListBranchesQuery) {
  const filter: FilterQuery<IBranch> = {};
  if (query.status) filter.status = query.status;
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ name: pattern }, { officeName: pattern }, { address: pattern }];
  }
  return paginate(Branch, filter, query, 'order');
}

export async function getBranch(id: string): Promise<BranchDoc> {
  const branch = await Branch.findById(id);
  if (!branch) throw ApiError.notFound('Không tìm thấy chi nhánh');
  return branch;
}

async function assertManager(managerId: string | null | undefined): Promise<void> {
  if (!managerId) return;
  if (!(await User.exists({ _id: managerId, role: 'branch_manager' }))) {
    throw ApiError.badRequest('Người quản lý phải là tài khoản quản lý chi nhánh', [
      { path: 'body.managerId', message: 'Không hợp lệ' },
    ]);
  }
}

async function assertSlugFree(slug: string, exceptId?: string): Promise<void> {
  const taken = await Branch.exists({ slug, ...WITH_DELETED, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
  if (taken) throw ApiError.conflict('Slug chi nhánh đã tồn tại', [{ path: 'body.slug', message: 'Đã tồn tại' }]);
}

export async function createBranch(actor: Actor, input: CreateBranchInput): Promise<BranchDoc> {
  await assertManager(input.managerId);
  const slug = input.slug ?? slugify(input.name);
  await assertSlugFree(slug);
  const branch = await Branch.create({ ...input, slug });
  await recordAudit({
    actorId: actor.id,
    action: 'branch.create',
    entity: 'branch',
    entityId: branch.id,
    after: snapshot(branch),
  });
  return branch;
}

export async function updateBranch(actor: Actor, id: string, input: UpdateBranchInput): Promise<BranchDoc> {
  const branch = await getBranch(id);
  await assertManager(input.managerId);
  if (input.slug && input.slug !== branch.slug) await assertSlugFree(input.slug, id);
  const before = snapshot(branch);
  branch.set(input);
  await branch.save();
  await recordAudit({
    actorId: actor.id,
    action: 'branch.update',
    entity: 'branch',
    entityId: id,
    before,
    after: snapshot(branch),
  });
  return branch;
}

export async function removeBranch(actor: Actor, id: string): Promise<void> {
  const branch = await getBranch(id);
  const before = snapshot(branch);
  branch.deletedAt = new Date();
  await branch.save();
  await recordAudit({ actorId: actor.id, action: 'branch.delete', entity: 'branch', entityId: id, before });
}

export async function listPublicBranches() {
  return Branch.find({ status: 'active' })
    .sort('order name')
    .select('name slug officeName address mapUrl phone openingHours order');
}
