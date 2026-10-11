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
  CLASS_STATUS_LABELS,
  CLASS_STATUSES,
  TRANSMISSION_LABELS,
  TRANSMISSIONS,
} from "@/lib/admin/labels"
import {
  useBranchChoice,
  useCourses,
  useInstructorOptions,
} from "@/lib/admin/lookups"
import type { ClassStatus, TrainingClass } from "@/lib/admin/types"
import { useCan } from "@/lib/admin/use-can"
import { apiData } from "@/lib/api/client"
import { ApiError, errorMessage, fieldErrors } from "@/lib/api/errors"

// Giá trị "không chọn" cho Select (Base UI không có item rỗng)
const NONE = "none"

// Giống codeSchema của classes.validation.ts (sau khi in hoa)
const CODE_PATTERN = /^[A-Z0-9]+(-[A-Z0-9]+)*$/

type FormValues = {
  code: string
  courseId: string
  branchId: string
  startDate: string
  endDate: string
  scheduleText: string
  capacity: string
  transmission: string
  instructorId: string
  status: string
  note: string
}

type Body = Record<string, string | number | null>

// Backend không cho đổi gói/chi nhánh của lớp qua PATCH /classes/:id
const CREATE_ONLY = ["courseId", "branchId"] as const
// Trường xoá trống khi sửa → null
const NULLABLE = ["transmission", "instructorId", "note"] as const

// Ngày (date-only) từ API là ISO kèm +07:00: cắt yyyy-MM-dd
function dateOnly(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : ""
}

function initialValues(
  cls: TrainingClass | undefined,
  defaultBranchId: string
): FormValues {
  return {
    code: cls?.code ?? "",
    courseId: cls?.courseId ?? "",
    branchId: cls?.branchId ?? defaultBranchId,
    startDate: dateOnly(cls?.startDate),
    endDate: dateOnly(cls?.endDate),
    scheduleText: cls?.scheduleText ?? "",
    capacity: cls ? String(cls.capacity) : "",
    transmission: cls?.transmission ?? "",
    instructorId: cls?.instructorId ?? "",
    status: cls?.status ?? ("enrolling" satisfies ClassStatus),
    note: cls?.note ?? "",
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
    body[key] = key === "capacity" ? Number(value) : value
  }
  return body
}

function validate(values: FormValues, isEdit: boolean): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!values.code) errors.code = "Nhập mã lớp"
  else if (!CODE_PATTERN.test(values.code))
    errors.code = "Mã lớp chỉ gồm chữ, số và dấu gạch ngang"
  else if (values.code.length > 30) errors.code = "Mã lớp tối đa 30 ký tự"
  if (!isEdit) {
    if (!values.courseId) errors.courseId = "Chọn gói học"
    if (!values.branchId) errors.branchId = "Chọn chi nhánh"
  }
  if (!values.startDate) errors.startDate = "Chọn ngày khai giảng"
  if (!values.endDate) errors.endDate = "Chọn ngày kết thúc"
  else if (values.startDate && values.endDate < values.startDate)
    errors.endDate = "Ngày kết thúc phải sau ngày khai giảng"
  if (values.scheduleText.length < 2) errors.scheduleText = "Nhập lịch học"
  const capacity = Number(values.capacity)
  if (
    !values.capacity ||
    !Number.isInteger(capacity) ||
    capacity < 1 ||
    capacity > 200
  )
    errors.capacity = "Sức chứa từ 1 đến 200"
  return errors
}

