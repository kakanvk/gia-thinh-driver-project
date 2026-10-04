import { Types, type FilterQuery } from 'mongoose';
import { assertBranchAccess, branchFilter } from '../../middlewares/authorize.middleware';
import { paginate } from '../../shared/mongoose/paginate';
import { WITH_DELETED } from '../../shared/mongoose/softDelete';
import { addFixedDays } from '../../shared/time';
import { ApiError } from '../../utils/ApiError';
import { escapeRegex } from '../../utils/regex';
import { recordAudit, snapshot } from '../audit/audit.service';
import { getBranch } from '../branches/branches.service';
import { Course } from '../courses/course.model';
import { Student } from '../students/student.model';
import { ExamCandidate, type ExamResult } from './exam-candidate.model';
import { ExamSession, type ExamSessionDoc, type IExamSession } from './exam-session.model';
import type { CandidateResultInput, CreateExamInput, ListExamsQuery, UpdateExamInput } from './exams.validation';

type Actor = Express.AuthUser;
type Scope = Express.BranchScope | undefined;
type Stats = Record<'candidates' | ExamResult, number>;

const emptyStats = (): Stats => ({ candidates: 0, passed: 0, failed: 0, absent: 0, pending: 0 });

async function statsFor(sessionIds: Types.ObjectId[]): Promise<Map<string, Stats>> {
  const rows = await ExamCandidate.aggregate<{
    _id: { sessionId: Types.ObjectId; result: ExamResult };
    count: number;
  }>([
    { $match: { sessionId: { $in: sessionIds } } },
    { $group: { _id: { sessionId: '$sessionId', result: '$result' }, count: { $sum: 1 } } },
  ]);
  const stats = new Map<string, Stats>();
  for (const row of rows) {
    const key = row._id.sessionId.toString();
    const entry = stats.get(key) ?? emptyStats();
    entry[row._id.result] += row.count;
    entry.candidates += row.count;
    stats.set(key, entry);
  }
  return stats;
}

export async function getExamDoc(scope: Scope, id: string): Promise<ExamSessionDoc> {
  const session = await ExamSession.findOne({ $and: [{ _id: id }, branchFilter(scope)] });
  if (!session) throw ApiError.notFound('Không tìm thấy ca thi');
  return session;
}

export async function getExam(scope: Scope, id: string) {
  const session = await getExamDoc(scope, id);
  const stats = (await statsFor([session._id])).get(session.id) ?? emptyStats();
  return { ...(session.toJSON() as Record<string, unknown>), stats };
}

export async function listExams(scope: Scope, query: ListExamsQuery) {
  const conditions: FilterQuery<IExamSession>[] = [branchFilter(scope)];
  if (query.branchId) {
    assertBranchAccess(scope, query.branchId);
    conditions.push({ branchId: new Types.ObjectId(query.branchId) });
  }
  if (query.type) conditions.push({ type: query.type });
  if (query.status) conditions.push({ status: query.status });
  if (query.courseId) conditions.push({ courseId: new Types.ObjectId(query.courseId) });
  if (query.from || query.to) {
    conditions.push({
      date: {
        ...(query.from ? { $gte: query.from } : {}),
        ...(query.to ? { $lt: addFixedDays(query.to, 1) } : {}),
      },
    });
  }
  if (query.q) conditions.push({ code: new RegExp(escapeRegex(query.q), 'i') });
  const result = await paginate(ExamSession, { $and: conditions }, query, '-date');
  const stats = await statsFor(result.data.map((session) => session._id));
  return {
    data: result.data.map((session) => ({
      ...(session.toJSON() as Record<string, unknown>),
      stats: stats.get(session.id) ?? emptyStats(),
    })),
    meta: result.meta,
  };
}

