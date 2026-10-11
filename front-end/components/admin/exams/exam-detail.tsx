"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Pencil, Trash2, UserPlus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { SectionHeading, StatusPill } from "@/components/admin/admin-ui"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { CandidateAddSheet } from "@/components/admin/exams/candidate-add-sheet"
import {
  CandidateRow,
  invalidateExamResults,
} from "@/components/admin/exams/candidate-row"
import { ExamFormSheet } from "@/components/admin/exams/exam-form-sheet"
import { Button } from "@/components/ui/button"
import { formatDate, formatDateTime } from "@/lib/admin/datetime"
import { EXAM_STATUS_LABELS, EXAM_TYPE_LABELS } from "@/lib/admin/labels"
import { nameById, useBranches } from "@/lib/admin/lookups"
import { formatPassRate, passRate } from "@/lib/admin/training"
import type { ExamCandidate, ExamSession } from "@/lib/admin/types"
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

function ExamCandidates({
  exam,
  canUpdate,
}: {
  exam: ExamSession
  canUpdate: boolean
}) {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [removing, setRemoving] = useState<ExamCandidate | null>(null)
  // Ca đã hủy: backend từ chối nhập kết quả
  const canEdit = canUpdate && exam.status !== "cancelled"
  const canAdd = canUpdate && exam.status === "scheduled"

  const candidates = useQuery({
    queryKey: ["exam-candidates", exam.id],
    queryFn: ({ signal }) =>
      apiData<ExamCandidate[]>(`/exams/${exam.id}/candidates`, { signal }),
  })

  const remove = useMutation({
    mutationFn: (candidate: ExamCandidate) =>
      apiFetch<void>(`/exams/${exam.id}/candidates/${candidate.id}`, {
        method: "DELETE",
      }),
    onSuccess: (_result, candidate) => {
      invalidateExamResults(queryClient, exam.id)
      toast.success(
        `Đã xoá ${candidate.student?.name ?? "thí sinh"} khỏi ca thi`
      )
    },
    onSettled: () => setRemoving(null),
  })

  const existing = new Set(
    (candidates.data ?? []).map((candidate) => candidate.studentId)
  )

  return (
    <section className="min-w-0 rounded-xl border border-border/80 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionHeading title="Thí sinh" />
        {canAdd ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAddOpen(true)}
          >
            <UserPlus aria-hidden="true" />
            Thêm thí sinh
          </Button>
        ) : null}
      </div>
      {candidates.isPending ? (
        <div className="mt-3 h-24 animate-pulse rounded-lg bg-muted" />
      ) : candidates.error ? (
        <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
          Không tải được danh sách thí sinh.
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void candidates.refetch()}
          >
            Thử lại
          </Button>
        </div>
      ) : candidates.data.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Ca thi chưa có thí sinh.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Mã</th>
                <th className="py-2 pr-3 font-medium">Học viên</th>
                <th className="py-2 pr-3 font-medium">SĐT</th>
                <th className="py-2 pr-3 text-right font-medium">Lần thi</th>
                <th className="py-2 pr-3 font-medium">Kết quả</th>
                <th className="py-2 pr-3 font-medium">Điểm</th>
                <th className="py-2 pr-3 font-medium">Ghi chú</th>
                {canUpdate ? (
                  <th className="py-2 font-medium">
                    <span className="sr-only">Thao tác</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {candidates.data.map((candidate) => (
                <CandidateRow
                  // Dữ liệu mới từ máy chủ → làm mới ô nhập của dòng
                  key={`${candidate.id}:${candidate.updatedAt}`}
                  examId={exam.id}
                  candidate={candidate}
                  canEdit={canEdit}
                  canRemove={canUpdate}
                  onRemove={setRemoving}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canAdd ? (
        <CandidateAddSheet
          open={addOpen}
          onOpenChange={setAddOpen}
          exam={exam}
          existingStudentIds={existing}
        />
      ) : null}
      {canUpdate ? (
        <ConfirmDialog
          open={removing !== null}
          onOpenChange={(next) => {
            if (!next) setRemoving(null)
          }}
          title={`Xoá ${removing?.student?.name ?? "thí sinh"} khỏi ca ${exam.code}?`}
          description="Chỉ xoá được thí sinh chưa có kết quả."
          confirmLabel="Xoá thí sinh"
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

export function ExamDetail({ id }: { id: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const canUpdate = useCan("exam.update")
  const canDelete = useCan("exam.delete")
  const branches = useBranches()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const examQuery = useQuery({
    queryKey: ["exam", id],
    queryFn: ({ signal }) => apiData<ExamSession>(`/exams/${id}`, { signal }),
  })

  const remove = useMutation({
    mutationFn: () => apiFetch<void>(`/exams/${id}`, { method: "DELETE" }),
    meta: { silent: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["exams"] })
      void queryClient.invalidateQueries({ queryKey: ["student-exams"] })
      // Không kéo lại GET /exams/:id (404) khi trang còn quan sát query
      void queryClient.cancelQueries({ queryKey: ["exam", id] })
      void queryClient.cancelQueries({ queryKey: ["exam-candidates", id] })
      toast.success(`Đã xoá ca thi ${examQuery.data?.code ?? ""}`.trim())
      setDeleteOpen(false)
      router.push("/admin/lich-thi")
    },
    onError: (error) => {
      // 409 đã có kết quả: báo một lần, giữ nguyên trang
      toast.error(errorMessage(error))
      setDeleteOpen(false)
    },
  })

  const backLink = (
    <Link
      href="/admin/lich-thi"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Về danh sách ca thi
    </Link>
  )

  if (examQuery.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        {backLink}
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  if (examQuery.error) {
    const notFound =
      examQuery.error instanceof ApiError && examQuery.error.status === 404
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-border/80 bg-card p-6">
        <p className="font-semibold text-navy">
          {notFound ? "Không tìm thấy ca thi" : "Không tải được dữ liệu."}
        </p>
        {notFound ? (
          <p className="text-sm text-muted-foreground">
            Ca thi có thể đã bị xoá hoặc không thuộc phạm vi của bạn.
          </p>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => void examQuery.refetch()}
          >
            Thử lại
          </Button>
        )}
        {backLink}
      </div>
    )
  }

  const exam = examQuery.data
  const rate = passRate(exam.stats)

  return (
    <div className="flex flex-col gap-4">
      {backLink}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-navy sm:text-xl">
              {exam.code}
            </h1>
            <StatusPill status={EXAM_STATUS_LABELS[exam.status]} />
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {EXAM_TYPE_LABELS[exam.type]} · {exam.courseCode}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
              Xoá ca thi
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <section className="min-w-0 rounded-xl border border-border/80 bg-card p-4">
          <SectionHeading title="Thông tin ca thi" />
          <dl className="mt-2 divide-y divide-border/60">
            <InfoRow label="Loại">{EXAM_TYPE_LABELS[exam.type]}</InfoRow>
            <InfoRow label="Gói">{exam.courseCode}</InfoRow>
            <InfoRow label="Chi nhánh">
              {nameById(branches.data, exam.branchId, "—")}
            </InfoRow>
            <InfoRow label="Ngày thi">{formatDate(exam.date)}</InfoRow>
            <InfoRow label="Địa điểm">{exam.location ?? empty}</InfoRow>
            <InfoRow label="Thí sinh">
              {`${exam.stats.candidates} · Đậu ${exam.stats.passed} · Trượt ${exam.stats.failed} · Vắng ${exam.stats.absent} · Chờ ${exam.stats.pending}`}
            </InfoRow>
            <InfoRow label="Tỷ lệ đậu">
              {rate === null ? empty : formatPassRate(rate)}
            </InfoRow>
            <InfoRow label="Ghi chú">
              {exam.note ? (
                <span className="whitespace-pre-line">{exam.note}</span>
              ) : (
                empty
              )}
            </InfoRow>
            <InfoRow label="Ngày tạo">{formatDateTime(exam.createdAt)}</InfoRow>
          </dl>
        </section>

        <ExamCandidates exam={exam} canUpdate={canUpdate} />
      </div>

      {canUpdate ? (
        <ExamFormSheet open={editOpen} onOpenChange={setEditOpen} exam={exam} />
      ) : null}
      {canDelete ? (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={`Xoá ca thi ${exam.code}?`}
          description="Chỉ xoá được ca chưa có kết quả; thí sinh chờ kết quả cũng bị xoá. Không thể hoàn tác."
          confirmLabel="Xoá ca thi"
          destructive
          pending={remove.isPending}
          onConfirm={() => remove.mutate()}
        />
      ) : null}
    </div>
  )
}