export function ClassFormSheet({
  open,
  onOpenChange,
  cls,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cls?: TrainingClass
  onSaved?: (cls: TrainingClass) => void
}) {
  const isEdit = Boolean(cls)
  const queryClient = useQueryClient()
  const canReadInstructors = useCan("instructor.read")
  const { branches, defaultBranchId, showBranchSelect } = useBranchChoice()
  const courses = useCourses()

  const [values, setValues] = useState<FormValues>(() =>
    initialValues(cls, defaultBranchId)
  )
  // Mốc so sánh khi sửa: chụp lúc mở sheet
  const [baseline, setBaseline] = useState<FormValues>(() =>
    initialValues(cls, defaultBranchId)
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [wasOpen, setWasOpen] = useState(open)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      const initial = initialValues(cls, defaultBranchId)
      setValues(initial)
      setBaseline(initial)
      setErrors({})
    }
  }

  const instructors = useInstructorOptions(values.branchId, {
    enabled: open && canReadInstructors && Boolean(values.branchId),
  })

  const mutation = useMutation({
    mutationFn: (body: Body) =>
      cls
        ? apiData<TrainingClass>(`/classes/${cls.id}`, {
            method: "PATCH",
            body,
          })
        : apiData<TrainingClass>("/classes", { method: "POST", body }),
    meta: { silent: true },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ["classes"] })
      if (cls) {
        queryClient.setQueryData(["class", saved.id], saved)
        // Mã lớp hiển thị ở học viên của lớp
        void queryClient.invalidateQueries({ queryKey: ["students"] })
        toast.success(`Đã lưu lớp ${saved.code}`)
      } else {
        toast.success(`Đã mở lớp ${saved.code}`)
      }
      onOpenChange(false)
      onSaved?.(saved)
    },
    onError: (error, body) => {
      const fields = error instanceof ApiError ? fieldErrors(error.details) : {}
      // 409 giảm sức chứa dưới sĩ số: backend không gắn path → hiện dưới ô
      if (
        Object.keys(fields).length === 0 &&
        error instanceof ApiError &&
        error.status === 409 &&
        body.capacity !== undefined
      ) {
        fields.capacity = error.message
      }
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

  const branchItems = branches.map((branch) => ({
    value: branch.id,
    label: branch.name,
  }))
  const courseItems = (courses.data ?? []).map((course) => ({
    value: course.id,
    label: `${course.code} · ${course.name}`,
  }))
  const transmissionItems = [
    { value: NONE, label: "Không ghi" },
    ...TRANSMISSIONS.map((value) => ({
      value,
      label: TRANSMISSION_LABELS[value],
    })),
  ]
  const instructorOptions = (instructors.data ?? []).map((item) => ({
    value: item.id,
    label: item.name,
  }))
  // Giáo viên hiện tại có thể đã nghỉ (không còn trong danh sách đang hoạt động)
  if (
    cls?.instructor &&
    values.branchId === cls.branchId &&
    !instructorOptions.some((item) => item.value === cls.instructor?.id)
  ) {
    instructorOptions.push({
      value: cls.instructor.id,
      label: cls.instructor.name,
    })
  }
  const instructorItems = [
    { value: NONE, label: "Chưa phân công" },
    ...instructorOptions,
  ]
  const statusItems = CLASS_STATUSES.map((value) => ({
    value,
    label: CLASS_STATUS_LABELS[value],
  }))

  return (
    <EntitySheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Sửa lớp học" : "Mở lớp"}
      description={isEdit ? cls?.code : "Mở lớp học mới"}
      submitLabel={isEdit ? "Lưu" : "Mở lớp"}
      submitting={mutation.isPending}
      onSubmit={onSubmit}
    >
      <FormField id="class-code" label="Mã lớp" required error={errors.code}>
        <Input
          autoComplete="off"
          maxLength={30}
          placeholder="VD: B-2610"
          value={values.code}
          onChange={(event) => update("code", event.target.value.toUpperCase())}
        />
      </FormField>
      {isEdit ? null : (
        <FormField
          id="class-course"
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
      )}
      {!isEdit && (showBranchSelect || errors.branchId) ? (
        <FormField
          id="class-branch"
          label="Chi nhánh"
          required
          error={errors.branchId}
        >
          {(control) => (
            <Select
              items={branchItems}
              value={values.branchId || null}
              onValueChange={(value) => {
                update("branchId", value ?? "")
                // Giáo viên thuộc chi nhánh cũ không còn hợp lệ
                update("instructorId", "")
              }}
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
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="class-start-date"
          label="Ngày khai giảng"
          required
          error={errors.startDate}
        >
          <Input
            type="date"
            value={values.startDate}
            onChange={(event) => update("startDate", event.target.value)}
          />
        </FormField>
        <FormField
          id="class-end-date"
          label="Ngày kết thúc"
          required
          error={errors.endDate}
        >
          <Input
            type="date"
            value={values.endDate}
            onChange={(event) => update("endDate", event.target.value)}
          />
        </FormField>
      </div>
      <FormField
        id="class-schedule"
        label="Lịch học"
        required
        error={errors.scheduleText}
      >
        <Input
          autoComplete="off"
          maxLength={100}
          placeholder="VD: T2-T4-T6, 18:00–20:00"
          value={values.scheduleText}
          onChange={(event) => update("scheduleText", event.target.value)}
        />
      </FormField>
      <FormField
        id="class-capacity"
        label="Sức chứa"
        required
        error={errors.capacity}
      >
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          max={200}
          step={1}
          value={values.capacity}
          onChange={(event) => update("capacity", event.target.value)}
        />
      </FormField>
      <FormField id="class-transmission" label="Số" error={errors.transmission}>
        {(control) => (
          <Select
            items={transmissionItems}
            value={values.transmission || NONE}
            onValueChange={(value) =>
              update("transmission", !value || value === NONE ? "" : value)
            }
          >
            <SelectTrigger {...control} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {transmissionItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
      {canReadInstructors ? (
        <FormField
          id="class-instructor"
          label="Giáo viên"
          error={errors.instructorId}
        >
          {(control) => (
            <Select
              items={instructorItems}
              value={values.instructorId || NONE}
              disabled={!values.branchId}
              onValueChange={(value) =>
                update("instructorId", !value || value === NONE ? "" : value)
              }
            >
              <SelectTrigger {...control} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {instructorItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
      ) : null}
      <FormField id="class-status" label="Trạng thái" error={errors.status}>
        {(control) => (
          <Select
            items={statusItems}
            value={values.status}
            onValueChange={(value) => update("status", value ?? "enrolling")}
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
      <FormField id="class-note" label="Ghi chú" error={errors.note}>
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
