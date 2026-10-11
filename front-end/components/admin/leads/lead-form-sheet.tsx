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
import { toLocalInput, toVnIso } from "@/lib/admin/datetime"
import { LEAD_SOURCE_LABELS, LEAD_SOURCES } from "@/lib/admin/labels"
import {
  useBranchChoice,
  useCourses,
  useStaffOptions,
} from "@/lib/admin/lookups"
import type { Lead, LeadSource } from "@/lib/admin/types"
import { apiData } from "@/lib/api/client"
import { ApiError, errorMessage, fieldErrors } from "@/lib/api/errors"

// Giá trị "không chọn" cho Select (Base UI không có item rỗng)
const NONE = "none"

type FormValues = {
  name: string
  phone: string
  branchId: string
  courseId: string
  email: string
  preferredContactTime: string
  source: LeadSource
  assigneeId: string
  nextFollowUpAt: string
  note: string
}

// Các trường được phép xoá trống khi sửa (backend nhận null)
const NULLABLE = [
  "email",
  "courseId",
  "preferredContactTime",
  "note",
  "nextFollowUpAt",
] as const

function initialValues(lead: Lead | undefined, defaultBranchId: string) {
  return {
    name: lead?.name ?? "",
    phone: lead?.phone ?? "",
    branchId: lead?.branchId ?? defaultBranchId,
    courseId: lead?.courseId ?? "",
    email: lead?.email ?? "",
    preferredContactTime: lead?.preferredContactTime ?? "",
    source: lead?.source ?? "walk_in",
    assigneeId: lead?.assigneeId ?? "",
    nextFollowUpAt: toLocalInput(lead?.nextFollowUpAt),
    note: lead?.note ?? "",
  } satisfies FormValues
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
    if (isEdit && key === "assigneeId") continue
    const value = values[key]
    if (isEdit) {
      if (value === initial[key]) continue
      if (!value) {
        if ((NULLABLE as readonly string[]).includes(key)) body[key] = null
        continue
      }
    } else if (!value) {
      continue
    }
    body[key] = key === "nextFollowUpAt" ? toVnIso(value) : value
  }
  return body
}

function validate(values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!values.name) errors.name = "Nhập họ và tên"
  if (!values.phone) errors.phone = "Nhập số điện thoại"
  if (!values.branchId) errors.branchId = "Chọn chi nhánh"
  return errors
}

