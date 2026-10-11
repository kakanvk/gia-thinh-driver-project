import { Types, type FilterQuery } from 'mongoose';
import { logger } from '../../config/logger';
import { assertBranchAccess, branchFilter } from '../../middlewares/authorize.middleware';
import { paginate } from '../../shared/mongoose/paginate';
import { WITH_DELETED } from '../../shared/mongoose/softDelete';
import { addFixedDays, startOfVnDay } from '../../shared/time';
import { ApiError } from '../../utils/ApiError';
import { normalizePhone } from '../../utils/phone';
import { escapeRegex } from '../../utils/regex';
import { recordAudit, snapshot } from '../audit/audit.service';
import { resolveCoursePrice } from '../pricing/pricing.service';
import { Student, type StudentDoc } from '../students/student.model';
import { Payment } from './payment.model';
import { computeTotal, computeTuitionStatus, installmentsError, nextDue } from './tuition.calc';
import { DEFAULT_DUE_DAYS, TuitionAccount, type ITuitionAccount, type TuitionAccountDoc } from './tuition-account.model';
import type { ListAccountsQuery, UpdateAccountInput } from './tuition.validation';

type Actor = Express.AuthUser;
type Scope = Express.BranchScope | undefined;

export function applyStatus(account: TuitionAccountDoc, now: Date = new Date()): void {
  account.status = computeTuitionStatus(
    { total: account.total, paid: account.paidAmount, installments: account.installments },
    startOfVnDay(now),
  );
}

const isDuplicateKey = (error: unknown) => (error as { code?: number } | null)?.code === 11000;

export async function createAccountForStudent(
  student: StudentDoc,
  actorId?: string,
): Promise<{ account: TuitionAccountDoc; created: boolean }> {
  const existing = await TuitionAccount.findOne({ studentId: student._id });
  if (existing) return { account: existing, created: false };
  const { price, priceNote } = await resolveCoursePrice(student.branchId.toString(), student.courseId.toString());
  const account = new TuitionAccount({
    studentId: student._id,
    courseId: student.courseId,
    courseCode: student.courseCode,
    branchId: student.branchId,
    listPrice: price,
    priceNote,
    discounts: [],
    total: price,
    plan: 'one_time',
    installments:
      price > 0 ? [{ dueDate: addFixedDays(startOfVnDay(student.enrolledAt), DEFAULT_DUE_DAYS), amount: price }] : [],
    paidAmount: 0,
  });
  applyStatus(account);
  try {
    await account.save();
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    const raced = await TuitionAccount.findOne({ studentId: student._id });
    if (!raced) throw error;
    return { account: raced, created: false };
  }
  if (actorId) {
    try {
      await recordAudit({
        actorId,
        action: 'tuition.create',
        entity: 'tuition',
        entityId: account.id,
        after: snapshot(account),
      });
    } catch (error) {
      logger.error({ err: error, studentId: student.id }, 'Không ghi được audit tạo sổ học phí');
    }
  }
  return { account, created: true };
}

/** Đổi ngày nhập học: hạn của sổ một lần (chưa lưu trữ) = ngày nhập học + DEFAULT_DUE_DAYS. */
export async function rescheduleOneTimeDue(studentId: Types.ObjectId, enrolledAt: Date): Promise<void> {
  const account = await TuitionAccount.findOne({ studentId, archived: { $ne: true }, plan: 'one_time' });
  if (!account || account.installments.length !== 1) return;
  const dueDate = addFixedDays(startOfVnDay(enrolledAt), DEFAULT_DUE_DAYS);
  const installments = [{ dueDate, amount: account.installments[0]!.amount }];
  account.set({ installments });
  applyStatus(account);
  await TuitionAccount.updateOne(
    { _id: account._id, paidAmount: account.paidAmount, total: account.total },
    { installments, status: account.status },
  );
}

export async function getAccountDoc(scope: Scope, id: string): Promise<TuitionAccountDoc> {
  const account = await TuitionAccount.findOne({ $and: [{ _id: id }, branchFilter(scope)] });
  if (!account) throw ApiError.notFound('Không tìm thấy sổ học phí');
  return account;
}

async function studentSummaries(studentIds: Types.ObjectId[]) {
  const students = await Student.find({ _id: { $in: studentIds }, ...WITH_DELETED });
  return new Map(
    students.map((student) => [
      student.id,
      {
        id: student.id,
        code: student.code,
        name: student.name,
        phone: student.phone,
        status: student.status,
        deleted: Boolean(student.deletedAt),
      },
    ]),
  );
}

