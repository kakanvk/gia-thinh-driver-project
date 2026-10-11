"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Search } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { EntitySheet } from "@/components/admin/entity-sheet"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import type {
  AddCandidatesResult,
  ExamSession,
  Page,
  Student,
} from "@/lib/admin/types"
import { apiData, apiFetch } from "@/lib/api/client"
import { ApiError, errorMessage } from "@/lib/api/errors"

const DEBOUNCE_MS = 300
const LIMIT = 20
// exams.service.ts addCandidates: skipped = học viên đã có trong ca
const SKIPPED_REASON = "Đã có trong ca thi"

type Outcome = { added: number; skipped: Student[] }
type Failure = { message: string; students: Student[] }

function label(student: Student) {
  return `${student.name} (${student.code})`
}

// Thêm nhiều học viên (cùng chi nhánh + gói, Đang học, chưa có trong ca)
// vào ca thi: POST /exams/:id/candidates { studentIds }
export function CandidateAddSheet({
  open,
  onOpenChange,
  exam,
  existingStudentIds,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  exam: ExamSession
  existingStudentIds: ReadonlySet<string>
}) {
  const queryClient = useQueryClient()
  const [text, setText] = useState("")
  const [q, setQ] = useState("")
  const [selected, setSelected] = useState<Student[]>([])
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [wasOpen, setWasOpen] = useState(open)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setText("")
      setQ("")
      setSelected([])
      setOutcome(null)
      setFailure(null)
    }
  }

  useEffect(() => {
    const next = text.trim()
    if (next === q) return
    const timer = setTimeout(() => setQ(next), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text, q])

  const query = {
    branchId: exam.branchId,
    courseId: exam.courseId,
    status: "studying",
    q,
    limit: LIMIT,
  }
  const students = useQuery({
    queryKey: ["students", "exam-candidates", query],
    queryFn: ({ signal }) =>
      apiFetch<Page<Student>>("/students", { query, signal }),
    enabled: open,
  })
  // Bỏ người đã có trong ca
  const options = (students.data?.data ?? []).filter(
    (student) => !existingStudentIds.has(student.id)
  )

  const mutation = useMutation({
    mutationFn: (list: Student[]) =>
      apiData<AddCandidatesResult>(`/exams/${exam.id}/candidates`, {
        method: "POST",
        body: { studentIds: list.map((student) => student.id) },
      }),
    meta: { silent: true },
    onSuccess: (result, list) => {
      if (result.added > 0) {
        void queryClient.invalidateQueries({
          queryKey: ["exam-candidates", exam.id],
        })
        void queryClient.invalidateQueries({ queryKey: ["exam", exam.id] })
        void queryClient.invalidateQueries({ queryKey: ["exams"] })
        void queryClient.invalidateQueries({ queryKey: ["student-exams"] })
        toast.success(`Đã thêm ${result.added} thí sinh`)
      }
      setSelected([])
      if (result.skipped.length === 0) {
        onOpenChange(false)
        return
      }
      const skipped = new Set(result.skipped)
      setOutcome({
        added: result.added,
        skipped: list.filter((student) => skipped.has(student.id)),
      })
    },
    onError: (error, list) => {
      // 400: backend trả id học viên không hợp lệ (cách nhau dấu phẩy)
      const invalid = new Set(
        (error instanceof ApiError ? error.details : [])
          .filter((detail) => detail.path === "body.studentIds")
          .flatMap((detail) => detail.message.split(","))
      )
      setFailure({
        message: errorMessage(error),
        students: list.filter((student) => invalid.has(student.id)),
      })
    },
  })

  function toggle(student: Student, checked: boolean) {
    setSelected((current) =>
      checked
        ? [...current, student]
        : current.filter((item) => item.id !== student.id)
    )
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setOutcome(null)
    if (selected.length === 0) {
      setFailure({ message: "Chọn ít nhất một học viên", students: [] })
      return
    }
    setFailure(null)
    mutation.mutate(selected)
  }

  const selectedIds = new Set(selected.map((student) => student.id))

  return (
    <EntitySheet
      open={open}
      onOpenChange={onOpenChange}
      title="Thêm thí sinh"
      description={`${exam.code} · ${exam.courseCode}`}
      submitLabel={
        selected.length > 0
          ? `Thêm ${selected.length} thí sinh`
          : "Thêm thí sinh"
      }
      submitting={mutation.isPending}
      onSubmit={onSubmit}
    >
      <p className="text-xs text-muted-foreground">
        Học viên cùng chi nhánh và gói học, đang học, chưa có trong ca thi.
      </p>
      <label className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Tìm học viên"
          placeholder="Tìm tên, SĐT hoặc mã học viên"
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="pl-9"
        />
      </label>

      {outcome ? (
        <div
          role="status"
          className="rounded-lg border border-border/80 bg-muted/40 p-3 text-sm"
        >
          <p className="font-medium text-navy">
            Đã thêm {outcome.added} thí sinh
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Bỏ qua:</p>
          <ul className="mt-1 flex flex-col gap-1">
            {outcome.skipped.map((student) => (
              <li key={student.id}>
                <span className="font-medium">{label(student)}</span>:{" "}
                {SKIPPED_REASON}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {failure ? (
        <div role="alert" className="text-sm text-destructive">
          <p>{failure.message}</p>
          {failure.students.length > 0 ? (
            <ul className="mt-1 list-disc pl-5">
              {failure.students.map((student) => (
                <li key={student.id}>{label(student)}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {students.isPending ? (
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
      ) : students.error ? (
        <p className="text-sm text-muted-foreground">
          Không tải được danh sách học viên.
        </p>
      ) : options.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Không có học viên phù hợp.
        </p>
      ) : (
        <div
          role="group"
          aria-label="Học viên có thể thêm"
          className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/70"
        >
          {options.map((student) => (
            <label
              key={student.id}
              className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/40"
            >
              <Checkbox
                checked={selectedIds.has(student.id)}
                onCheckedChange={(checked) => toggle(student, checked)}
              />
              <span className="min-w-0 text-sm">
                <span className="block font-medium">{student.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {student.code} · {student.phone}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}
    </EntitySheet>
  )
}
