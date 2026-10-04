"use client"

import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import {
  LeadPicker,
  type LeadSummary,
} from "@/components/admin/appointments/lead-picker"
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
import { formatDateTime, toLocalInput, toVnIso } from "@/lib/admin/datetime"
import { APPOINTMENT_TYPE_LABELS } from "@/lib/admin/labels"
import { useBranchChoice, useStaffOptions } from "@/lib/admin/lookups"
import type { Appointment, AppointmentType } from "@/lib/admin/types"
import { apiData } from "@/lib/api/client"
import { ApiError, errorMessage, fieldErrors } from "@/lib/api/errors"

// Giá trị "không chọn" cho Select (Base UI không có item rỗng)
const NONE = "none"
const DEFAULT_TIME = "08:00"
const APPOINTMENT_TYPES = Object.keys(
  APPOINTMENT_TYPE_LABELS
) as AppointmentType[]

// Lịch tháng, danh sách theo khách, chi tiết và lịch sử chăm sóc của khách
// (backend ghi hoạt động vào khách) đều đổi theo mỗi thao tác lịch hẹn.
export function invalidateAppointments(
  queryClient: QueryClient,
  appointment: Pick<Appointment, "id" | "leadId">
) {
  void queryClient.invalidateQueries({ queryKey: ["calendar"] })
  void queryClient.invalidateQueries({ queryKey: ["appointments"] })
  if (appointment.leadId) {
    void queryClient.invalidateQueries({
      queryKey: ["lead-activities", appointment.leadId],
    })
  }
}

type FormValues = {
  lead: LeadSummary | null
  branchId: string
  startAt: string
  durationMinutes: string
  type: AppointmentType
  title: string
  assigneeId: string
  note: string
}

type Body = Record<string, string | number | null>

function initialValues(
  appointment: Appointment | undefined,
  lead: LeadSummary | undefined,
  defaultDate: string | undefined,
  defaultBranchId: string
): FormValues {
  if (appointment) {
    return {
      lead: null,
      branchId: appointment.branchId,
      startAt: toLocalInput(appointment.startAt),
      durationMinutes: String(appointment.durationMinutes),
      type: appointment.type,
      title: appointment.title ?? "",
      assigneeId: appointment.assigneeId ?? "",
      note: appointment.note ?? "",
    }
  }
  return {
    lead: lead ?? null,
    branchId: lead?.branchId ?? defaultBranchId,
    startAt: defaultDate ? `${defaultDate}T${DEFAULT_TIME}` : "",
    durationMinutes: "30",
    type: "consult",
    title: "",
    assigneeId: "",
    note: "",
  }
}

function validate(values: FormValues, isEdit: boolean) {
  const errors: Record<string, string> = {}
  if (!isEdit && !values.lead && !values.branchId) {
    errors.branchId = "Chọn khách hàng hoặc chi nhánh"
  }
  if (!values.startAt) errors.startAt = "Chọn ngày giờ"
  const duration = Number(values.durationMinutes)
  if (!Number.isInteger(duration) || duration < 15 || duration > 480) {
    errors.durationMinutes = "Thời lượng từ 15 đến 480 phút"
  }
  if (values.title.trim().length > 150) {
    errors.title = "Tiêu đề tối đa 150 ký tự"
  }
  if (values.note.trim().length > 1000) {
    errors.note = "Ghi chú tối đa 1000 ký tự"
  }
  return errors
}

function createBody(values: FormValues): Body {
  const body: Body = values.lead
    ? { leadId: values.lead.id }
    : { branchId: values.branchId }
  body.startAt = toVnIso(values.startAt)
  body.durationMinutes = Number(values.durationMinutes)
  body.type = values.type
  const title = values.title.trim()
  const note = values.note.trim()
  if (title) body.title = title
  if (values.assigneeId) body.assigneeId = values.assigneeId
  if (note) body.note = note
  return body
}

// Sửa: chỉ gửi trường đổi; tiêu đề/phụ trách/ghi chú xoá trống gửi null
function updateBody(values: FormValues, initial: FormValues): Body {
  const body: Body = {}
  if (values.startAt !== initial.startAt) body.startAt = toVnIso(values.startAt)
  if (values.durationMinutes !== initial.durationMinutes) {
    body.durationMinutes = Number(values.durationMinutes)
  }
  if (values.type !== initial.type) body.type = values.type
  for (const key of ["title", "assigneeId", "note"] as const) {
    const value = values[key].trim()
    if (value !== initial[key].trim()) body[key] = value || null
  }
  return body
}

