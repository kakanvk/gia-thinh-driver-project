import { Types, type FilterQuery } from 'mongoose';
import { assertBranchAccess, branchFilter } from '../../middlewares/authorize.middleware';
import { paginate } from '../../shared/mongoose/paginate';
import { ApiError } from '../../utils/ApiError';
import { normalizePhone } from '../../utils/phone';
import { escapeRegex } from '../../utils/regex';
import { recordAudit, snapshot } from '../audit/audit.service';
import { getBranch } from '../branches/branches.service';
import { ACTIVE_CLASS_STATUSES, TrainingClass } from '../classes/class.model';
import { ExamCandidate } from '../exams/exam-candidate.model';
import { ExamSession } from '../exams/exam-session.model';
import { Student } from '../students/student.model';
import { User } from '../users/user.model';
import { Instructor, type IInstructor, type InstructorDoc } from './instructor.model';
import type { CreateInstructorInput, ListInstructorsQuery, UpdateInstructorInput } from './instructors.validation';

type Actor = Express.AuthUser;
type Scope = Express.BranchScope | undefined;

export async function listInstructors(scope: Scope, query: ListInstructorsQuery) {
  const conditions: FilterQuery<IInstructor>[] = [branchFilter(scope)];
  if (query.branchId) {
    assertBranchAccess(scope, query.branchId);
    conditions.push({ branchId: new Types.ObjectId(query.branchId) });
  }
  if (query.status) conditions.push({ status: query.status });
  if (query.q) {
    const text = new RegExp(escapeRegex(query.q), 'i');
    const digits = normalizePhone(query.q).replace(/\D/g, '');
    conditions.push({ $or: [{ name: text }, ...(digits.length >= 3 ? [{ phone: new RegExp(digits) }] : [])] });
  }
  return paginate(Instructor, { $and: conditions }, query, 'name');
}

export async function getInstructor(scope: Scope, id: string): Promise<InstructorDoc> {
  const instructor = await Instructor.findOne({ $and: [{ _id: id }, branchFilter(scope)] });
  if (!instructor) throw ApiError.notFound('Không tìm thấy giáo viên');
  return instructor;
}

async function assertLinkableUser(userId: string, branchId: string, exceptInstructorId?: string): Promise<void> {
  const user = await User.findOne({
    _id: userId,
    role: 'instructor',
    status: 'active',
    branchIds: new Types.ObjectId(branchId),
  });
  if (!user) {
    throw ApiError.badRequest('Tài khoản liên kết phải là giáo viên đang hoạt động thuộc cùng chi nhánh', [
      { path: 'body.userId', message: 'Không hợp lệ' },
    ]);
  }
  const taken = await Instructor.exists({ userId, ...(exceptInstructorId ? { _id: { $ne: exceptInstructorId } } : {}) });
  if (taken) throw ApiError.conflict('Tài khoản này đã gắn với một hồ sơ giáo viên khác');
}

export async function assertInstructorInBranch(instructorId: string, branchId: string): Promise<InstructorDoc> {
  const instructor = await Instructor.findOne({
    _id: instructorId,
    branchId: new Types.ObjectId(branchId),
    status: { $ne: 'inactive' },
  });
  if (!instructor) {
    throw ApiError.badRequest('Giáo viên phải thuộc cùng chi nhánh và chưa nghỉ việc', [
      { path: 'body.instructorId', message: 'Không hợp lệ' },
    ]);
  }
  return instructor;
}

export async function createInstructor(actor: Actor, scope: Scope, input: CreateInstructorInput): Promise<InstructorDoc> {
  assertBranchAccess(scope, input.branchId);
  await getBranch(input.branchId);
  if (input.userId) await assertLinkableUser(input.userId, input.branchId);
  const instructor = await Instructor.create({
    ...input,
    specialties: input.specialties ?? [],
    userId: input.userId ?? null,
  });
  await recordAudit({
    actorId: actor.id,
    action: 'instructor.create',
    entity: 'instructor',
    entityId: instructor.id,
    after: snapshot(instructor),
  });
  return instructor;
}

const ACTIVE_CLASSES_MESSAGE = 'Giáo viên còn phụ trách lớp đang hoạt động, hãy đổi giáo viên cho các lớp đó trước';

async function assertNoActiveClasses(instructorId: Types.ObjectId): Promise<void> {
  if (await TrainingClass.exists({ instructorId, status: { $in: ACTIVE_CLASS_STATUSES } })) {
    throw ApiError.conflict(ACTIVE_CLASSES_MESSAGE);
  }
}

export async function updateInstructor(
  actor: Actor,
  scope: Scope,
  id: string,
  input: UpdateInstructorInput,
): Promise<InstructorDoc> {
  const instructor = await getInstructor(scope, id);
  if (input.userId) await assertLinkableUser(input.userId, instructor.branchId.toString(), id);
  if (input.status === 'inactive' && instructor.status !== 'inactive') await assertNoActiveClasses(instructor._id);
  const before = snapshot(instructor);
  instructor.set(input);
  await instructor.save();
  await recordAudit({
    actorId: actor.id,
    action: 'instructor.update',
    entity: 'instructor',
    entityId: id,
    before,
    after: snapshot(instructor),
  });
  return instructor;
}

export async function removeInstructor(actor: Actor, scope: Scope, id: string): Promise<void> {
  const instructor = await getInstructor(scope, id);
  await assertNoActiveClasses(instructor._id);
  const before = snapshot(instructor);
  instructor.deletedAt = new Date();
  instructor.userId = null;
  await instructor.save();
  await recordAudit({ actorId: actor.id, action: 'instructor.delete', entity: 'instructor', entityId: id, before });
}

export async function getInstructorStats(scope: Scope, id: string) {
  const instructor = await getInstructor(scope, id);
  const classes = await TrainingClass.find({ instructorId: instructor._id }).select('_id status');
  const classIds = classes.map((cls) => cls._id);
  const students = await Student.find({ classId: { $in: classIds }, status: { $ne: 'dropped' } }).select('_id');
  const officialSessions = await ExamSession.find({ type: 'official' }).select('_id');
  const rows = await ExamCandidate.aggregate<{ _id: string; count: number }>([
    {
      $match: {
        studentId: { $in: students.map((s) => s._id) },
        sessionId: { $in: officialSessions.map((s) => s._id) },
      },
    },
    { $group: { _id: '$result', count: { $sum: 1 } } },
  ]);
  const count = (result: string) => rows.find((row) => row._id === result)?.count ?? 0;
  const passed = count('passed');
  const failed = count('failed');
  return {
    classes: {
      total: classes.length,
      active: classes.filter((cls) => ACTIVE_CLASS_STATUSES.includes(cls.status)).length,
    },
    students: students.length,
    official: {
      passed,
      failed,
      absent: count('absent'),
      passRate: passed + failed === 0 ? null : Math.round((passed / (passed + failed)) * 1000) / 10,
    },
  };
}
