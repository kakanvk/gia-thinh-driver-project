"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Search } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { EntitySheet } from "@/components/admin/entity-sheet"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import type { Page, Student, TrainingClass } from "@/lib/admin/types"
import { apiData, apiFetch } from "@/lib/api/client"
import { errorMessage } from "@/lib/api/errors"

const DEBOUNCE_MS = 300
const LIMIT = 20

type AssignResult = {
  added: number
  failures: { student: Student; message: string }[]
}

// Xếp nhiều học viên (cùng chi nhánh + gói, Đang học, chưa có lớp) vào lớp:
// gọi PATCH /students/:id/class lần lượt, báo lỗi riêng từng học viên
export function ClassAssignSheet({
  open,
  onOpenChange,
  cls,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cls: TrainingClass
}) {
  const queryClient = useQueryClient()
  const [text, setText] = useState("")
  const [q, setQ] = useState("")
  const [selected, setSelected] = useState<Student[]>([])
  const [result, setResult] = useState<AssignResult | null>(null)
  const [error, setError] = useState("")
  const [wasOpen, setWasOpen] = useState(open)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setText("")
      setQ("")
      setSelected([])
      setResult(null)
      setError("")
    }
  }

  useEffect(() => {
    const next = text.trim()
    if (next === q) return
    const timer = setTimeout(() => setQ(next), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text, q])

  const query = {
    branchId: cls.branchId,
    courseId: cls.courseId,
    status: "studying",
    q,
    limit: LIMIT,
  }
  const students = useQuery({
    queryKey: ["students", "assign", query],
    queryFn: ({ signal }) =>
      apiFetch<Page<Student>>("/students", { query, signal }),
    enabled: open,
  })
  // API không lọc "chưa có lớp": bỏ ở client
  const candidates = (students.data?.data ?? []).filter(
    (student) => !student.classId
  )

  const mutation = useMutation({
    mutationFn: async (list: Student[]): Promise<AssignResult> => {
      const outcome: AssignResult = { added: 0, failures: [] }
      // Lần lượt: lớp có thể đầy giữa chừng, người đã xếp vẫn giữ
      for (const student of list) {
        try {
          await apiData<Student>(`/students/${student.id}/class`, {
            method: "PATCH",
            body: { classId: cls.id },
          })
          outcome.added += 1
        } catch (err) {
          outcome.failures.push({ student, message: errorMessage(err) })
        }
      }
      return outcome
    },
    meta: { silent: true },
    onSuccess: (outcome) => {
      if (outcome.added > 0) {
        void queryClient.invalidateQueries({ queryKey: ["class-students"] })
        void queryClient.invalidateQueries({ queryKey: ["class"] })
        void queryClient.invalidateQueries({ queryKey: ["classes"] })
        void queryClient.invalidateQueries({ queryKey: ["students"] })
        void queryClient.invalidateQueries({ queryKey: ["student"] })
      }
      setSelected([])
      if (outcome.failures.length === 0) {
        toast.success(`Đã xếp ${outcome.added} học viên vào lớp`)
        onOpenChange(false)
        return
      }
      setResult(outcome)
    },
    onError: (err) => setError(errorMessage(err)),
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
    setResult(null)
    if (selected.length === 0) {
      setError("Chọn ít nhất một học viên")
      return
    }
    setError("")
    mutation.mutate(selected)
  }

  const selectedIds = new Set(selected.map((student) => student.id))

  return (
    <EntitySheet
      open={open}
      onOpenChange={onOpenChange}
      title="Xếp học viên"
      description={`${cls.code} · ${cls.courseCode} · còn ${cls.seatsLeft} chỗ`}
      submitLabel={
        selected.length > 0 ? `Xếp ${selected.length} học viên` : "Xếp học viên"
      }
      submitting={mutation.isPending}
      onSubmit={onSubmit}
    >
      <p className="text-xs text-muted-foreground">
        Học viên cùng chi nhánh và gói học, đang học, chưa có lớp.
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

      {result ? (
        <div
          role="status"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
        >
          <p className="font-medium text-navy">
            Đã xếp {result.added} học viên
          </p>
          <ul className="mt-1.5 flex flex-col gap-1 text-destructive">
            {result.failures.map(({ student, message }) => (
              <li key={student.id}>
                <span className="font-medium">
                  {student.name} ({student.code})
                </span>
                : {message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {students.isPending ? (
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
      ) : students.error ? (
        <p className="text-sm text-muted-foreground">
          Không tải được danh sách học viên.
        </p>
      ) : candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Không có học viên phù hợp.
        </p>
      ) : (
        <div
          role="group"
          aria-label="Học viên chưa có lớp"
          className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/70"
        >
          {candidates.map((student) => (
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
      {selected.length > cls.seatsLeft ? (
        <p className="text-xs text-muted-foreground">
          Đã chọn nhiều hơn số chỗ còn lại; học viên vượt sĩ số sẽ báo lỗi.
        </p>
      ) : null}
    </EntitySheet>
  )
}
