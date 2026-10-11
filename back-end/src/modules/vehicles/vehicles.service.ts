import { Types, type FilterQuery } from 'mongoose';
import { assertBranchAccess, branchFilter } from '../../middlewares/authorize.middleware';
import { paginate } from '../../shared/mongoose/paginate';
import { addFixedDays, startOfVnDay } from '../../shared/time';
import { ApiError } from '../../utils/ApiError';
import { escapeRegex } from '../../utils/regex';
import { recordAudit, snapshot } from '../audit/audit.service';
import { getBranch } from '../branches/branches.service';
import { Course } from '../courses/course.model';
import { Vehicle, type IVehicle, type VehicleDoc } from './vehicle.model';
import type { CreateVehicleInput, ListVehiclesQuery, UpdateVehicleInput } from './vehicles.validation';

type Actor = Express.AuthUser;
type Scope = Express.BranchScope | undefined;
const DAY_MS = 86_400_000;

async function assertCourseCode(code: string): Promise<void> {
  if (!(await Course.exists({ code }))) {
    throw ApiError.badRequest('Hạng bằng không tồn tại', [{ path: 'body.courseCode', message: 'Không tồn tại' }]);
  }
}

async function assertPlateFree(plate: string, exceptId?: string): Promise<void> {
  const taken = await Vehicle.exists({ plate, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
  if (taken) throw ApiError.conflict('Biển số đã tồn tại', [{ path: 'body.plate', message: 'Đã tồn tại' }]);
}

export async function listVehicles(scope: Scope, query: ListVehiclesQuery) {
  const conditions: FilterQuery<IVehicle>[] = [branchFilter(scope)];
  if (query.branchId) {
    assertBranchAccess(scope, query.branchId);
    conditions.push({ branchId: new Types.ObjectId(query.branchId) });
  }
  if (query.status) conditions.push({ status: query.status });
  if (query.courseCode) conditions.push({ courseCode: query.courseCode });
  if (query.q) {
    const text = new RegExp(escapeRegex(query.q), 'i');
    conditions.push({ $or: [{ plate: text }, { model: text }] });
  }
  return paginate(Vehicle, { $and: conditions }, query, 'plate');
}

export async function getVehicle(scope: Scope, id: string): Promise<VehicleDoc> {
  const vehicle = await Vehicle.findOne({ $and: [{ _id: id }, branchFilter(scope)] });
  if (!vehicle) throw ApiError.notFound('Không tìm thấy xe');
  return vehicle;
}

export async function createVehicle(actor: Actor, scope: Scope, input: CreateVehicleInput): Promise<VehicleDoc> {
  assertBranchAccess(scope, input.branchId);
  await getBranch(input.branchId);
  await assertCourseCode(input.courseCode);
  await assertPlateFree(input.plate);
  const vehicle = await Vehicle.create(input);
  await recordAudit({
    actorId: actor.id,
    action: 'vehicle.create',
    entity: 'vehicle',
    entityId: vehicle.id,
    after: snapshot(vehicle),
  });
  return vehicle;
}

export async function updateVehicle(actor: Actor, scope: Scope, id: string, input: UpdateVehicleInput): Promise<VehicleDoc> {
  const vehicle = await getVehicle(scope, id);
  if (input.courseCode) await assertCourseCode(input.courseCode);
  if (input.plate && input.plate !== vehicle.plate) await assertPlateFree(input.plate, id);
  const before = snapshot(vehicle);
  vehicle.set(input);
  await vehicle.save();
  await recordAudit({
    actorId: actor.id,
    action: 'vehicle.update',
    entity: 'vehicle',
    entityId: id,
    before,
    after: snapshot(vehicle),
  });
  return vehicle;
}

export async function removeVehicle(actor: Actor, scope: Scope, id: string): Promise<void> {
  const vehicle = await getVehicle(scope, id);
  const before = snapshot(vehicle);
  vehicle.deletedAt = new Date();
  await vehicle.save();
  await recordAudit({ actorId: actor.id, action: 'vehicle.delete', entity: 'vehicle', entityId: id, before });
}

export async function listVehicleAlerts(scope: Scope, days: number) {
  const today = startOfVnDay();
  const horizon = addFixedDays(today, days + 1);
  const vehicles = await Vehicle.find({
    $and: [
      branchFilter(scope),
      { status: { $ne: 'paused' } },
      { $or: [{ nextServiceAt: { $ne: null, $lt: horizon } }, { registrationExpiresAt: { $ne: null, $lt: horizon } }] },
    ],
  });
  const reasonOf = (type: 'service' | 'registration', dueAt: Date | null | undefined) => {
    if (!dueAt || dueAt >= horizon) return null;
    const daysLeft = Math.round((dueAt.getTime() - today.getTime()) / DAY_MS);
    return { type, dueAt, daysLeft, overdue: daysLeft < 0 };
  };
  return vehicles
    .map((vehicle) => ({
      vehicle,
      reasons: [reasonOf('service', vehicle.nextServiceAt), reasonOf('registration', vehicle.registrationExpiresAt)]
        .filter((reason): reason is NonNullable<typeof reason> => reason !== null)
        .sort((x, y) => x.daysLeft - y.daysLeft),
    }))
    .sort((x, y) => (x.reasons[0]?.daysLeft ?? 0) - (y.reasons[0]?.daysLeft ?? 0));
}
