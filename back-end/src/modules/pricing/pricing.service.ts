import type { FilterQuery, Types } from 'mongoose';
import { assertBranchAccess } from '../../middlewares/authorize.middleware';
import { paginate } from '../../shared/mongoose/paginate';
import { ApiError } from '../../utils/ApiError';
import { recordAudit, snapshot } from '../audit/audit.service';
import { Branch, type BranchDoc } from '../branches/branch.model';
import { getBranch } from '../branches/branches.service';
import { Course } from '../courses/course.model';
import { PriceItem, type IPriceItem, type PriceItemDoc } from './price-item.model';
import { PriceOverride } from './price-override.model';
import {
  resolveBranchPricing,
  type ResolvedCourse,
  type ResolverCourse,
  type ResolverItem,
  type ResolverOverride,
} from './pricing.resolve';
import type {
  CreatePriceItemInput,
  ListPriceItemsQuery,
  SetOverrideInput,
  UpdatePriceItemInput,
} from './pricing.validation';

type Actor = Express.AuthUser;
type Scope = Express.BranchScope | undefined;

const idOf = (value: Types.ObjectId | null | undefined): string | null => (value ? value.toString() : null);

async function loadActiveCourses(): Promise<ResolverCourse[]> {
  const courses = await Course.find({ active: true });
  return courses.map((course) => ({
    id: course.id,
    code: course.code,
    name: course.name,
    vehicleType: course.vehicleType,
    description: course.description,
    duration: course.duration,
    defaultPrice: course.defaultPrice,
    priceNote: course.priceNote,
    image: course.image ? { url: course.image.url, alt: course.image.alt } : null,
    order: course.order,
  }));
}

function toResolverItem(item: PriceItemDoc): ResolverItem {
  return {
    id: item.id,
    kind: item.kind,
    key: item.key,
    courseId: idOf(item.courseId),
    branchId: idOf(item.branchId),
    label: item.label,
    amount: item.amount,
    amountMax: item.amountMax,
    unit: item.unit,
    note: item.note,
    hidden: item.hidden,
    order: item.order,
  };
}

async function resolveFor(branchIds: string[]): Promise<Map<string, ResolvedCourse[]>> {
  const [courses, overrides, items] = await Promise.all([
    loadActiveCourses(),
    PriceOverride.find({ branchId: { $in: branchIds } }),
    PriceItem.find({ $or: [{ branchId: null }, { branchId: { $in: branchIds } }] }),
  ]);
  const resolverItems = items.map(toResolverItem);
  return new Map(
    branchIds.map((branchId) => {
      const branchOverrides: ResolverOverride[] = overrides
        .filter((override) => override.branchId.toString() === branchId)
        .map((override) => ({
          courseId: override.courseId.toString(),
          price: override.price,
          priceNote: override.priceNote,
        }));
      return [branchId, resolveBranchPricing(branchId, courses, branchOverrides, resolverItems)];
    }),
  );
}

export async function getBranchPricing(branchId: string): Promise<{ branch: BranchDoc; courses: ResolvedCourse[] }> {
  const branch = await getBranch(branchId);
  const resolved = await resolveFor([branch.id]);
  return { branch, courses: resolved.get(branch.id) ?? [] };
}

async function assertCourseExists(courseId: string): Promise<void> {
  if (!(await Course.exists({ _id: courseId }))) throw ApiError.notFound('Không tìm thấy gói học');
}

export async function setOverride(actor: Actor, scope: Scope, branchId: string, courseId: string, input: SetOverrideInput) {
  assertBranchAccess(scope, branchId);
  await getBranch(branchId);
  await assertCourseExists(courseId);
  const before = await PriceOverride.findOne({ branchId, courseId });
  const after = await PriceOverride.findOneAndUpdate(
    { branchId, courseId },
    { branchId, courseId, price: input.price, priceNote: input.priceNote ?? null },
    { upsert: true, returnDocument: 'after' },
  );
  await recordAudit({
    actorId: actor.id,
    action: 'price_override.set',
    entity: 'price_override',
    entityId: `${branchId}:${courseId}`,
    before: snapshot(before),
    after: snapshot(after),
  });
  return getBranchPricing(branchId);
}

export async function removeOverride(actor: Actor, scope: Scope, branchId: string, courseId: string): Promise<void> {
  assertBranchAccess(scope, branchId);
  const removed = await PriceOverride.findOneAndDelete({ branchId, courseId });
  if (!removed) throw ApiError.notFound('Chi nhánh này chưa có giá riêng cho gói học');
  await recordAudit({
    actorId: actor.id,
    action: 'price_override.delete',
    entity: 'price_override',
    entityId: `${branchId}:${courseId}`,
    before: snapshot(removed),
  });
}

