import type { Types } from 'mongoose';
import { startOfVnDay } from '../../shared/time';
import { Payment } from './payment.model';
import { computeTuitionStatus } from './tuition.calc';
import { TuitionAccount, type ITuitionAccount } from './tuition-account.model';

export async function refreshTuitionStatuses(now: Date = new Date()): Promise<{ checked: number; changed: number }> {
  const today = startOfVnDay(now);
  const accounts = await TuitionAccount.find({
    archived: { $ne: true },
    $or: [{ status: { $ne: 'paid' } }, { $expr: { $lt: ['$paidAmount', '$total'] } }],
  })
    .select('total paidAmount installments status')
    .lean();
  const updates = accounts.flatMap((account) => {
    const status = computeTuitionStatus(
      { total: account.total, paid: account.paidAmount, installments: account.installments },
      today,
    );
    return status === account.status
      ? []
      : [
          {
            updateOne: {
              filter: { _id: account._id, status: account.status, paidAmount: account.paidAmount, total: account.total },
              update: { status },
            },
          },
        ];
  });
  if (updates.length) await TuitionAccount.bulkWrite(updates);
  return { checked: accounts.length, changed: updates.length };
}

export const RECONCILE_GRACE_MS = 10 * 60 * 1000;

/**
 * Sửa paidAmount lệch so với tổng phiếu chưa hủy (chỉ sổ chưa lưu trữ); trả số sổ đã sửa.
 * Bỏ qua sổ/phiếu vừa thay đổi trong RECONCILE_GRACE_MS để không đụng thu/hủy phiếu đang dở (lần chạy sau xử lý).
 */
export async function reconcilePaidAmounts(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - RECONCILE_GRACE_MS);
  const accounts = await TuitionAccount.find({ archived: { $ne: true }, updatedAt: { $lt: cutoff } })
    .select('total paidAmount installments updatedAt')
    .lean<
      Array<Pick<ITuitionAccount, 'total' | 'paidAmount' | 'installments'> & { _id: Types.ObjectId; updatedAt: Date }>
    >();
  if (accounts.length === 0) return 0;
  const ids = accounts.map((account) => account._id);
  // Một aggregate duy nhất (gồm cả phiếu đã hủy) để tổng và mốc chạm lấy cùng một thời điểm đọc.
  const rows = await Payment.aggregate<{ _id: unknown; sum: number; lastTouched: Date }>([
    { $match: { tuitionAccountId: { $in: ids } } },
    {
      $group: {
        _id: '$tuitionAccountId',
        sum: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$voidedAt', null] }, null] }, '$amount', 0] } },
        lastTouched: { $max: { $max: ['$createdAt', '$updatedAt'] } },
      },
    },
  ]);
  const byId = new Map(rows.map((row) => [String(row._id), row]));
  const today = startOfVnDay(now);
  let fixed = 0;
  for (const account of accounts) {
    const row = byId.get(String(account._id));
    if (row && row.lastTouched >= cutoff) continue;
    const sum = row?.sum ?? 0;
    if (account.paidAmount === sum) continue;
    const status = computeTuitionStatus({ total: account.total, paid: sum, installments: account.installments }, today);
    const result = await TuitionAccount.updateOne(
      { _id: account._id, paidAmount: account.paidAmount, total: account.total, updatedAt: account.updatedAt },
      { paidAmount: sum, status },
    );
    if (result.modifiedCount > 0) fixed += 1;
  }
  return fixed;
}
