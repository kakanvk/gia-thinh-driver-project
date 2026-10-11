import { Types, type FilterQuery } from 'mongoose';
import { assertBranchAccess, branchFilter } from '../../middlewares/authorize.middleware';
import { addFixedDays, formatVn, shiftMonth, startOfVnDay, vnMonthKey, vnMonthRange, vnWeekRange } from '../../shared/time';
import { Appointment } from '../appointments/appointment.model';
import { LeadActivity } from '../leads/lead-activity.model';
import { Lead } from '../leads/lead.model';
import { PIPELINE, STATUS_LABELS, type LeadStatus } from '../leads/lead.status';
import { Student } from '../students/student.model';
import { TuitionAccount } from '../tuition/tuition-account.model';
import type { MonthQuery, RegistrationsQuery, ScopeQuery } from './dashboard.validation';

type Scope = Express.BranchScope | undefined;
const STAGES: LeadStatus[] = [...PIPELINE, 'enrolled'];
const STAGE_LABELS: Partial<Record<LeadStatus, string>> = { ...STATUS_LABELS, new: 'Tiếp nhận' };

export function scopeConditions(scope: Scope, branchId?: string): FilterQuery<unknown> {
  const conditions: FilterQuery<unknown>[] = [branchFilter(scope)];
  if (branchId) {
    assertBranchAccess(scope, branchId);
    conditions.push({ branchId: new Types.ObjectId(branchId) });
  }
  return { $and: conditions };
}

const range = (field: string, start: Date, end: Date) => ({ [field]: { $gte: start, $lt: end } });

export async function getSummary(scope: Scope, query: ScopeQuery) {
  const base = scopeConditions(scope, query.branchId);
  const now = new Date();
  const thisMonth = vnMonthRange(vnMonthKey(now));
  const lastMonth = vnMonthRange(shiftMonth(vnMonthKey(now), -1));
  const week = vnWeekRange(now);
  const today = startOfVnDay(now);
  const notCancelled = { status: { $ne: 'cancelled' } };
  const [leadsThis, leadsLast, studying, newStudents, apptWeek, apptToday, overdue, outstandingRows] = await Promise.all([
    Lead.countDocuments({ $and: [base, range('createdAt', thisMonth.start, thisMonth.end)] }),
    Lead.countDocuments({ $and: [base, range('createdAt', lastMonth.start, lastMonth.end)] }),
    Student.countDocuments({ $and: [base, { status: 'studying' }] }),
    Student.countDocuments({ $and: [base, range('enrolledAt', thisMonth.start, thisMonth.end)] }),
    Appointment.countDocuments({ $and: [base, notCancelled, range('startAt', week.start, week.end)] }),
    Appointment.countDocuments({ $and: [base, notCancelled, range('startAt', today, addFixedDays(today, 1))] }),
    TuitionAccount.countDocuments({ $and: [base, { status: 'overdue', archived: { $ne: true } }] }),
    TuitionAccount.aggregate<{ total: number }>([
      { $match: { $and: [base, { status: { $ne: 'paid' }, archived: { $ne: true } }] } },
      { $group: { _id: null, total: { $sum: { $subtract: ['$total', '$paidAmount'] } } } },
    ]),
  ]);
  return {
    leads: {
      thisMonth: leadsThis,
      lastMonth: leadsLast,
      changePct: leadsLast ? Math.round(((leadsThis - leadsLast) / leadsLast) * 1000) / 10 : null,
    },
    students: { studying, newThisMonth: newStudents },
    appointments: { thisWeek: apptWeek, today: apptToday },
    tuition: { overdueAccounts: overdue, outstanding: outstandingRows[0]?.total ?? 0 },
  };
}

export async function getRegistrations(scope: Scope, query: RegistrationsQuery) {
  const end = addFixedDays(startOfVnDay(), 1);
  const start = addFixedDays(end, -query.days);
  const rows = await Lead.aggregate<{ _id: string; count: number }>([
    { $match: { $and: [scopeConditions(scope, query.branchId), range('createdAt', start, end), { deletedAt: null }] } },
    {
      $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+07:00' } }, count: { $sum: 1 } },
    },
  ]);
  const counts = new Map(rows.map((row) => [row._id, row.count]));
  return Array.from({ length: query.days }, (_, i) => {
    const date = formatVn(addFixedDays(start, i), 'yyyy-MM-dd');
    return { date, count: counts.get(date) ?? 0 };
  });
}

export async function getSources(scope: Scope, query: MonthQuery) {
  const { start, end } = vnMonthRange(query.month ?? vnMonthKey(new Date()));
  const rows = await Lead.aggregate<{ _id: string; count: number }>([
    { $match: { $and: [scopeConditions(scope, query.branchId), range('createdAt', start, end), { deletedAt: null }] } },
    { $group: { _id: '$source', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ]);
  return rows.map((row) => ({ source: row._id, count: row.count }));
}

export async function getFunnel(scope: Scope, query: MonthQuery) {
  const { start, end } = vnMonthRange(query.month ?? vnMonthKey(new Date()));
  const leads = await Lead.find({ $and: [scopeConditions(scope, query.branchId), range('createdAt', start, end)] }).select(
    '_id status',
  );
  const activities = await LeadActivity.find({
    leadId: { $in: leads.map((lead) => lead._id) },
    type: 'status_change',
  }).select('leadId toStatus');
  const reached = new Map(leads.map((lead) => [lead.id, STAGES.indexOf(lead.status)]));
  for (const activity of activities) {
    const key = activity.leadId.toString();
    const index = activity.toStatus ? STAGES.indexOf(activity.toStatus) : -1;
    reached.set(key, Math.max(reached.get(key) ?? 0, index));
  }
  const levels = [...reached.values()].map((index) => Math.max(0, index));
  return STAGES.map((stage, i) => ({
    stage,
    label: STAGE_LABELS[stage]!,
    count: levels.filter((level) => level >= i).length,
  }));
}
