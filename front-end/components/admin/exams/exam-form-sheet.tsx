"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { EntitySheet } from "@/components/admin/entity-sheet"
import { FormField } from "@/components/admin/form-field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  EXAM_STATUS_LABELS,
  EXAM_STATUSES,
  EXAM_TYPE_LABELS,
  EXAM_TYPES,
} from "@/lib/admin/labels"
import { useBranchChoice, useCourses } from "@/lib/admin/lookups"
import type { ExamSession, ExamStatus } from "@/lib/admin/types"
import { apiData } from "@/lib/api/client"
import { ApiError, errorMessage, fieldErrors } from "@/lib/api/errors"

// Giống codeSchema của exams.validation.ts (sau khi in hoa)
const CODE_PATTERN = /^[A-Z0-9]+(-[A-Z0-9]+)*$/

type FormValues = {
  code: string
  type: string
  courseId: string
  branchId: string
  date: string
  location: string
  status: string
  note: string
}

type Body = Record<string, string | null>

// Backend không cho đổi loại/gói/chi nhánh của ca qua PATCH /exams/:id
const CREATE_ONLY = ["type", "courseId", "branchId"] as const
// Trường xoá trống khi sửa → null
const NULLABLE = ["location", "note"] as const

function initialValues(
  exam: ExamSession | undefined,
  defaultBranchId: string
): FormValues {
  return {
    code: exam?.code ?? "",
    type: exam?.type ?? "",
    courseId: exam?.courseId ?? "",
    branchId: exam?.branchId ?? defaultBranchId,
    // Ngày thi là ngày (date-only) — API trả ISO kèm +07:00: cắt yyyy-MM-dd
    date: exam ? exam.date.slice(0, 10) : "",
    location: exam?.location ?? "",
    status: exam?.status ?? ("scheduled" satisfies ExamStatus),
    note: exam?.note ?? "",
  }
}

function trimmed(values: FormValues): FormValues {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, value.trim()])
  ) as FormValues
}

// Thêm: bỏ trường rỗng. Sửa: chỉ gửi trường đổi, trường xoá trống gửi null.
function buildBody(
  values: FormValues,
  initial: FormValues,
  isEdit: boolean
): Body {
  const body: Body = {}
  for (const key of Object.keys(values) as (keyof FormValues)[]) {
    const value = values[key]
    if (isEdit) {
      if ((CREATE_ONLY as readonly string[]).includes(key)) continue
      if (value === initial[key]) continue
      if (!value) {
        if ((NULLABLE as readonly string[]).includes(key)) body[key] = null
        continue
      }
    } else if (!value) {
      continue
    }
    body[key] = value
  }
  return body
}

function validate(values: FormValues, isEdit: boolean): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!values.code) errors.code = "Nhập mã ca thi"
  else if (!CODE_PATTERN.test(values.code))
    errors.code = "Mã ca thi chỉ gồm chữ, số và dấu gạch ngang"
  else if (values.code.length > 30) errors.code = "Mã ca thi tối đa 30 ký tự"
  if (!isEdit) {
    if (!values.type) errors.type = "Chọn loại thi"
    if (!values.courseId) errors.courseId = "Chọn gói học"
    if (!values.branchId) errors.branchId = "Chọn chi nhánh"
  }
  if (!values.date) errors.date = "Chọn ngày thi"
  return errors
}

