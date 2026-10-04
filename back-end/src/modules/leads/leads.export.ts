import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { formatVn } from '../../shared/time';
import { Branch } from '../branches/branch.model';
import { User } from '../users/user.model';
import { Lead } from './lead.model';
import { STATUS_LABELS } from './lead.status';
import { buildLeadFilter } from './leads.service';
import type { LeadFilterQuery } from './leads.validation';

export const EXPORT_LIMIT = 5000;

const SOURCE_LABELS: Record<string, string> = {
  website: 'Website',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  zalo: 'Zalo',
  referral: 'Giới thiệu',
  walk_in: 'Tại văn phòng',
  other: 'Khác',
};

const HEADERS = [
  'Mã',
  'Họ tên',
  'SĐT',
  'Email',
  'Hạng',
  'Chi nhánh',
  'Nguồn',
  'Trạng thái',
  'Người phụ trách',
  'Hẹn liên hệ',
  'Ngày tạo',
  'Ghi chú',
];

export function toCsvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function exportLeadsCsv(scope: Express.BranchScope | undefined, query: LeadFilterQuery): Promise<string> {
  const leads = await Lead.find(buildLeadFilter(scope, query)).sort({ createdAt: -1, _id: -1 }).limit(EXPORT_LIMIT);
  const [branches, users] = await Promise.all([
    Branch.find({ _id: { $in: [...new Set(leads.map((lead) => lead.branchId.toString()))] } }),
    User.find({ _id: { $in: leads.flatMap((lead) => (lead.assigneeId ? [lead.assigneeId] : [])) } }),
  ]);
  const branchName = new Map(branches.map((branch) => [branch.id, branch.name]));
  const userName = new Map(users.map((user) => [user.id, user.name]));

  const rows = leads.map((lead) => [
    lead.code,
    lead.name,
    lead.phone,
    lead.email,
    lead.courseCode ?? 'Chưa xác định',
    branchName.get(lead.branchId.toString()),
    SOURCE_LABELS[lead.source] ?? lead.source,
    STATUS_LABELS[lead.status],
    lead.assigneeId ? userName.get(lead.assigneeId.toString()) : '',
    lead.nextFollowUpAt ? formatVn(lead.nextFollowUpAt, 'dd/MM/yyyy HH:mm') : '',
    formatVn(lead.createdAt, 'dd/MM/yyyy HH:mm'),
    lead.note,
  ]);

  return `\uFEFF${[HEADERS, ...rows].map((row) => row.map(toCsvCell).join(',')).join('\r\n')}\r\n`;
}

export async function exportCsv(req: Request, res: Response): Promise<void> {
  const csv = await exportLeadsCsv(req.scope, validated<LeadFilterQuery>(req, 'query'));
  const filename = `khach-hang-${formatVn(new Date(), 'yyyyMMdd')}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csv);
}
