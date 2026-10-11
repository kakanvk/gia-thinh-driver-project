import type {
  ActivityType,
  AppointmentStatus,
  AppointmentType,
  CandidateResult,
  ClassStatus,
  ExamStatus,
  ExamType,
  InstructorStatus,
  LeadSource,
  LeadStatus,
  StudentStatus,
  Transmission,
  VehicleStatus,
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

// ---- Đào tạo ----

export const STUDENT_STATUSES = [
  "studying",
  "paused",
  "completed",
  "dropped",
] as const satisfies readonly StudentStatus[]

export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  studying: "Đang học",
  paused: "Tạm dừng",
  completed: "Hoàn thành",
  dropped: "Thôi học",
}

export const CLASS_STATUSES = [
  "enrolling",
  "upcoming",
  "ongoing",
  "finished",
] as const satisfies readonly ClassStatus[]

export const CLASS_STATUS_LABELS: Record<ClassStatus, string> = {
  enrolling: "Đang nhận hồ sơ",
  upcoming: "Sắp khai giảng",
  ongoing: "Đang học",
  finished: "Đã kết thúc",
}

export const EXAM_TYPES = [
  "graduation",
  "official",
] as const satisfies readonly ExamType[]

export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  graduation: "Tốt nghiệp",
  official: "Sát hạch",
}

export const EXAM_STATUSES = [
  "scheduled",
  "done",
  "cancelled",
] as const satisfies readonly ExamStatus[]

export const EXAM_STATUS_LABELS: Record<ExamStatus, string> = {
  scheduled: "Đã lên lịch",
  done: "Đã có kết quả",
  cancelled: "Đã hủy",
}

export const CANDIDATE_RESULTS = [
  "pending",
  "passed",
  "failed",
  "absent",
] as const satisfies readonly CandidateResult[]

export const CANDIDATE_RESULT_LABELS: Record<CandidateResult, string> = {
  pending: "Chờ kết quả",
  passed: "Đậu",
  failed: "Trượt",
  absent: "Vắng",
}

export const INSTRUCTOR_STATUSES = [
  "active",
  "on_leave",
  "inactive",
] as const satisfies readonly InstructorStatus[]

export const INSTRUCTOR_STATUS_LABELS: Record<InstructorStatus, string> = {
  active: "Đang hoạt động",
  on_leave: "Tạm nghỉ",
  inactive: "Nghỉ việc",
}

export const VEHICLE_STATUSES = [
  "active",
  "maintenance",
  "paused",
] as const satisfies readonly VehicleStatus[]

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  active: "Đang chạy",
  maintenance: "Bảo dưỡng",
  paused: "Tạm dừng",
}

export const TRANSMISSIONS = [
  "manual",
  "automatic",
] as const satisfies readonly Transmission[]

export const TRANSMISSION_LABELS: Record<Transmission, string> = {
  manual: "Số sàn",
  automatic: "Số tự động",
}