export function ExamFormSheet({
  open,
  onOpenChange,
  exam,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  exam?: ExamSession
  onSaved?: (exam: ExamSession) => void
}) {
  const isEdit = Boolean(exam)
  const queryClient = useQueryClient()
  const { branches, defaultBranchId, showBranchSelect } = useBranchChoice()
  const courses = useCourses()

  const [values, setValues] = useState<FormValues>(() =>
    initialValues(exam, defaultBranchId)
  )
  // Mốc so sánh khi sửa: chụp lúc mở sheet
  const [baseline, setBaseline] = useState<FormValues>(() =>
    initialValues(exam, defaultBranchId)
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [wasOpen, setWasOpen] = useState(open)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      const initial = initialValues(exam, defaultBranchId)
      setValues(initial)
      setBaseline(initial)
      setErrors({})
    }
  }

  const mutation = useMutation({
    mutationFn: (body: Body) =>
      exam
        ? apiData<ExamSession>(`/exams/${exam.id}`, { method: "PATCH", body })
        : apiData<ExamSession>("/exams", { method: "POST", body }),
    meta: { silent: true },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ["exams"] })
      if (exam) {
        queryClient.setQueryData(["exam", saved.id], saved)
        // Mã/ngày ca thi hiển thị ở "Các lần thi" của học viên
        void queryClient.invalidateQueries({ queryKey: ["student-exams"] })
        toast.success(`Đã lưu ca thi ${saved.code}`)
      } else {
        toast.success(`Đã xếp ca thi ${saved.code}`)
      }
      onOpenChange(false)
      onSaved?.(saved)
    },
    onError: (error) => {
      const fields = error instanceof ApiError ? fieldErrors(error.details) : {}
      setErrors(fields)
      if (Object.keys(fields).length === 0) toast.error(errorMessage(error))
    },
  })

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const clean = trimmed(values)
    const nextErrors = validate(clean, isEdit)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    const body = buildBody(clean, trimmed(baseline), isEdit)
    if (isEdit && Object.keys(body).length === 0) {
      onOpenChange(false)
      return
    }
    mutation.mutate(body)
  }

  const typeItems = EXAM_TYPES.map((value) => ({
    value,
    label: EXAM_TYPE_LABELS[value],
  }))
  const branchItems = branches.map((branch) => ({
    value: branch.id,
    label: branch.name,
  }))
  const courseItems = (courses.data ?? []).map((course) => ({
    value: course.id,
    label: `${course.code} · ${course.name}`,
  }))
  const statusItems = EXAM_STATUSES.map((value) => ({
    value,
    label: EXAM_STATUS_LABELS[value],
  }))

  return (
    <EntitySheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Sửa ca thi" : "Xếp ca thi"}
      description={isEdit ? exam?.code : "Xếp ca thi tốt nghiệp hoặc sát hạch"}
      submitLabel={isEdit ? "Lưu" : "Xếp ca thi"}
      submitting={mutation.isPending}
      onSubmit={onSubmit}
    >
      <FormField id="exam-code" label="Mã ca thi" required error={errors.code}>
        <Input
          autoComplete="off"
          maxLength={30}
          placeholder="VD: SH-2611-01"
          value={values.code}
          onChange={(event) => update("code", event.target.value.toUpperCase())}
        />
      </FormField>
      {isEdit ? null : (
        <>
          <FormField id="exam-type" label="Loại" required error={errors.type}>
            {(control) => (
              <Select
                items={typeItems}
                value={values.type || null}
                onValueChange={(value) => update("type", value ?? "")}
              >
                <SelectTrigger {...control} className="w-full">
                  <SelectValue placeholder="Chọn loại" />
                </SelectTrigger>
                <SelectContent>
                  {typeItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormField
            id="exam-course"
            label="Gói học"
            required
            error={errors.courseId}
          >
            {(control) => (
              <Select
                items={courseItems}
                value={values.courseId || null}
                onValueChange={(value) => update("courseId", value ?? "")}
              >
                <SelectTrigger {...control} className="w-full">
                  <SelectValue placeholder="Chọn gói" />
                </SelectTrigger>
                <SelectContent>
                  {courseItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          {showBranchSelect || errors.branchId ? (
            <FormField
              id="exam-branch"
              label="Chi nhánh"
              required
              error={errors.branchId}
            >
              {(control) => (
                <Select
                  items={branchItems}
                  value={values.branchId || null}
                  onValueChange={(value) => update("branchId", value ?? "")}
                >
                  <SelectTrigger {...control} className="w-full">
                    <SelectValue placeholder="Chọn chi nhánh" />
                  </SelectTrigger>
                  <SelectContent>
                    {branchItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          ) : null}
        </>
      )}
      <FormField id="exam-date" label="Ngày thi" required error={errors.date}>
        <Input
          type="date"
          value={values.date}
          onChange={(event) => update("date", event.target.value)}
        />
      </FormField>
      <FormField id="exam-location" label="Địa điểm" error={errors.location}>
        <Input
          autoComplete="off"
          maxLength={200}
          placeholder="VD: Trung tâm sát hạch Vĩnh Long"
          value={values.location}
          onChange={(event) => update("location", event.target.value)}
        />
      </FormField>
      <FormField id="exam-status" label="Trạng thái" error={errors.status}>
        {(control) => (
          <Select
            items={statusItems}
            value={values.status}
            onValueChange={(value) => update("status", value ?? "scheduled")}
          >
            <SelectTrigger {...control} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
      <FormField id="exam-note" label="Ghi chú" error={errors.note}>
        <Textarea
          rows={3}
          maxLength={500}
          value={values.note}
          onChange={(event) => update("note", event.target.value)}
        />
      </FormField>
    </EntitySheet>
  )
}
