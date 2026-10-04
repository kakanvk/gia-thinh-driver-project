import type {
  ActivityType,
  AppointmentStatus,
  AppointmentType,
  LeadSource,
  LeadStatus,
} from "@/lib/admin/types"

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "consulted",
  "deposited",
  "docs_completed",
  "enrolled",
  "lost",
] as const satisfies readonly LeadStatus[]

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Mới",
  contacted: "Đã liên hệ",
  consulted: "Đã tư vấn",
  deposited: "Đặt cọc",
  docs_completed: "Hoàn tất hồ sơ",
  enrolled: "Nhập học",
  lost: "Không thành công",
}

export const LEAD_SOURCES = [
  "website",
  "facebook",
  "tiktok",
  "zalo",
  "referral",
  "walk_in",
  "other",
] as const satisfies readonly LeadSource[]

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  website: "Website",
  facebook: "Facebook",
  tiktok: "TikTok",
  zalo: "Zalo",
  referral: "Giới thiệu",
  walk_in: "Tại văn phòng",
  other: "Khác",
}

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  created: "Tạo mới",
  updated: "Cập nhật",
  status_change: "Đổi trạng thái",
  assign: "Phân công",
  form_resubmit: "Gửi lại form",
  appointment: "Lịch hẹn",
  call: "Cuộc gọi",
  note: "Ghi chú",
  sms: "SMS",
  meeting: "Gặp mặt",
}

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Đã lên lịch",
  done: "Hoàn thành",
  cancelled: "Đã hủy",
  no_show: "Khách không đến",
}

export const APPOINTMENT_TYPE_LABELS: Record<AppointmentType, string> = {
  consult: "Tư vấn",
  docs: "Làm hồ sơ",
  other: "Khác",
}