export function LeadFormSheet({
  open,
  onOpenChange,
  lead,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  lead?: Lead
  onSaved?: (lead: Lead) => void
}) {
  const isEdit = Boolean(lead)
  const queryClient = useQueryClient()
  const { branches, defaultBranchId, showBranchSelect } = useBranchChoice()
  const courses = useCourses()
  const staff = useStaffOptions()

  const [values, setValues] = useState<FormValues>(() =>
    initialValues(lead, defaultBranchId)
  )
  // Mốc so sánh khi sửa: chụp lúc mở sheet, không theo `lead` refetch giữa chừng
  const [baseline, setBaseline] = useState<FormValues>(() =>
    initialValues(lead, defaultBranchId)
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [wasOpen, setWasOpen] = useState(open)

  // Mỗi lần mở lại: điền lại từ khách hiện tại (sửa) hoặc để trống (thêm)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      const initial = initialValues(lead, defaultBranchId)
      setValues(initial)
      setBaseline(initial)
      setErrors({})
    }
  }

  const mutation = useMutation({
    mutationFn: (body: Record<string, string | null>) =>
      lead
        ? apiData<Lead>(`/leads/${lead.id}`, { method: "PATCH", body })
        : apiData<Lead>("/leads", { method: "POST", body }),
    meta: { silent: true },
    onSuccess: (saved, body) => {
      void queryClient.invalidateQueries({ queryKey: ["leads"] })
      if (lead) {
        // Đổi chi nhánh: backend chuyển lịch hẹn sang chi nhánh mới
        if ("branchId" in body) {
          void queryClient.invalidateQueries({ queryKey: ["appointments"] })
          void queryClient.invalidateQueries({ queryKey: ["calendar"] })
        }
        queryClient.setQueryData(["lead", saved.id], saved)
        void queryClient.invalidateQueries({
          queryKey: ["lead-activities", saved.id],
        })
        toast.success("Đã lưu thông tin khách")
      } else {
        toast.success(`Đã thêm khách ${saved.code}`)
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
    const nextErrors = validate(clean)
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
  const courseItems = [
    { value: NONE, label: "Chưa chọn" },
    ...(courses.data ?? []).map((course) => ({
      value: course.id,
      label: `${course.code} · ${course.name}`,
    })),
  ]
  const sourceItems = LEAD_SOURCES.map((source) => ({
    value: source,
    label: LEAD_SOURCE_LABELS[source],
  }))
  const assigneeItems = [
    { value: NONE, label: "Chưa phân công" },
    ...(staff.data ?? [])
      .filter((option) => option.branchIds.includes(values.branchId))
      .map((option) => ({ value: option.id, label: option.name })),
  ]

  return (
    <EntitySheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Sửa thông tin khách" : "Thêm khách"}
      description={
        isEdit ? lead?.code : "Khách hàng mới nhận qua điện thoại, văn phòng…"
      }
      submitLabel={isEdit ? "Lưu" : "Thêm khách"}
      submitting={mutation.isPending}
      onSubmit={onSubmit}
    >
      <FormField id="lead-name" label="Họ và tên" required error={errors.name}>
        <Input
          autoComplete="off"
          value={values.name}
          onChange={(event) => update("name", event.target.value)}
        />
      </FormField>
      <FormField
        id="lead-phone"
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
      {showBranchSelect || errors.branchId ? (
        <FormField
          id="lead-branch"
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
                update("assigneeId", "")
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
      <FormField id="lead-course" label="Gói học" error={errors.courseId}>
        {(control) => (
          <Select
            items={courseItems}
            value={values.courseId || NONE}
            onValueChange={(value) =>
              update("courseId", !value || value === NONE ? "" : value)
            }
          >
            <SelectTrigger {...control} className="w-full">
              <SelectValue />
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
      <FormField id="lead-email" label="Email" error={errors.email}>
        <Input
          type="email"
          autoComplete="off"
          value={values.email}
          onChange={(event) => update("email", event.target.value)}
        />
      </FormField>
      <FormField
        id="lead-contact-time"
        label="Giờ liên hệ"
        error={errors.preferredContactTime}
      >
        <Input
          placeholder="VD: sau 17h, cuối tuần"
          value={values.preferredContactTime}
          onChange={(event) =>
            update("preferredContactTime", event.target.value)
          }
        />
      </FormField>
      <FormField id="lead-source" label="Nguồn" error={errors.source}>
        {(control) => (
          <Select
            items={sourceItems}
            value={values.source}
            onValueChange={(value) => {
              if (value) update("source", value)
            }}
          >
            <SelectTrigger {...control} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sourceItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
      {isEdit ? null : (
        <FormField
          id="lead-assignee"
          label="Phụ trách"
          error={errors.assigneeId}
        >
          {(control) => (
            <Select
              items={assigneeItems}
              value={values.assigneeId || NONE}
              onValueChange={(value) =>
                update("assigneeId", !value || value === NONE ? "" : value)
              }
            >
              <SelectTrigger {...control} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {assigneeItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
      )}
      <FormField
        id="lead-follow-up"
        label="Hẹn gọi lại"
        error={errors.nextFollowUpAt}
      >
        <Input
          type="datetime-local"
          value={values.nextFollowUpAt}
          onChange={(event) => update("nextFollowUpAt", event.target.value)}
        />
      </FormField>
      <FormField id="lead-note" label="Ghi chú" error={errors.note}>
        <Textarea
          rows={3}
          value={values.note}
          onChange={(event) => update("note", event.target.value)}
        />
      </FormField>
    </EntitySheet>
  )
}
