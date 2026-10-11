"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Pencil, Trash2, UserPlus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { SectionHeading, StatusPill } from "@/components/admin/admin-ui"
import { ClassAssignSheet } from "@/components/admin/classes/class-assign-sheet"
import { ClassFormSheet } from "@/components/admin/classes/class-form-sheet"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { Button } from "@/components/ui/button"
import { formatDate, formatDateTime } from "@/lib/admin/datetime"
import { CLASS_STATUS_LABELS, STUDENT_STATUS_LABELS } from "@/lib/admin/labels"
import { nameById, useBranches } from "@/lib/admin/lookups"
import { classTitle } from "@/lib/admin/training"
import type { Student, TrainingClass } from "@/lib/admin/types"
import { useCan } from "@/lib/admin/use-can"
import { apiData, apiFetch } from "@/lib/api/client"
import { ApiError, errorMessage } from "@/lib/api/errors"

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

function invalidateTraining(queryClient: ReturnType<typeof useQueryClient>) {
  for (const key of [
    "class-students",
    "class",
    "classes",
    "students",
    "student",
  ])
    void queryClient.invalidateQueries({ queryKey: [key] })
}

function ClassStudents({
  cls,
  canUpdateStudents,
}: {
  cls: TrainingClass
  canUpdateStudents: boolean
}) {
  const queryClient = useQueryClient()
  const [removing, setRemoving] = useState<Student | null>(null)

  const students = useQuery({
    queryKey: ["class-students", cls.id],
    queryFn: ({ signal }) =>
      apiData<Student[]>(`/classes/${cls.id}/students`, { signal }),
  })

  const remove = useMutation({
    mutationFn: (student: Student) =>
      apiData<Student>(`/students/${student.id}/class`, {
        method: "PATCH",
        body: { classId: null },
      }),
    onSuccess: (_saved, student) => {
      invalidateTraining(queryClient)
      toast.success(`Đã bỏ ${student.name} khỏi lớp`)
      setRemoving(null)
    },
  })

  return (
    <section className="min-w-0 rounded-xl border border-border/80 bg-card p-4">
      <SectionHeading title="Học viên của lớp" />
      {students.isPending ? (
        <div className="mt-3 h-24 animate-pulse rounded-lg bg-muted" />
      ) : students.error ? (
        <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
          Không tải được danh sách học viên.
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void students.refetch()}
          >
            Thử lại
          </Button>
        </div>
      ) : students.data.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Lớp chưa có học viên.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Mã</th>
                <th className="py-2 pr-3 font-medium">Học viên</th>
                <th className="py-2 pr-3 font-medium">SĐT</th>
                <th className="py-2 pr-3 font-medium">Trạng thái</th>
                {canUpdateStudents ? (
                  <th className="py-2 font-medium">
                    <span className="sr-only">Thao tác</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {students.data.map((student) => (
                <tr key={student.id}>
                  <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                    {student.code}
                  </td>
                  <td className="py-2 pr-3">
                    <Link
                      href={`/admin/hoc-vien/${student.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {student.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {student.phone}
                  </td>
                  <td className="py-2 pr-3">
                    <StatusPill
                      status={STUDENT_STATUS_LABELS[student.status]}
                    />
                  </td>
                  {canUpdateStudents ? (
                    <td className="py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Bỏ khỏi lớp: ${student.name}`}
                        onClick={() => setRemoving(student)}
                      >
                        Bỏ khỏi lớp
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canUpdateStudents ? (
        <ConfirmDialog
          open={removing !== null}
          onOpenChange={(next) => {
            if (!next) setRemoving(null)
          }}
          title={`Bỏ ${removing?.name ?? ""} khỏi lớp ${cls.code}?`}
          description="Học viên trở về trạng thái chưa xếp lớp."
          confirmLabel="Bỏ khỏi lớp"
          destructive
          pending={remove.isPending}
          onConfirm={() => {
            if (removing) remove.mutate(removing)
          }}
        />
      ) : null}
    </section>
  )
}

export function ClassDetail({ id }: { id: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const canUpdate = useCan("class.update")
  const canDelete = useCan("class.delete")
  const canUpdateStudents = useCan("student.update")
  const branches = useBranches()
  const [editOpen, setEditOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const classQuery = useQuery({
    queryKey: ["class", id],
    queryFn: ({ signal }) =>
      apiData<TrainingClass>(`/classes/${id}`, { signal }),
  })

  const remove = useMutation({
    mutationFn: () => apiFetch<void>(`/classes/${id}`, { method: "DELETE" }),
    meta: { silent: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["classes"] })
      // Backend gỡ classId của học viên (đã thôi học/hoàn thành) khỏi lớp
      void queryClient.invalidateQueries({ queryKey: ["students"] })
      void queryClient.invalidateQueries({ queryKey: ["student"] })
      // Không kéo lại GET /classes/:id (404) khi trang còn quan sát query
      void queryClient.cancelQueries({ queryKey: ["class", id] })
      void queryClient.cancelQueries({ queryKey: ["class-students", id] })
      toast.success(`Đã xoá lớp ${classQuery.data?.code ?? ""}`.trim())
      setDeleteOpen(false)
      router.push("/admin/lop-hoc")
    },
    onError: (error) => {
      // 409 còn học viên: báo một lần, giữ nguyên trang
      toast.error(errorMessage(error))
      setDeleteOpen(false)
    },
  })

  const backLink = (
    <Link
      href="/admin/lop-hoc"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Về danh sách lớp
    </Link>
  )

  if (classQuery.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        {backLink}
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  if (classQuery.error) {
    const notFound =
      classQuery.error instanceof ApiError && classQuery.error.status === 404
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-border/80 bg-card p-6">
        <p className="font-semibold text-navy">
          {notFound ? "Không tìm thấy lớp học" : "Không tải được dữ liệu."}
        </p>
        {notFound ? (
          <p className="text-sm text-muted-foreground">
            Lớp có thể đã bị xoá hoặc không thuộc phạm vi của bạn.
          </p>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => void classQuery.refetch()}
          >
            Thử lại
          </Button>
        )}
        {backLink}
      </div>
    )
  }

  const cls = classQuery.data

  return (
    <div className="flex flex-col gap-4">
      {backLink}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-navy sm:text-xl">
              {cls.code}
            </h1>
            <StatusPill status={CLASS_STATUS_LABELS[cls.status]} />
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {cls.course?.name ?? cls.courseCode}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canUpdateStudents ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setAssignOpen(true)}
            >
              <UserPlus aria-hidden="true" />
              Xếp học viên
            </Button>
          ) : null}
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
          {canDelete ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 aria-hidden="true" />
              Xoá lớp
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <section className="min-w-0 rounded-xl border border-border/80 bg-card p-4">
          <SectionHeading title="Thông tin lớp" />
          <dl className="mt-2 divide-y divide-border/60">
            <InfoRow label="Gói">{classTitle(cls)}</InfoRow>
            <InfoRow label="Chi nhánh">
              {nameById(branches.data, cls.branchId, "—")}
            </InfoRow>
            <InfoRow label="Thời gian">
              {`${formatDate(cls.startDate)} – ${formatDate(cls.endDate)}`}
            </InfoRow>
            <InfoRow label="Lịch học">{cls.scheduleText}</InfoRow>
            <InfoRow label="Giáo viên">{cls.instructor?.name ?? empty}</InfoRow>
            <InfoRow label="Sĩ số">
              {`${cls.filled}/${cls.capacity} · ${
                cls.seatsLeft > 0 ? `còn ${cls.seatsLeft} chỗ` : "Hết chỗ"
              }`}
            </InfoRow>
            <InfoRow label="Ghi chú">
              {cls.note ? (
                <span className="whitespace-pre-line">{cls.note}</span>
              ) : (
                empty
              )}
            </InfoRow>
            <InfoRow label="Ngày tạo">{formatDateTime(cls.createdAt)}</InfoRow>
          </dl>
        </section>

        <ClassStudents cls={cls} canUpdateStudents={canUpdateStudents} />
      </div>

      {canUpdate ? (
        <ClassFormSheet open={editOpen} onOpenChange={setEditOpen} cls={cls} />
      ) : null}
      {canUpdateStudents ? (
        <ClassAssignSheet
          open={assignOpen}
          onOpenChange={setAssignOpen}
          cls={cls}
        />
      ) : null}
      {canDelete ? (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={`Xoá lớp ${cls.code}?`}
          description="Chỉ xoá được lớp không còn học viên đang học. Không thể hoàn tác."
          confirmLabel="Xoá lớp"
          destructive
          pending={remove.isPending}
          onConfirm={() => remove.mutate()}
        />
      ) : null}
    </div>
  )
}
