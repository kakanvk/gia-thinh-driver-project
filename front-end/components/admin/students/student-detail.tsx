"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, ChevronDown, Pencil, School, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { SectionHeading, StatusPill } from "@/components/admin/admin-ui"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { StudentClassSheet } from "@/components/admin/students/student-class-sheet"
import { StudentExams } from "@/components/admin/students/student-exams"
import { StudentFormSheet } from "@/components/admin/students/student-form-sheet"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatDate, formatDateTime } from "@/lib/admin/datetime"
import {
  CLASS_STATUS_LABELS,
  STUDENT_STATUS_LABELS,
  STUDENT_STATUSES,
} from "@/lib/admin/labels"
import { nameById, useBranches } from "@/lib/admin/lookups"
import { classTitle } from "@/lib/admin/training"
import type { Student, StudentStatus, TrainingClass } from "@/lib/admin/types"
import { useCan } from "@/lib/admin/use-can"
import { apiData, apiFetch } from "@/lib/api/client"
import { ApiError } from "@/lib/api/errors"

function InfoRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
      <dt className="w-36 shrink-0 text-xs font-medium text-muted-foreground sm:pt-0.5">
        {label}
      </dt>
      <dd className="min-w-0 text-sm break-words">{children}</dd>
    </div>
  )
}

const empty = <span className="text-muted-foreground">—</span>

