import { Types, type FilterQuery } from 'mongoose';
import { logger } from '../../config/logger';
import { assertBranchAccess, branchFilter } from '../../middlewares/authorize.middleware';
import { nextDailyCode } from '../../shared/codes';
import { paginate } from '../../shared/mongoose/paginate';
import { startOfVnDay } from '../../shared/time';
import { ApiError } from '../../utils/ApiError';
import { normalizePhone } from '../../utils/phone';
import { escapeRegex } from '../../utils/regex';
import { recordAudit, snapshot } from '../audit/audit.service';
import { getBranch } from '../branches/branches.service';
import { TrainingClass } from '../classes/class.model';
import { classScopeFilter, getClassDoc, seatCounts } from '../classes/classes.service';
import { Course } from '../courses/course.model';
import { ExamCandidate } from '../exams/exam-candidate.model';
import { instructorIdsOfUser } from '../instructors/instructors.scope';
import { addActivity } from '../leads/leads.activity';
import { Lead } from '../leads/lead.model';
import { Student, type IStudent, type StudentDoc } from './student.model';
import type { CreateStudentInput, ListStudentsQuery, UpdateStudentInput } from './students.validation';

type Actor = Express.AuthUser;
type Scope = Express.BranchScope | undefined;
const PRIVATE_FIELDS = ['idNumber', 'address', 'dob'] as const;

export function presentStudent(actor: Actor, student: StudentDoc): Record<string, unknown> {
  const json = student.toJSON() as Record<string, unknown>;
  if (actor.role === 'instructor') for (const field of PRIVATE_FIELDS) delete json[field];
  return json;
}

async function studentScope(actor: Actor, scope: Scope): Promise<FilterQuery<IStudent>> {
  const conditions: FilterQuery<IStudent>[] = [branchFilter(scope)];
  if (actor.role === 'instructor') {
    const classes = await TrainingClass.find({ instructorId: { $in: await instructorIdsOfUser(actor.id) } }).select('_id');
    conditions.push({ classId: { $in: classes.map((cls) => cls._id) } });
  }
  return { $and: conditions };
}

export async function getStudentDoc(actor: Actor, scope: Scope, id: string): Promise<StudentDoc> {
  const student = await Student.findOne({ $and: [{ _id: id }, await studentScope(actor, scope)] });
  if (!student) throw ApiError.notFound('Không tìm thấy học viên');
  return student;
}

export async function getStudent(actor: Actor, scope: Scope, id: string) {
  return presentStudent(actor, await getStudentDoc(actor, scope, id));
}

export async function listStudents(actor: Actor, scope: Scope, query: ListStudentsQuery) {
  const conditions: FilterQuery<IStudent>[] = [await studentScope(actor, scope)];
  if (query.branchId) {
    assertBranchAccess(scope, query.branchId);
    conditions.push({ branchId: new Types.ObjectId(query.branchId) });
  }
  if (query.status) conditions.push({ status: query.status });
  if (query.classId) conditions.push({ classId: new Types.ObjectId(query.classId) });
  if (query.courseId) conditions.push({ courseId: new Types.ObjectId(query.courseId) });
  if (query.q) {
    const text = new RegExp(escapeRegex(query.q), 'i');
    const digits = normalizePhone(query.q).replace(/\D/g, '');
    const or: FilterQuery<IStudent>[] = [{ name: text }, { code: text }];
    if (digits.length >= 3) or.push({ phone: new RegExp(digits) });
    if (/^\d{12}$/.test(query.q.trim()) && actor.role !== 'instructor') or.push({ idNumber: query.q.trim() });
    conditions.push({ $or: or });
  }
  const result = await paginate(Student, { $and: conditions }, query);
  return { data: result.data.map((student) => presentStudent(actor, student)), meta: result.meta };
}

