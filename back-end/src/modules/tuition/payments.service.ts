import { logger } from '../../config/logger';
import { nextDailyCode } from '../../shared/codes';
import { ApiError } from '../../utils/ApiError';
import { recordAudit, snapshot } from '../audit/audit.service';
import { Payment } from './payment.model';
import { TuitionAccount } from './tuition-account.model';
import type { TuitionAccountDoc } from './tuition-account.model';
import { applyStatus, getAccount, getAccountDoc } from './tuition.service';
import type { AddPaymentInput } from './tuition.validation';

type Actor = Express.AuthUser;
type Scope = Express.BranchScope | undefined;

/**
 * Ghi trạng thái tính từ `doc` chỉ khi paidAmount/total chưa đổi kể từ lúc đọc; nếu có ghi khác chen vào
 * thì đọc lại và tính lại để trạng thái cũ không đè trạng thái mới.
 */
export async function syncStatus(doc: TuitionAccountDoc, now: Date): Promise<void> {
  let current: TuitionAccountDoc | null = doc;
  for (let attempt = 0; current && attempt < 5; attempt++) {
    applyStatus(current, now);
    const result = await TuitionAccount.updateOne(
      { _id: current._id, paidAmount: current.paidAmount, total: current.total },
      { status: current.status },
    );
    if (result.matchedCount > 0) return;
    current = await TuitionAccount.findById(current._id);
  }
}

export async function addPayment(actor: Actor, scope: Scope, accountId: string, input: AddPaymentInput) {
  const account = await getAccountDoc(scope, accountId);
  const now = new Date();
  const reserved = await TuitionAccount.findOneAndUpdate(
    { _id: account._id, $expr: { $lte: [{ $add: ['$paidAmount', input.amount] }, '$total'] } },
    { $inc: { paidAmount: input.amount }, lastPaymentAt: now },
    { returnDocument: 'after' },
  );
  if (!reserved) {
    throw ApiError.conflict(`Số tiền vượt quá số còn phải đóng (${Math.max(0, account.total - account.paidAmount)}đ)`);
  }

  let payment;
  try {
    payment = await Payment.create({
      tuitionAccountId: account._id,
      studentId: account.studentId,
      branchId: account.branchId,
      courseCode: account.courseCode,
      amount: input.amount,
      method: input.method,
      paidAt: input.paidAt ?? now,
      receivedBy: actor.id,
      receiptNo: await nextDailyCode('PT', now),
      note: input.note ?? null,
    });
  } catch (error) {
    await TuitionAccount.updateOne({ _id: account._id }, { $inc: { paidAmount: -input.amount } }).catch(
      (rollbackError: unknown) =>
        logger.error({ err: rollbackError, accountId }, 'Không hoàn lại được số đã thu khi tạo phiếu thất bại'),
    );
    throw error;
  }

  await syncStatus(reserved, now);
  await recordAudit({
    actorId: actor.id,
    action: 'tuition.payment',
    entity: 'payment',
    entityId: payment.id,
    after: snapshot(payment),
  });
  return { payment, account: await getAccount(scope, accountId) };
}

export async function voidPayment(actor: Actor, scope: Scope, accountId: string, paymentId: string, reason: string) {
  const account = await getAccountDoc(scope, accountId);
  const now = new Date();
  const existing = await Payment.findOne({ _id: paymentId, tuitionAccountId: account._id });
  if (!existing) throw ApiError.notFound('Không tìm thấy phiếu thu');
  if (existing.voidedAt) throw ApiError.conflict('Phiếu thu đã được hủy trước đó');
  // Đánh dấu hủy trước (chỉ một request thắng), rồi mới trừ sổ; không có khoảng trừ-rồi-hoàn.
  const payment = await Payment.findOneAndUpdate(
    { _id: existing._id, tuitionAccountId: account._id, voidedAt: null },
    { voidedAt: now, voidedBy: actor.id, voidReason: reason },
    { returnDocument: 'after' },
  );
  if (!payment) throw ApiError.conflict('Phiếu thu đã được hủy trước đó');
  const decremented = await TuitionAccount.findOneAndUpdate(
    { _id: account._id, paidAmount: { $gte: payment.amount } },
    { $inc: { paidAmount: -payment.amount } },
    { returnDocument: 'after' },
  );
  if (!decremented) {
    await Payment.updateOne({ _id: payment._id }, { voidedAt: null, voidedBy: null, voidReason: null });
    throw ApiError.conflict('Số đã thu không đủ để hủy phiếu này, vui lòng tải lại');
  }
  await syncStatus(decremented, now);
  await recordAudit({
    actorId: actor.id,
    action: 'tuition.payment_void',
    entity: 'payment',
    entityId: payment.id,
    after: snapshot(payment),
  });
  return { payment, account: await getAccount(scope, accountId) };
}
