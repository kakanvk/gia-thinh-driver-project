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
// role=instructor trả tài khoản giáo viên (màn giáo viên)
export type StaffOption = {
  id: string
  name: string
  role: "consultant" | "branch_manager" | "instructor"
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

// back-end/src/modules/media/media.model.ts (toJSON thêm refsCount)
export type MediaKind = "image" | "video"

export type MediaItem = {
  id: string
  kind: MediaKind
  url: string
  mimeType: string
  size: number
  width?: number
  height?: number
  // Thời lượng video (giây)
  duration?: number
  alt?: string
  refsCount: number
  createdAt: string
}

// back-end/src/modules/gallery/gallery.service.ts (present)
export type GalleryItem = {
  id: string
  mediaId: string
  posterMediaId: string | null
  caption: string | null
  order: number
  visible: boolean
  // null khi media gốc không còn
  media: {
    id: string
    url: string
    kind: MediaKind
    alt: string | null
    width: number | null
    height: number | null
    duration: number | null
  } | null
  poster: { url: string; alt: string | null } | null
  createdAt: string
  updatedAt: string
}

// ---- Đào tạo ----

// back-end/src/modules/classes/class.model.ts, vehicles/vehicle.model.ts
export type Transmission = "manual" | "automatic"

// back-end/src/modules/students/student.model.ts — presentStudent ẩn
// idNumber/address/dob với tài khoản giáo viên (trường vắng mặt hẳn)
export type StudentStatus = "studying" | "paused" | "completed" | "dropped"

export type Student = {
  id: string
  code: string
  name: string
  phone: string
  email: string | null
  dob?: string | null
  idNumber?: string | null
  address?: string | null
  courseId: string
  courseCode: string
  branchId: string
  classId: string | null
  leadId: string | null
  status: StudentStatus
  enrolledAt: string
  note: string | null
  createdAt: string
  updatedAt: string
}

// back-end/src/modules/classes/classes.service.ts (present)
export type ClassStatus = "enrolling" | "upcoming" | "ongoing" | "finished"

export type TrainingClass = {
  id: string
  code: string
  courseId: string
  courseCode: string
  transmission: Transmission | null
  branchId: string
  instructorId: string | null
  startDate: string
  endDate: string
  scheduleText: string
  capacity: number
  status: ClassStatus
  note: string | null
  filled: number
  seatsLeft: number
  course: { id: string; code: string; name: string } | null
  instructor: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
}

// back-end/src/modules/exams/exam-session.model.ts + exams.service.ts (stats)
export type ExamType = "graduation" | "official"
export type ExamStatus = "scheduled" | "done" | "cancelled"
export type CandidateResult = "pending" | "passed" | "failed" | "absent"

export type ExamStats = Record<"candidates" | CandidateResult, number>

export type ExamSession = {
  id: string
  code: string
  type: ExamType
  courseId: string
  courseCode: string
  branchId: string
  date: string
  location: string | null
  status: ExamStatus
  note: string | null
  stats: ExamStats
  createdAt: string
  updatedAt: string
}

// exams.service.ts listCandidates — phone vắng mặt với tài khoản giáo viên
export type ExamCandidate = {
  id: string
  sessionId: string
  studentId: string
  result: CandidateResult
  score: number | null
  attempt: number
  note: string | null
  student: { id: string; code: string; name: string; phone?: string } | null
  createdAt: string
  updatedAt: string
}

// exams.service.ts addCandidates: skipped = studentId đã có trong ca
export type AddCandidatesResult = { added: number; skipped: string[] }

// students.service.ts listStudentExams
export type StudentExam = {
  candidateId: string
  sessionId: string
  sessionCode: string
  type: ExamType
  date: string
  location: string | null
  courseCode: string
  result: CandidateResult
  score: number | null
  attempt: number
  note: string | null
}

// back-end/src/modules/instructors/instructor.model.ts
export type InstructorStatus = "active" | "on_leave" | "inactive"

export type Instructor = {
  id: string
  name: string
  phone: string
  userId: string | null
  specialties: string[]
  branchId: string
  status: InstructorStatus
  note: string | null
  createdAt: string
  updatedAt: string
}

// instructors.service.ts getInstructorStats (passRate đã tính sẵn, null khi mẫu 0)
export type InstructorStats = {
  classes: { total: number; active: number }
  students: number
  official: {
    passed: number
    failed: number
    absent: number
    passRate: number | null
  }
}

// back-end/src/modules/vehicles/vehicle.model.ts
export type VehicleStatus = "active" | "maintenance" | "paused"

export type Vehicle = {
  id: string
  plate: string
  model: string
  courseCode: string
  transmission: Transmission | null
  branchId: string
  odometer: number
  datKm: number
  lastServiceAt: string | null
  nextServiceAt: string | null
  registrationExpiresAt: string | null
  status: VehicleStatus
  note: string | null
  createdAt: string
  updatedAt: string
}

// vehicles.service.ts listVehicleAlerts
export type VehicleAlertReason = {
  type: "service" | "registration"
  dueAt: string
  daysLeft: number
  overdue: boolean
}

export type VehicleAlert = { vehicle: Vehicle; reasons: VehicleAlertReason[] }