async function assertIdNumberFree(idNumber: string | null | undefined, exceptId?: string): Promise<void> {
  if (!idNumber) return;
  const taken = await Student.exists({ idNumber, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
  if (taken)
    throw ApiError.conflict('Số CCCD đã có trong hồ sơ học viên khác', [{ path: 'body.idNumber', message: 'Đã tồn tại' }]);
}

async function assertClassFor(
  actor: Actor,
  scope: Scope,
  classId: string,
  student: { branchId: string; courseId: string; exceptStudentId?: string },
) {
  const cls = await getClassDoc(actor, scope, classId);
  if (cls.branchId.toString() !== student.branchId) throw ApiError.notFound('Không tìm thấy lớp học');
  if (cls.courseId.toString() !== student.courseId) {
    throw ApiError.badRequest('Lớp không cùng gói học với học viên', [{ path: 'body.classId', message: 'Không hợp lệ' }]);
  }
  await assertClassHasSeat(cls);
  return cls;
}

async function assertClassHasSeat(cls: Awaited<ReturnType<typeof getClassDoc>>) {
  if (cls.status === 'finished') throw ApiError.conflict('Lớp đã kết thúc, không nhận thêm học viên');
  const filled = (await seatCounts([cls._id])).get(cls.id) ?? 0;
  if (filled >= cls.capacity) throw ApiError.conflict(`Lớp ${cls.code} đã đủ ${cls.capacity} học viên`);
}

export async function createStudent(
  actor: Actor,
  scope: Scope,
  input: CreateStudentInput & { leadId?: string },
): Promise<StudentDoc> {
  assertBranchAccess(scope, input.branchId);
  await getBranch(input.branchId);
  const course = await Course.findById(input.courseId);
  if (!course) throw ApiError.badRequest('Gói học không tồn tại', [{ path: 'body.courseId', message: 'Không tồn tại' }]);
  await assertIdNumberFree(input.idNumber);
  if (input.classId)
    await assertClassFor(actor, scope, input.classId, { branchId: input.branchId, courseId: input.courseId });
  const enrolledAt = input.enrolledAt ?? startOfVnDay();
  const student = await Student.create({
    ...input,
    code: await nextDailyCode('HV', enrolledAt),
    courseCode: course.code,
    classId: input.classId ?? null,
    leadId: input.leadId ?? null,
    enrolledAt,
    status: 'studying',
  });
  await recordAudit({
    actorId: actor.id,
    action: 'student.create',
    entity: 'student',
    entityId: student.id,
    after: snapshot(student),
  });
  return student;
}

export async function updateStudent(actor: Actor, scope: Scope, id: string, input: UpdateStudentInput) {
  const student = await getStudentDoc(actor, scope, id);
  if (input.idNumber && input.idNumber !== student.idNumber) await assertIdNumberFree(input.idNumber, id);
  if (input.status && input.status !== 'dropped' && student.status === 'dropped' && student.classId) {
    await assertClassHasSeat(await getClassDoc(actor, scope, student.classId.toString()));
  }
  const before = snapshot(student);
  student.set(input);
  await student.save();
  await recordAudit({
    actorId: actor.id,
    action: 'student.update',
    entity: 'student',
    entityId: id,
    before,
    after: snapshot(student),
  });
  return presentStudent(actor, student);
}

export async function assignStudentClass(actor: Actor, scope: Scope, id: string, classId: string | null) {
  const student = await getStudentDoc(actor, scope, id);
  if (classId && classId !== student.classId?.toString()) {
    await assertClassFor(actor, scope, classId, {
      branchId: student.branchId.toString(),
      courseId: student.courseId.toString(),
    });
  }
  const before = student.classId?.toString() ?? null;
  student.classId = classId ? new Types.ObjectId(classId) : null;
  await student.save();
  await recordAudit({
    actorId: actor.id,
    action: 'student.class',
    entity: 'student',
    entityId: id,
    before: { classId: before },
    after: { classId },
  });
  return presentStudent(actor, student);
}

export async function removeStudent(actor: Actor, scope: Scope, id: string): Promise<void> {
  const student = await getStudentDoc(actor, scope, id);
  const before = snapshot(student);
  const now = new Date();
  // Clean up dependents first so a failure never leaves a deleted student with a stale "enrolled" lead.
  if (student.leadId) {
    const lead = await Lead.findOneAndUpdate(
      { _id: student.leadId, status: 'enrolled', studentId: student._id },
      { status: 'docs_completed', studentId: null, lastActivityAt: now },
    );
    if (lead) {
      try {
        await addActivity(lead.id, {
          type: 'status_change',
          fromStatus: 'enrolled',
          toStatus: 'docs_completed',
          content: `Học viên ${student.code} đã bị xóa`,
          byUserId: actor.id,
          at: now,
        });
      } catch (error) {
        logger.error({ err: error, leadId: lead.id, studentId: student.id }, 'Không ghi được hoạt động xóa học viên');
      }
    }
  }
  await ExamCandidate.deleteMany({ studentId: student._id, result: 'pending' });
  student.deletedAt = now;
  await student.save();
  await recordAudit({ actorId: actor.id, action: 'student.delete', entity: 'student', entityId: id, before });
}

export async function listClassStudents(actor: Actor, scope: Scope, classId: string) {
  const cls = await TrainingClass.findOne({ $and: [{ _id: classId }, await classScopeFilter(actor, scope)] });
  if (!cls) throw ApiError.notFound('Không tìm thấy lớp học');
  const students = await Student.find({ classId: cls._id }).sort({ name: 1, _id: 1 });
  return students.map((student) => presentStudent(actor, student));
}