export function AppointmentFormSheet({
  open,
  onOpenChange,
  appointment,
  lead,
  defaultDate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointment?: Appointment
  lead?: LeadSummary
  defaultDate?: string
}) {
  const isEdit = Boolean(appointment)
  const queryClient = useQueryClient()
  const { branches, defaultBranchId, showBranchSelect } = useBranchChoice()
  const staff = useStaffOptions()

  const [values, setValues] = useState<FormValues>(() =>
    initialValues(appointment, lead, defaultDate, defaultBranchId)
  )
  // Mốc so sánh khi sửa: chụp lúc mở sheet
  const [baseline, setBaseline] = useState<FormValues>(values)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState("")
  const [wasOpen, setWasOpen] = useState(open)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      const initial = initialValues(
        appointment,
        lead,
        defaultDate,
        defaultBranchId
      )
      setValues(initial)
      setBaseline(initial)
      setErrors({})
      setFormError("")
    }
  }

  const mutation = useMutation({
    mutationFn: (body: Body) =>
      appointment
        ? apiData<Appointment>(`/appointments/${appointment.id}`, {
            method: "PATCH",
            body,
          })
        : apiData<Appointment>("/appointments", { method: "POST", body }),
    meta: { silent: true },
    onSuccess: (saved) => {
      queryClient.setQueryData(["appointment", saved.id], saved)
      invalidateAppointments(queryClient, saved)
      toast.success(
        isEdit
          ? "Đã lưu lịch hẹn"
          : `Đã tạo lịch hẹn ${formatDateTime(saved.startAt)}`
      )
      onOpenChange(false)
    },
    onError: (error) => {
      const fields = error instanceof ApiError ? fieldErrors(error.details) : {}
      setErrors(fields)
      if (Object.keys(fields).length > 0) return
      // Trùng giờ người phụ trách (409) hiện ngay trên form
      if (error instanceof ApiError && error.status === 409) {
        setFormError(error.message)
      } else {
        toast.error(errorMessage(error))
      }
    },
  })

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError("")
    const nextErrors = validate(values, isEdit)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    if (isEdit) {
      const body = updateBody(values, baseline)
      if (Object.keys(body).length === 0) {
        onOpenChange(false)
        return
      }
      mutation.mutate(body)
      return
    }
    mutation.mutate(createBody(values))
  }

  const branchId = values.lead?.branchId ?? values.branchId
  const branchItems = branches.map((branch) => ({
    value: branch.id,
    label: branch.name,
  }))
  const typeItems = APPOINTMENT_TYPES.map((type) => ({
    value: type,
    label: APPOINTMENT_TYPE_LABELS[type],
  }))
  const assigneeItems = [
    { value: NONE, label: "Chưa phân công" },
    ...(staff.data ?? [])
      .filter((option) => !branchId || option.branchIds.includes(branchId))
      .map((option) => ({ value: option.id, label: option.name })),
  ]
  const showBranch =
    !isEdit && !values.lead && (showBranchSelect || Boolean(errors.branchId))

  return (
    <EntitySheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Sửa lịch hẹn" : "Tạo lịch hẹn"}
      description={
        appointment
          ? formatDateTime(appointment.startAt)
          : "Hẹn tư vấn hoặc làm hồ sơ với khách"
      }
      submitLabel={isEdit ? "Lưu" : "Tạo lịch hẹn"}
      submitting={mutation.isPending}
      onSubmit={onSubmit}
    >
      {formError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </p>
      ) : null}

      {isEdit ? null : lead ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-[13px] font-medium">Khách hàng</p>
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            <span className="font-semibold">{lead.name}</span>{" "}
            <span className="text-muted-foreground">
              · {lead.phone} · {lead.code}
            </span>
          </p>
        </div>
      ) : (
        <FormField
          id="appointment-lead"
          label="Khách hàng"
          error={errors.leadId}
        >
          {(control) => (
            <LeadPicker
              {...control}
              value={values.lead}
              onChange={(next) => {
                setValues((current) => ({
                  ...current,
                  lead: next,
                  branchId: next ? next.branchId : defaultBranchId,
                  assigneeId: "",
                }))
                setErrors((current) => ({ ...current, branchId: "" }))
              }}
            />
          )}
        </FormField>
      )}

      {showBranch ? (
        <FormField
          id="appointment-branch"
          label="Chi nhánh"
          required
          error={errors.branchId}
        >
          {(control) => (
            <Select
              items={branchItems}
              value={values.branchId || null}
              onValueChange={(value) => {
                setValues((current) => ({
                  ...current,
                  branchId: value ?? "",
                  assigneeId: "",
                }))
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

      <FormField
        id="appointment-start"
        label="Ngày giờ"
        required
        error={errors.startAt}
      >
        <Input
          type="datetime-local"
          value={values.startAt}
          onChange={(event) => update("startAt", event.target.value)}
        />
      </FormField>
      <FormField
        id="appointment-duration"
        label="Thời lượng (phút)"
        error={errors.durationMinutes}
      >
        <Input
          type="number"
          inputMode="numeric"
          min={15}
          max={480}
          step={15}
          value={values.durationMinutes}
          onChange={(event) => update("durationMinutes", event.target.value)}
        />
      </FormField>
      <FormField id="appointment-type" label="Loại" error={errors.type}>
        {(control) => (
          <Select
            items={typeItems}
            value={values.type}
            onValueChange={(value) => {
              if (value) update("type", value)
            }}
          >
            <SelectTrigger {...control} className="w-full">
              <SelectValue />
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
      <FormField id="appointment-title" label="Tiêu đề" error={errors.title}>
        <Input
          autoComplete="off"
          placeholder="VD: Tư vấn gói B số tự động"
          value={values.title}
          onChange={(event) => update("title", event.target.value)}
        />
      </FormField>
      <FormField
        id="appointment-assignee"
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
      <FormField id="appointment-note" label="Ghi chú" error={errors.note}>
        <Textarea
          rows={3}
          value={values.note}
          onChange={(event) => update("note", event.target.value)}
        />
      </FormField>
    </EntitySheet>
  )
}
