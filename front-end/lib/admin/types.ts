// Kiểu dữ liệu admin theo đúng shape JSON của backend (toJSON: _id → id,
// ObjectId → chuỗi, Date → ISO kèm +07:00 qua jsonDateReplacer)

export type PageMeta = { page: number; limit: number; total: number }
export type Page<T> = { data: T[]; meta: PageMeta }

// back-end/src/modules/leads/lead.status.ts + lead.model.ts
export type LeadStatus =
  | "new"
  | "contacted"
  | "consulted"
  | "deposited"
  | "docs_completed"
  | "enrolled"
  | "lost"

export type LeadSource =
  "website" | "facebook" | "tiktok" | "zalo" | "referral" | "walk_in" | "other"

export type LeadUtm = Partial<
  Record<"source" | "medium" | "campaign" | "term" | "content", string>
>

export type Lead = {
  id: string
  code: string
  name: string
  phone: string
  email: string | null
  courseId: string | null
  courseCode: string | null
  branchId: string
  preferredContactTime: string | null
  note: string | null
  source: LeadSource
  utm: LeadUtm | null
  status: LeadStatus
  lostReason: string | null
  assigneeId: string | null
  nextFollowUpAt: string | null
  studentId: string | null
  lastActivityAt: string
  createdAt: string
  updatedAt: string
}

// back-end/src/modules/leads/lead-activity.model.ts (không có tên người thực hiện)
export type ActivityType =
  | "created"
  | "updated"
  | "status_change"
  | "assign"
  | "form_resubmit"
  | "appointment"
  | "call"
  | "note"
  | "sms"
  | "meeting"

export type LeadActivity = {
  id: string
  leadId: string
  type: ActivityType
  fromStatus: LeadStatus | null
  toStatus: LeadStatus | null
  content: string | null
  byUserId: string | null
  at: string
}

// back-end/src/modules/appointments/appointment.model.ts
export type AppointmentStatus = "scheduled" | "done" | "cancelled" | "no_show"
export type AppointmentType = "consult" | "docs" | "other"

export type Appointment = {
  id: string
  leadId: string | null
  branchId: string
  startAt: string
  endAt: string
  durationMinutes: number
  type: AppointmentType
  title: string | null
  assigneeId: string | null
  status: AppointmentStatus
  note: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

// getCalendar trong appointments.service.ts
export type CalendarItem = {
  id: string
  date: string
  time: string
  startAt: string
  endAt: string
  type: AppointmentType
  title: string | null
  status: AppointmentStatus
  branchId: string
  lead: { id: string; code: string; name: string; phone: string } | null
  assignee: { id: string; name: string } | null
}

export type CalendarMonth = { month: string; items: CalendarItem[] }

// back-end/src/modules/users/users.options.ts
export type StaffOption = {
  id: string
  name: string
  role: "consultant" | "branch_manager"
  branchIds: string[]
}

// Tập con của bản ghi /branches và /courses mà màn admin dùng
export type BranchOption = {
  id: string
  name: string
  slug: string
  officeName: string
}

export type CourseOption = { id: string; code: string; name: string }
