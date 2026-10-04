export const LEAD_STATUSES = ['new', 'contacted', 'consulted', 'deposited', 'docs_completed', 'enrolled', 'lost'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const PIPELINE = ['new', 'contacted', 'consulted', 'deposited', 'docs_completed'] as const;
export const OPEN_STATUSES: LeadStatus[] = [...PIPELINE];

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Mới',
  contacted: 'Đã liên hệ',
  consulted: 'Đã tư vấn',
  deposited: 'Đặt cọc',
  docs_completed: 'Hoàn tất hồ sơ',
  enrolled: 'Nhập học',
  lost: 'Không thành công',
};

export function canTransition(from: LeadStatus, to: LeadStatus): boolean {
  if (from === to || from === 'enrolled' || to === 'enrolled') return false;
  if (to === 'lost') return true;
  if (from === 'lost') return to === 'contacted';
  return PIPELINE.indexOf(to) > PIPELINE.indexOf(from);
}
