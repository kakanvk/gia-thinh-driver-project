import { shiftMonth, vnMonthKey, vnMonthRange } from '../../shared/time';
import { ExamCandidate } from '../exams/exam-candidate.model';
import { ExamSession } from '../exams/exam-session.model';
import { Payment } from '../tuition/payment.model';
import { scopeConditions } from './dashboard.service';
import type { MonthsQuery } from './dashboard.validation';

type Scope = Express.BranchScope | undefined;
const pct = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10);

function window(months: number) {
  const current = vnMonthKey(new Date());
  const first = shiftMonth(current, -(months - 1));
  return {
    first,
    keys: Array.from({ length: months }, (_, i) => shiftMonth(first, i)),
    start: vnMonthRange(first).start,
    end: vnMonthRange(current).end,
  };
}

export async function getRevenue(scope: Scope, query: MonthsQuery) {
  const { keys, start, end } = window(query.months);
  const match = { $and: [scopeConditions(scope, query.branchId), { voidedAt: null, paidAt: { $gte: start, $lt: end } }] };
  const [byMonth, byCourse] = await Promise.all([
    Payment.aggregate<{ _id: string; amount: number }>([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$paidAt', timezone: '+07:00' } },
          amount: { $sum: '$amount' },
        },
      },
    ]),
    Payment.aggregate<{ _id: string; amount: number }>([
      { $match: match },
      { $group: { _id: '$courseCode', amount: { $sum: '$amount' } } },
      { $sort: { amount: -1, _id: 1 } },
    ]),
  ]);
  const monthly = new Map(byMonth.map((row) => [row._id, row.amount]));
  const total = byCourse.reduce((sum, row) => sum + row.amount, 0);
  return {
    months: keys.map((month) => ({ month, amount: monthly.get(month) ?? 0 })),
    byCourse: byCourse.map((row) => ({ courseCode: row._id, amount: row.amount, share: pct(row.amount, total) })),
  };
}

export async function getPassRate(scope: Scope, query: MonthsQuery) {
  const { start, end } = window(query.months);
  const sessions = await ExamSession.find({
    $and: [
      scopeConditions(scope, query.branchId),
      { type: 'official', status: { $ne: 'cancelled' }, date: { $gte: start, $lt: end } },
    ],
  }).select('_id courseCode');
  const courseBySession = new Map(sessions.map((session) => [session.id, session.courseCode]));
  const candidates = await ExamCandidate.find({
    sessionId: { $in: sessions.map((session) => session._id) },
    attempt: 1,
    result: { $in: ['passed', 'failed'] },
  }).select('sessionId result');
  const stats = new Map<string, { passed: number; failed: number }>();
  for (const candidate of candidates) {
    const code = courseBySession.get(candidate.sessionId.toString())!;
    const entry = stats.get(code) ?? { passed: 0, failed: 0 };
    if (candidate.result === 'passed') entry.passed += 1;
    else entry.failed += 1;
    stats.set(code, entry);
  }
  return [...stats.entries()]
    .sort(([x], [y]) => x.localeCompare(y))
    .map(([courseCode, entry]) => ({ courseCode, ...entry, rate: pct(entry.passed, entry.passed + entry.failed) }));
}