function StudentStatusMenu({ student }: { student: Student }) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (status: StudentStatus) =>
      apiData<Student>(`/students/${student.id}`, {
        method: "PATCH",
        body: { status },
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(["student", saved.id], saved)
      void queryClient.invalidateQueries({ queryKey: ["students"] })
      // Thôi học / học lại làm đổi sĩ số lớp
      void queryClient.invalidateQueries({ queryKey: ["classes"] })
      void queryClient.invalidateQueries({ queryKey: ["class"] })
      void queryClient.invalidateQueries({ queryKey: ["class-students"] })
      toast.success(`Đã chuyển sang ${STUDENT_STATUS_LABELS[saved.status]}`)
    },
  })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
          />
        }
      >
        Đổi trạng thái
        <ChevronDown aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-44">
        {STUDENT_STATUSES.map((status) => (
          <DropdownMenuItem
            key={status}
            disabled={status === student.status}
            variant={status === "dropped" ? "destructive" : "default"}
            onClick={() => mutation.mutate(status)}
          >
            {STUDENT_STATUS_LABELS[status]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function CurrentClass({
  student,
  canReadClasses,
}: {
  student: Student
  canReadClasses: boolean
}) {
  const classId = student.classId
  const cls = useQuery({
    queryKey: ["class", classId],
    queryFn: ({ signal }) =>
      apiData<TrainingClass>(`/classes/${classId}`, { signal }),
    enabled: Boolean(classId) && canReadClasses,
  })

  if (!classId) {
    return <p className="text-sm text-muted-foreground">Chưa xếp lớp</p>
  }
  // Tư vấn viên không có class.read: không tra được thông tin lớp
  if (!canReadClasses) return <p className="text-sm">Đã xếp lớp</p>
  if (cls.isPending) {
    return <div className="h-12 animate-pulse rounded-lg bg-muted" />
  }
  if (cls.error) {
    return (
      <p className="text-sm text-muted-foreground">
        Không tải được thông tin lớp.
      </p>
    )
  }

  const data = cls.data
  return (
    <dl className="divide-y divide-border/60">
      <InfoRow label="Lớp">
        <Link
          href={`/admin/lop-hoc/${data.id}`}
          className="font-medium text-primary hover:underline"
        >
          {data.code}
        </Link>
        <span className="ml-2 inline-block align-middle">
          <StatusPill status={CLASS_STATUS_LABELS[data.status]} />
        </span>
      </InfoRow>
      <InfoRow label="Gói">{classTitle(data)}</InfoRow>
      <InfoRow label="Thời gian">
        {formatDate(data.startDate)} – {formatDate(data.endDate)}
      </InfoRow>
      <InfoRow label="Lịch học">{data.scheduleText}</InfoRow>
      <InfoRow label="Giáo viên">{data.instructor?.name ?? empty}</InfoRow>
    </dl>
  )
}

export function StudentDetail({ id }: { id: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const canUpdate = useCan("student.update")
  const canDelete = useCan("student.delete")
  const canReadLeads = useCan("lead.read")
  const canReadClasses = useCan("class.read")
  const canReadExams = useCan("exam.read")
  const branches = useBranches()
  const [editOpen, setEditOpen] = useState(false)
  const [classOpen, setClassOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const studentQuery = useQuery({
    queryKey: ["student", id],
    queryFn: ({ signal }) => apiData<Student>(`/students/${id}`, { signal }),
  })

  const remove = useMutation({
    mutationFn: () => apiFetch<void>(`/students/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["students"] })
      // Backend đưa khách hàng gốc về Hoàn tất hồ sơ
      void queryClient.invalidateQueries({ queryKey: ["leads"] })
      void queryClient.invalidateQueries({ queryKey: ["lead"] })
      // Sĩ số lớp và thí sinh chờ của học viên đổi
      void queryClient.invalidateQueries({ queryKey: ["classes"] })
      void queryClient.invalidateQueries({ queryKey: ["class"] })
      void queryClient.invalidateQueries({ queryKey: ["class-students"] })
      void queryClient.invalidateQueries({ queryKey: ["exams"] })
      void queryClient.invalidateQueries({ queryKey: ["exam"] })
      void queryClient.invalidateQueries({ queryKey: ["exam-candidates"] })
      // Không kéo lại GET /students/:id (404) khi trang còn quan sát query
      void queryClient.cancelQueries({ queryKey: ["student", id] })
      void queryClient.cancelQueries({ queryKey: ["student-exams", id] })
      toast.success("Đã xoá học viên")
      setDeleteOpen(false)
      router.push("/admin/hoc-vien")
    },
  })

  const backLink = (
    <Link
      href="/admin/hoc-vien"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Về danh sách học viên
    </Link>
  )

  if (studentQuery.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        {backLink}
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  if (studentQuery.error) {
    const notFound =
      studentQuery.error instanceof ApiError &&
      studentQuery.error.status === 404
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-border/80 bg-card p-6">
        <p className="font-semibold text-navy">
          {notFound ? "Không tìm thấy học viên" : "Không tải được dữ liệu."}
        </p>
        {notFound ? (
          <p className="text-sm text-muted-foreground">
            Học viên có thể đã bị xoá hoặc không thuộc phạm vi của bạn.
          </p>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => void studentQuery.refetch()}
          >
            Thử lại
          </Button>
        )}
        {backLink}
      </div>
    )
  }

  const student = studentQuery.data
  // Xếp lớp cần tra danh sách lớp (class.read)
  const canAssignClass = canUpdate && canReadClasses

  return (
    <div className="flex flex-col gap-4">
      {backLink}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-navy sm:text-xl">
              {student.name}
            </h1>
            <StatusPill status={STUDENT_STATUS_LABELS[student.status]} />
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{student.code}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canUpdate ? <StudentStatusMenu student={student} /> : null}
          {canUpdate ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditOpen(true)}
            >
              <Pencil aria-hidden="true" />
              Sửa
            </Button>
          ) : null}
          {canAssignClass ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setClassOpen(true)}
            >
              <School aria-hidden="true" />
              {student.classId ? "Đổi lớp" : "Xếp lớp"}
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 aria-hidden="true" />
              Xoá
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className="min-w-0 rounded-xl border border-border/80 bg-card p-4">
          <SectionHeading title="Hồ sơ học viên" />
          <dl className="mt-2 divide-y divide-border/60">
            <InfoRow label="Số điện thoại">
              <a
                href={`tel:${student.phone}`}
                className="font-medium text-primary hover:underline"
              >
                {student.phone}
              </a>
            </InfoRow>
            <InfoRow label="Email">{student.email ?? empty}</InfoRow>
            {/* Tài khoản giáo viên: API không trả các trường này → ẩn hẳn */}
            {student.dob !== undefined ? (
              <InfoRow label="Ngày sinh">
                {student.dob ? formatDate(student.dob) : empty}
              </InfoRow>
            ) : null}
            {student.idNumber !== undefined ? (
              <InfoRow label="CCCD">{student.idNumber ?? empty}</InfoRow>
            ) : null}
            {student.address !== undefined ? (
              <InfoRow label="Địa chỉ">{student.address ?? empty}</InfoRow>
            ) : null}
            <InfoRow label="Gói học">{student.courseCode}</InfoRow>
            <InfoRow label="Chi nhánh">
              {nameById(branches.data, student.branchId, "—")}
            </InfoRow>
            <InfoRow label="Nhập học">{formatDate(student.enrolledAt)}</InfoRow>
            <InfoRow label="Ghi chú">
              {student.note ? (
                <span className="whitespace-pre-line">{student.note}</span>
              ) : (
                empty
              )}
            </InfoRow>
            {student.leadId && canReadLeads ? (
              <InfoRow label="Nguồn">
                <Link
                  href={`/admin/khach-hang/${student.leadId}`}
                  className="font-medium text-primary hover:underline"
                >
                  Khách hàng gốc
                </Link>
              </InfoRow>
            ) : null}
            <InfoRow label="Ngày tạo">
              {formatDateTime(student.createdAt)}
            </InfoRow>
          </dl>
        </section>

        <div className="flex min-w-0 flex-col gap-4">
          <section className="rounded-xl border border-border/80 bg-card p-4">
            <SectionHeading title="Lớp hiện tại" />
            <div className="mt-2">
              <CurrentClass student={student} canReadClasses={canReadClasses} />
            </div>
          </section>
          {canReadExams ? <StudentExams studentId={student.id} /> : null}
        </div>
      </div>

      {canUpdate ? (
        <StudentFormSheet
          open={editOpen}
          onOpenChange={setEditOpen}
          student={student}
        />
      ) : null}
      {canAssignClass ? (
        <StudentClassSheet
          open={classOpen}
          onOpenChange={setClassOpen}
          student={student}
        />
      ) : null}
      {canDelete ? (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={`Xoá học viên ${student.name}?`}
          description={
            student.leadId
              ? "Khách hàng gốc sẽ trở về trạng thái Hoàn tất hồ sơ. Không thể hoàn tác."
              : "Không thể hoàn tác."
          }
          confirmLabel="Xoá học viên"
          destructive
          pending={remove.isPending}
          onConfirm={() => remove.mutate()}
        />
      ) : null}
    </div>
  )
}
