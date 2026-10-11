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
import { todayVn } from "@/lib/admin/datetime"
import {
  useBranchChoice,
  useClassOptions,
  useCourses,
} from "@/lib/admin/lookups"
import type { Student } from "@/lib/admin/types"
import { useCan } from "@/lib/admin/use-can"
import { apiData } from "@/lib/api/client"
import { ApiError, errorMessage, fieldErrors } from "@/lib/api/errors"

// Giá trị "không chọn" cho Select (Base UI không có item rỗng)
const NONE = "none"

type FormValues = {
  name: string
  phone: string
  courseId: string
  branchId: string
  email: string
  dob: string
  idNumber: string
  address: string
  classId: string
  enrolledAt: string
  note: string
}

// Chỉ dùng khi thêm: backend không cho sửa gói/chi nhánh qua PATCH /students/:id,
// lớp đổi qua PATCH /students/:id/class
const CREATE_ONLY = ["courseId", "branchId", "classId"] as const
// Các trường được phép xoá trống khi sửa (backend nhận null)
const NULLABLE = ["email", "dob", "idNumber", "address", "note"] as const

// Ngày (date-only) từ API là ISO kèm +07:00: cắt yyyy-MM-dd
function dateOnly(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : ""
}

function initialValues(
  student: Student | undefined,
  defaultBranchId: string
): FormValues {
  return {
    name: student?.name ?? "",
    phone: student?.phone ?? "",
    courseId: student?.courseId ?? "",
    branchId: student?.branchId ?? defaultBranchId,
    email: student?.email ?? "",
    dob: dateOnly(student?.dob),
    idNumber: student?.idNumber ?? "",
    address: student?.address ?? "",
    classId: student?.classId ?? "",
    enrolledAt: student ? dateOnly(student.enrolledAt) : todayVn(),
    note: student?.note ?? "",
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
): Record<string, string | null> {
  const body: Record<string, string | null> = {}
  const keys = Object.keys(values) as (keyof FormValues)[]
  for (const key of keys) {
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
  if (!values.name) errors.name = "Nhập họ và tên"
  if (!values.phone) errors.phone = "Nhập số điện thoại"
  if (!isEdit) {
    if (!values.courseId) errors.courseId = "Chọn gói học"
    if (!values.branchId) errors.branchId = "Chọn chi nhánh"
  }
  if (values.idNumber && !/^\d{12}$/.test(values.idNumber))
    errors.idNumber = "CCCD gồm 12 chữ số"
  return errors
}

export function StudentFormSheet({
  open,
  onOpenChange,
  student,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  student?: Student
  onSaved?: (student: Student) => void
}) {
  const isEdit = Boolean(student)
  const queryClient = useQueryClient()
  // Tư vấn viên có student.create nhưng không có class.read: bỏ ô chọn lớp
  const canReadClasses = useCan("class.read")
  const { branches, defaultBranchId, showBranchSelect } = useBranchChoice()
  const courses = useCourses()

  const [values, setValues] = useState<FormValues>(() =>
    initialValues(student, defaultBranchId)
  )
  // Mốc so sánh khi sửa: chụp lúc mở sheet, không theo `student` refetch giữa chừng
  const [baseline, setBaseline] = useState<FormValues>(() =>
    initialValues(student, defaultBranchId)
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [wasOpen, setWasOpen] = useState(open)

  // Mỗi lần mở lại: điền lại từ học viên hiện tại (sửa) hoặc để trống (thêm)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      const initial = initialValues(student, defaultBranchId)
      setValues(initial)
      setBaseline(initial)
      setErrors({})
    }
  }

  const showClassSelect = !isEdit && canReadClasses
  const classes = useClassOptions({
    branchId: values.branchId,
    courseId: values.courseId,
    enabled:
      open &&
      showClassSelect &&
      Boolean(values.branchId) &&
      Boolean(values.courseId),
  })

  const mutation = useMutation({
    mutationFn: (body: Record<string, string | null>) =>
      student
        ? apiData<Student>(`/students/${student.id}`, { method: "PATCH", body })
        : apiData<Student>("/students", { method: "POST", body }),
    meta: { silent: true },
    onSuccess: (saved, body) => {
      void queryClient.invalidateQueries({ queryKey: ["students"] })
      if (student) {
        queryClient.setQueryData(["student", saved.id], saved)
        toast.success("Đã lưu thông tin học viên")
      } else {
        // Xếp lớp ngay khi thêm: sĩ số lớp đổi
        if (body.classId) {
          void queryClient.invalidateQueries({ queryKey: ["classes"] })
          void queryClient.invalidateQueries({ queryKey: ["class"] })
          void queryClient.invalidateQueries({ queryKey: ["class-students"] })
        }
        toast.success(`Đã thêm học viên ${saved.code}`)
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

  const branchItems = branches.map((branch) => ({
    value: branch.id,
    label: branch.name,
  }))
  const courseItems = (courses.data ?? []).map((course) => ({
    value: course.id,
    label: `${course.code} · ${course.name}`,
  }))
  const classItems = [
    { value: NONE, label: "Chưa xếp lớp", disabled: false },
    ...(classes.data ?? []).map((cls) => ({
      value: cls.id,
      label:
        cls.seatsLeft > 0
          ? `${cls.code} · còn ${cls.seatsLeft} chỗ`
          : `${cls.code} · Hết chỗ`,
      disabled: cls.seatsLeft <= 0,
    })),
  ]

  return (
    <EntitySheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Sửa hồ sơ học viên" : "Thêm học viên"}
      description={isEdit ? student?.code : "Ghi danh học viên mới"}
      submitLabel={isEdit ? "Lưu" : "Thêm học viên"}
      submitting={mutation.isPending}
      onSubmit={onSubmit}
    >
      <FormField id="student-name" label="Họ và tên" required error={errors.name}>
        <Input
          autoComplete="off"
          value={values.name}
          onChange={(event) => update("name", event.target.value)}
        />
      </FormField>
      <FormField
        id="student-phone"
        label="Số điện thoại"
        required
        error={errors.phone}
      >
        <Input
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={values.phone}
          onChange={(event) => update("phone", event.target.value)}
        />
      </FormField>
      {isEdit ? null : (
        <FormField
          id="student-course"
          label="Gói học"
          required
          error={errors.courseId}
        >
          {(control) => (
            <Select
              items={courseItems}
              value={values.courseId || null}
              onValueChange={(value) => {
                update("courseId", value ?? "")
                update("classId", "")
              }}
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
          id="student-branch"
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
                update("classId", "")
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
      <FormField id="student-email" label="Email" error={errors.email}>
        <Input
          type="email"
          autoComplete="off"
          value={values.email}
          onChange={(event) => update("email", event.target.value)}
        />
      </FormField>
      <FormField id="student-dob" label="Ngày sinh" error={errors.dob}>
        <Input
          type="date"
          value={values.dob}
          onChange={(event) => update("dob", event.target.value)}
        />
      </FormField>
      <FormField id="student-id-number" label="CCCD" error={errors.idNumber}>
        <Input
          inputMode="numeric"
          autoComplete="off"
          maxLength={12}
          placeholder="12 chữ số"
          value={values.idNumber}
          onChange={(event) => update("idNumber", event.target.value)}
        />
      </FormField>
      <FormField id="student-address" label="Địa chỉ" error={errors.address}>
        <Input
          autoComplete="off"
          value={values.address}
          onChange={(event) => update("address", event.target.value)}
        />
      </FormField>
      {showClassSelect ? (
        <FormField id="student-class" label="Lớp" error={errors.classId}>
          {(control) => (
            <Select
              items={classItems}
              value={values.classId || NONE}
              disabled={!values.branchId || !values.courseId}
              onValueChange={(value) =>
                update("classId", !value || value === NONE ? "" : value)
              }
            >
              <SelectTrigger {...control} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {classItems.map((item) => (
                  <SelectItem
                    key={item.value}
                    value={item.value}
                    disabled={item.disabled}
                  >
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
      ) : null}
      <FormField
        id="student-enrolled-at"
        label="Ngày nhập học"
        error={errors.enrolledAt}
      >
        <Input
          type="date"
          value={values.enrolledAt}
          onChange={(event) => update("enrolledAt", event.target.value)}
        />
      </FormField>
      <FormField id="student-note" label="Ghi chú" error={errors.note}>
        <Textarea
          rows={3}
          value={values.note}
          onChange={(event) => update("note", event.target.value)}
        />
      </FormField>
      {isEdit ? null : (
        <p className="text-xs text-muted-foreground">
          Sổ học phí được tạo tự động.
        </p>
      )}
    </EntitySheet>
  )
}