async function assertCodeFree(code: string, exceptId?: string): Promise<void> {
  const taken = await ExamSession.exists({ code, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
  if (taken) throw ApiError.conflict('Mã ca thi đã tồn tại', [{ path: 'body.code', message: 'Đã tồn tại' }]);
}

export async function createExam(actor: Actor, scope: Scope, input: CreateExamInput) {
  assertBranchAccess(scope, input.branchId);
  await getBranch(input.branchId);
  const course = await Course.findById(input.courseId);
  if (!course) throw ApiError.badRequest('Gói học không tồn tại', [{ path: 'body.courseId', message: 'Không tồn tại' }]);
  await assertCodeFree(input.code);
  const session = await ExamSession.create({ ...input, courseCode: course.code });
  await recordAudit({
    actorId: actor.id,
    action: 'exam.create',
    entity: 'exam',
    entityId: session.id,
    after: snapshot(session),
  });
  return getExam(scope, session.id);
}

export async function updateExam(actor: Actor, scope: Scope, id: string, input: UpdateExamInput) {
  const session = await getExamDoc(scope, id);
  if (input.code && input.code !== session.code) await assertCodeFree(input.code, id);
  const before = snapshot(session);
  session.set(input);
  await session.save();
  await recordAudit({
    actorId: actor.id,
    action: 'exam.update',
    entity: 'exam',
    entityId: id,
    before,
    after: snapshot(session),
  });
  return getExam(scope, id);
}

export async function removeExam(actor: Actor, scope: Scope, id: string): Promise<void> {
  const session = await getExamDoc(scope, id);
  if (await ExamCandidate.exists({ sessionId: session._id, result: { $ne: 'pending' } })) {
    throw ApiError.conflict('Ca thi đã có kết quả, không thể xóa (có thể chuyển sang "đã hủy")');
  }
  const before = snapshot(session);
  await ExamCandidate.deleteMany({ sessionId: session._id });
  session.deletedAt = new Date();
  await session.save();
  await recordAudit({ actorId: actor.id, action: 'exam.delete', entity: 'exam', entityId: id, before });
}

export async function addCandidates(actor: Actor, scope: Scope, id: string, studentIds: string[]) {
  const session = await getExamDoc(scope, id);
  if (session.status !== 'scheduled') throw ApiError.conflict('Chỉ thêm thí sinh vào ca thi đang lên lịch');
  const unique = [...new Set(studentIds)];
  // Validate every student before inserting anything: all-or-nothing.
  const students = await Student.find({
    _id: { $in: unique },
    branchId: session.branchId,
    courseId: session.courseId,
    status: 'studying',
  });
  if (students.length !== unique.length) {
    const okIds = new Set(students.map((student) => student.id));
    throw ApiError.badRequest(
      'Có học viên không hợp lệ cho ca thi này (khác chi nhánh, khác gói học hoặc không còn đang học)',
      [{ path: 'body.studentIds', message: unique.filter((studentId) => !okIds.has(studentId)).join(',') }],
    );
  }
  const existing = await ExamCandidate.find({ sessionId: session._id, studentId: { $in: unique } });
  const skipped = existing.map((candidate) => candidate.studentId.toString());
  const toAdd = unique.filter((studentId) => !skipped.includes(studentId));
  const sameTypeSessions = await ExamSession.find({
    type: session.type,
    _id: { $ne: session._id },
    status: { $ne: 'cancelled' },
    date: { $lt: session.date },
    ...WITH_DELETED,
  }).select('_id');
  const sessionIds = sameTypeSessions.map((s) => s._id);
  const docs = [];
  for (const studentId of toAdd) {
    const previous = await ExamCandidate.countDocuments({
      studentId,
      sessionId: { $in: sessionIds },
      result: { $in: ['passed', 'failed', 'absent'] },
    });
    docs.push({ sessionId: session._id, studentId, result: 'pending' as const, score: null, attempt: previous + 1 });
  }
  if (docs.length) {
    await ExamCandidate.insertMany(docs);
    await recordAudit({
      actorId: actor.id,
      action: 'exam.candidates',
      entity: 'exam',
      entityId: id,
      after: { added: toAdd },
    });
  }
  return { added: toAdd.length, skipped };
}

export async function listCandidates(actor: Actor, scope: Scope, id: string) {
  const session = await getExamDoc(scope, id);
  const candidates = await ExamCandidate.find({ sessionId: session._id }).sort({ _id: 1 });
  const students = await Student.find({
    _id: { $in: candidates.map((candidate) => candidate.studentId) },
    ...WITH_DELETED,
  });
  const byId = new Map(students.map((student) => [student.id, student]));
  return candidates.map((candidate) => {
    const student = byId.get(candidate.studentId.toString());
    return {
      ...(candidate.toJSON() as Record<string, unknown>),
      student: student
        ? {
            id: student.id,
            code: student.code,
            name: student.name,
            // Instructors must not see contact details of students outside their own classes.
            ...(actor.role === 'instructor' ? {} : { phone: student.phone }),
          }
        : null,
    };
  });
}

async function getCandidate(sessionId: Types.ObjectId, candidateId: string) {
  const candidate = await ExamCandidate.findOne({ _id: candidateId, sessionId });
  if (!candidate) throw ApiError.notFound('Không tìm thấy thí sinh trong ca thi');
  return candidate;
}

export async function setCandidateResult(
  actor: Actor,
  scope: Scope,
  id: string,
  candidateId: string,
  input: CandidateResultInput,
) {
  const session = await getExamDoc(scope, id);
  if (session.status === 'cancelled') throw ApiError.conflict('Ca thi đã hủy, không nhập kết quả');
  const candidate = await getCandidate(session._id, candidateId);
  const before = snapshot(candidate);
  candidate.set({
    result: input.result,
    ...(input.score !== undefined ? { score: input.score } : {}),
    ...(input.note ? { note: input.note } : {}),
  });
  await candidate.save();
  if (session.type === 'official' && input.result === 'passed') {
    await Student.updateOne({ _id: candidate.studentId, status: { $in: ['studying', 'paused'] } }, { status: 'completed' });
  }
  await recordAudit({
    actorId: actor.id,
    action: 'exam.result',
    entity: 'exam_candidate',
    entityId: candidate.id,
    before,
    after: snapshot(candidate),
  });
  return candidate;
}

export async function removeCandidate(actor: Actor, scope: Scope, id: string, candidateId: string): Promise<void> {
  const session = await getExamDoc(scope, id);
  const candidate = await getCandidate(session._id, candidateId);
  if (candidate.result !== 'pending') throw ApiError.conflict('Thí sinh đã có kết quả, không thể xóa khỏi ca thi');
  await candidate.deleteOne();
  await recordAudit({
    actorId: actor.id,
    action: 'exam.candidate_delete',
    entity: 'exam',
    entityId: id,
    before: snapshot(candidate),
  });
}
