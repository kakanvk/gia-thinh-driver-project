import mongoose, { Types, type FilterQuery } from 'mongoose';
import { assertBranchAccess, branchFilter } from '../../middlewares/authorize.middleware';
import { paginate } from '../../shared/mongoose/paginate';
import { WITH_DELETED } from '../../shared/mongoose/softDelete';
import { ApiError } from '../../utils/ApiError';
import { escapeRegex } from '../../utils/regex';
import { recordAudit, snapshot } from '../audit/audit.service';
import { getBranch } from '../branches/branches.service';
import { Course } from '../courses/course.model';
import { Instructor } from '../instructors/instructor.model';
import { instructorIdsOfUser } from '../instructors/instructors.scope';
import { assertInstructorInBranch } from '../instructors/instructors.service';
import { SEATED_STUDENT_STATUSES, TrainingClass, type ITrainingClass, type TrainingClassDoc } from './class.model';
import type { CreateClassInput, ListClassesQuery, UpdateClassInput } from './classes.validation';

type Actor = Express.AuthUser;
type Scope = Express.BranchScope | undefined;

/** Đếm sĩ số theo lớp, đọc thẳng collection `students` để không phụ thuộc vòng tròn với module students. */
export async function seatCounts(classIds: Types.ObjectId[]): Promise<Map<string, number>> {
  if (classIds.length === 0) return new Map();
  const rows = await mongoose.connection
    .collection('students')
    .aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { classId: { $in: classIds }, status: { $in: SEATED_STUDENT_STATUSES }, deletedAt: null } },
      { $group: { _id: '$classId', count: { $sum: 1 } } },
    ])
    .toArray();
  return new Map(rows.map((row) => [row._id.toString(), row.count]));
}

export async function classScopeFilter(actor: Actor, scope: Scope): Promise<FilterQuery<ITrainingClass>> {
  const conditions: FilterQuery<ITrainingClass>[] = [branchFilter(scope)];
  if (actor.role === 'instructor') conditions.push({ instructorId: { $in: await instructorIdsOfUser(actor.id) } });
  return { $and: conditions };
}

async function present(classes: TrainingClassDoc[]) {
  const [counts, courses, instructors] = await Promise.all([
    seatCounts(classes.map((cls) => cls._id)),
    Course.find({ _id: { $in: classes.map((cls) => cls.courseId) }, ...WITH_DELETED }),
    Instructor.find({
      _id: { $in: classes.flatMap((cls) => (cls.instructorId ? [cls.instructorId] : [])) },
      ...WITH_DELETED,
    }),
  ]);
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const instructorById = new Map(instructors.map((instructor) => [instructor.id, instructor]));
  return classes.map((cls) => {
    const filled = counts.get(cls.id) ?? 0;
    const course = courseById.get(cls.courseId.toString());
    const instructor = cls.instructorId ? instructorById.get(cls.instructorId.toString()) : undefined;
    return {
      ...(cls.toJSON() as Record<string, unknown>),
      filled,
      seatsLeft: Math.max(0, cls.capacity - filled),
      course: course ? { id: course.id, code: course.code, name: course.name } : null,
      instructor: instructor ? { id: instructor.id, name: instructor.name } : null,
    };
  });
}

export async function getClassDoc(actor: Actor, scope: Scope, id: string): Promise<TrainingClassDoc> {
  const cls = await TrainingClass.findOne({ $and: [{ _id: id }, await classScopeFilter(actor, scope)] });
  if (!cls) throw ApiError.notFound('Không tìm thấy lớp học');
  return cls;
}

export async function listClasses(actor: Actor, scope: Scope, query: ListClassesQuery) {
  const conditions: FilterQuery<ITrainingClass>[] = [await classScopeFilter(actor, scope)];
  if (query.branchId) {
    assertBranchAccess(scope, query.branchId);
    conditions.push({ branchId: new Types.ObjectId(query.branchId) });
  }
  if (query.status) conditions.push({ status: query.status });
  if (query.courseId) conditions.push({ courseId: new Types.ObjectId(query.courseId) });
  if (query.instructorId) conditions.push({ instructorId: new Types.ObjectId(query.instructorId) });
  if (query.q) conditions.push({ code: new RegExp(escapeRegex(query.q), 'i') });
  const result = await paginate(TrainingClass, { $and: conditions }, query, '-startDate');
  return { data: await present(result.data), meta: result.meta };
}

export async function getClass(actor: Actor, scope: Scope, id: string) {
  const [view] = await present([await getClassDoc(actor, scope, id)]);
  return view;
}

async function assertCodeFree(code: string, exceptId?: string): Promise<void> {
  const taken = await TrainingClass.exists({ code, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
  if (taken) throw ApiError.conflict('Mã lớp đã tồn tại', [{ path: 'body.code', message: 'Đã tồn tại' }]);
}

export async function createClass(actor: Actor, scope: Scope, input: CreateClassInput) {
  assertBranchAccess(scope, input.branchId);
  await getBranch(input.branchId);
  const course = await Course.findById(input.courseId);
  if (!course) throw ApiError.badRequest('Gói học không tồn tại', [{ path: 'body.courseId', message: 'Không tồn tại' }]);
  if (input.instructorId) await assertInstructorInBranch(input.instructorId, input.branchId);
  await assertCodeFree(input.code);
  const cls = await TrainingClass.create({ ...input, courseCode: course.code, instructorId: input.instructorId ?? null });
  await recordAudit({ actorId: actor.id, action: 'class.create', entity: 'class', entityId: cls.id, after: snapshot(cls) });
  return getClass(actor, scope, cls.id);
}

export async function updateClass(actor: Actor, scope: Scope, id: string, input: UpdateClassInput) {
  const cls = await getClassDoc(actor, scope, id);
  if (input.code && input.code !== cls.code) await assertCodeFree(input.code, id);
  if (input.instructorId) await assertInstructorInBranch(input.instructorId, cls.branchId.toString());
  const startDate = input.startDate ?? cls.startDate;
  const endDate = input.endDate ?? cls.endDate;
  if (endDate < startDate)
    throw ApiError.badRequest('Ngày kết thúc phải sau ngày khai giảng', [{ path: 'body.endDate', message: 'Không hợp lệ' }]);
  if (input.capacity !== undefined) {
    const filled = (await seatCounts([cls._id])).get(cls.id) ?? 0;
    if (input.capacity < filled)
      throw ApiError.conflict(`Lớp đang có ${filled} học viên, không thể giảm sĩ số tối đa xuống ${input.capacity}`);
  }
  const before = snapshot(cls);
  cls.set(input);
  await cls.save();
  await recordAudit({
    actorId: actor.id,
    action: 'class.update',
    entity: 'class',
    entityId: id,
    before,
    after: snapshot(cls),
  });
  return getClass(actor, scope, id);
}

export async function removeClass(actor: Actor, scope: Scope, id: string): Promise<void> {
  const cls = await getClassDoc(actor, scope, id);
  const students = mongoose.connection.collection('students');
  const hasSeated = await students.countDocuments(
    { classId: cls._id, status: { $in: SEATED_STUDENT_STATUSES }, deletedAt: null },
    { limit: 1 },
  );
  if (hasSeated) throw ApiError.conflict('Lớp còn học viên, hãy chuyển học viên sang lớp khác trước');
  const before = snapshot(cls);
  cls.deletedAt = new Date();
  await cls.save();
  await students.updateMany({ classId: cls._id, deletedAt: null }, { $set: { classId: null } });
  await recordAudit({ actorId: actor.id, action: 'class.delete', entity: 'class', entityId: id, before });
}