function assertItemScope(scope: Scope, branchId: string | null): void {
  if (branchId === null) {
    if (!scope?.all) throw ApiError.forbidden('Chỉ quản trị viên cấp cao được sửa mục áp dụng cho mọi chi nhánh');
    return;
  }
  assertBranchAccess(scope, branchId);
}

function assertItemValues(values: {
  amount?: number | null;
  amountMax?: number | null;
  hidden?: boolean;
  branchId: string | null;
}): void {
  if (values.amount != null && values.amountMax != null && values.amountMax < values.amount) {
    throw ApiError.badRequest('Giá tối đa phải lớn hơn hoặc bằng giá tối thiểu', [
      { path: 'body.amountMax', message: 'Không hợp lệ' },
    ]);
  }
  if (values.hidden && values.branchId === null) {
    throw ApiError.badRequest('Chỉ mục riêng của chi nhánh mới dùng để ẩn mục chung', [
      { path: 'body.hidden', message: 'Không hợp lệ' },
    ]);
  }
}

export async function listPriceItems(query: ListPriceItemsQuery) {
  const filter: FilterQuery<IPriceItem> = {};
  if (query.kind) filter.kind = query.kind;
  if (query.branchId) filter.branchId = query.branchId === 'global' ? null : query.branchId;
  if (query.courseId) filter.courseId = query.courseId;
  return paginate(PriceItem, filter, query, 'order');
}

export async function createPriceItem(actor: Actor, scope: Scope, input: CreatePriceItemInput): Promise<PriceItemDoc> {
  const branchId = input.branchId ?? null;
  const courseId = input.courseId ?? null;
  assertItemScope(scope, branchId);
  assertItemValues({ ...input, branchId });
  if (branchId) await getBranch(branchId);
  if (courseId) await assertCourseExists(courseId);
  const item = await PriceItem.create({ ...input, branchId, courseId });
  await recordAudit({
    actorId: actor.id,
    action: 'price_item.create',
    entity: 'price_item',
    entityId: item.id,
    after: snapshot(item),
  });
  return item;
}

async function getPriceItem(id: string): Promise<PriceItemDoc> {
  const item = await PriceItem.findById(id);
  if (!item) throw ApiError.notFound('Không tìm thấy mục giá');
  return item;
}

export async function updatePriceItem(
  actor: Actor,
  scope: Scope,
  id: string,
  input: UpdatePriceItemInput,
): Promise<PriceItemDoc> {
  const item = await getPriceItem(id);
  const branchId = idOf(item.branchId);
  assertItemScope(scope, branchId);
  assertItemValues({
    amount: input.amount !== undefined ? input.amount : item.amount,
    amountMax: input.amountMax !== undefined ? input.amountMax : item.amountMax,
    hidden: input.hidden ?? item.hidden,
    branchId,
  });
  const before = snapshot(item);
  item.set(input);
  await item.save();
  await recordAudit({
    actorId: actor.id,
    action: 'price_item.update',
    entity: 'price_item',
    entityId: id,
    before,
    after: snapshot(item),
  });
  return item;
}

export async function removePriceItem(actor: Actor, scope: Scope, id: string): Promise<void> {
  const item = await getPriceItem(id);
  assertItemScope(scope, idOf(item.branchId));
  await item.deleteOne();
  await recordAudit({
    actorId: actor.id,
    action: 'price_item.delete',
    entity: 'price_item',
    entityId: id,
    before: snapshot(item),
  });
}

function publicBranch(branch: BranchDoc) {
  return { name: branch.name, slug: branch.slug, officeName: branch.officeName, address: branch.address };
}

function publicCourses(courses: ResolvedCourse[]) {
  return courses.map(({ id: _id, defaultPrice: _defaultPrice, priceSource: _priceSource, fees, discounts, ...course }) => ({
    ...course,
    fees: fees.map(({ id: _itemId, source: _source, ...fee }) => fee),
    discounts: discounts.map(({ id: _itemId, source: _source, ...discount }) => discount),
  }));
}

export async function getPublicPricing(branchSlug?: string) {
  const branches = branchSlug
    ? await Branch.find({ slug: branchSlug, status: 'active' })
    : await Branch.find({ status: 'active' }).sort('order name');
  if (branchSlug && branches.length === 0) throw ApiError.notFound('Không tìm thấy chi nhánh');
  const resolved = await resolveFor(branches.map((branch) => branch.id));
  const entries = branches.map((branch) => ({
    branch: publicBranch(branch),
    courses: publicCourses(resolved.get(branch.id) ?? []),
  }));
  return branchSlug ? entries[0] : entries;
}