function present(account: TuitionAccountDoc, student: unknown) {
  return {
    ...(account.toJSON() as Record<string, unknown>),
    student: student ?? null,
    remaining: Math.max(0, account.total - account.paidAmount),
    nextDue: nextDue(account.installments, account.paidAmount),
  };
}

export async function getAccount(scope: Scope, id: string) {
  const account = await getAccountDoc(scope, id);
  const [students, payments] = await Promise.all([
    studentSummaries([account.studentId]),
    Payment.find({ tuitionAccountId: account._id }).sort({ paidAt: -1, _id: -1 }),
  ]);
  return { ...present(account, students.get(account.studentId.toString())), payments };
}

export async function listAccounts(scope: Scope, query: ListAccountsQuery) {
  const conditions: FilterQuery<ITuitionAccount>[] = [branchFilter(scope)];
  if (query.branchId) {
    assertBranchAccess(scope, query.branchId);
    conditions.push({ branchId: new Types.ObjectId(query.branchId) });
  }
  if (!query.includeArchived) conditions.push({ archived: { $ne: true } });
  if (query.status) conditions.push({ status: query.status });
  if (query.courseId) conditions.push({ courseId: new Types.ObjectId(query.courseId) });
  if (query.q) {
    const text = new RegExp(escapeRegex(query.q), 'i');
    const digits = normalizePhone(query.q).replace(/\D/g, '');
    const matches = await Student.find({
      $or: [{ name: text }, { code: text }, ...(digits.length >= 3 ? [{ phone: new RegExp(digits) }] : [])],
      ...WITH_DELETED,
    }).select('_id');
    conditions.push({ studentId: { $in: matches.map((student) => student._id) } });
  }
  const result = await paginate(TuitionAccount, { $and: conditions }, query, '-updatedAt');
  const students = await studentSummaries(result.data.map((account) => account.studentId));
  return {
    data: result.data.map((account) => present(account, students.get(account.studentId.toString()))),
    meta: result.meta,
  };
}

export async function backfillAccount(actor: Actor, scope: Scope, studentId: string) {
  const student = await Student.findOne({ $and: [{ _id: studentId }, branchFilter(scope)] });
  if (!student) throw ApiError.notFound('Không tìm thấy học viên');
  const exists = () => ApiError.conflict('Học viên đã có sổ học phí');
  let result;
  try {
    result = await createAccountForStudent(student, actor.id);
  } catch (error) {
    if (isDuplicateKey(error)) throw exists();
    throw error;
  }
  if (!result.created) throw exists();
  const { account } = result;
  return getAccount(scope, account.id);
}

export async function updateAccount(actor: Actor, scope: Scope, id: string, input: UpdateAccountInput) {
  const account = await getAccountDoc(scope, id);
  const before = snapshot(account);
  const discounts = input.discounts ?? account.discounts;
  const total = computeTotal(account.listPrice, discounts);
  if (total < account.paidAmount) throw ApiError.conflict('Tổng học phí mới nhỏ hơn số đã thu');
  const plan = input.plan ?? account.plan;
  let installments =
    input.installments ?? account.installments.map((item) => ({ dueDate: item.dueDate, amount: item.amount }));
  if (plan === 'one_time') {
    const dueDate = installments[0]?.dueDate ?? addFixedDays(startOfVnDay(), DEFAULT_DUE_DAYS);
    installments = total > 0 ? [{ dueDate, amount: total }] : [];
  } else {
    const error = installmentsError(installments, total);
    if (error) throw ApiError.badRequest(error, [{ path: 'body.installments', message: error }]);
  }
  account.set({ discounts, total, plan, installments, ...(input.note !== undefined ? { note: input.note } : {}) });
  applyStatus(account);
  const updated = await TuitionAccount.findOneAndUpdate(
    { _id: account._id, paidAmount: account.paidAmount },
    {
      $set: {
        discounts,
        total,
        plan,
        installments,
        status: account.status,
        ...(input.note !== undefined ? { note: input.note } : {}),
      },
    },
    { returnDocument: 'after' },
  );
  if (!updated) throw ApiError.conflict('Sổ học phí vừa thay đổi, vui lòng tải lại');
  await recordAudit({
    actorId: actor.id,
    action: 'tuition.update',
    entity: 'tuition',
    entityId: id,
    before,
    after: snapshot(updated),
  });
  return getAccount(scope, id);
}
