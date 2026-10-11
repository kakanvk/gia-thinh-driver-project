"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { StatusPill } from "@/components/admin/admin-ui"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { EntitySheet } from "@/components/admin/entity-sheet"
import { FormField } from "@/components/admin/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { formatDate } from "@/lib/admin/datetime"
import {
  TRANSMISSION_LABELS,
  TRANSMISSIONS,
  VEHICLE_STATUS_LABELS,
  VEHICLE_STATUSES,
} from "@/lib/admin/labels"
import { nameById, useBranchChoice, useCourses } from "@/lib/admin/lookups"
import { transmissionLabel } from "@/lib/admin/training"
import type { Transmission, Vehicle, VehicleStatus } from "@/lib/admin/types"
import { useCan } from "@/lib/admin/use-can"
import { apiData, apiFetch } from "@/lib/api/client"
import { ApiError, errorMessage, fieldErrors } from "@/lib/api/errors"

// Giống vehicles.validation.ts: normalizePlate + PLATE, km 0–5.000.000
const PLATE = /^\d{2}[A-Z][A-Z0-9]?-(\d{3}\.\d{2}|\d{4,5})$/
const MAX_KM = 5_000_000
// Giá trị mục "Không" của ô Số (Base UI không có item rỗng)
const NO_TRANSMISSION = "none"

const DATE_FIELDS = [
  "lastServiceAt",
  "nextServiceAt",
  "registrationExpiresAt",
] as const

type FormValues = {
  plate: string
  model: string
  courseCode: string
  branchId: string
  transmission: Transmission | ""
  odometer: string
  datKm: string
  lastServiceAt: string
  nextServiceAt: string
  registrationExpiresAt: string
  status: VehicleStatus
  note: string
}

type Body = Record<string, string | number | null>

export function normalizePlate(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "")
}

// Ngày (date-only) từ API là ISO kèm +07:00: cắt yyyy-MM-dd
function dateOnly(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : ""
}

function initialValues(
  vehicle: Vehicle | undefined,
  defaultBranchId: string
): FormValues {
  return {
    plate: vehicle?.plate ?? "",
    model: vehicle?.model ?? "",
    courseCode: vehicle?.courseCode ?? "",
    branchId: vehicle?.branchId ?? defaultBranchId,
    transmission: vehicle?.transmission ?? "",
    odometer: vehicle ? String(vehicle.odometer) : "",
    datKm: vehicle ? String(vehicle.datKm) : "",
    lastServiceAt: dateOnly(vehicle?.lastServiceAt),
    nextServiceAt: dateOnly(vehicle?.nextServiceAt),
    registrationExpiresAt: dateOnly(vehicle?.registrationExpiresAt),
    status: vehicle?.status ?? "active",
    note: vehicle?.note ?? "",
  }
}

function clean(values: FormValues): FormValues {
  return {
    ...values,
    plate: normalizePlate(values.plate),
    model: values.model.trim(),
    odometer: values.odometer.trim(),
    datKm: values.datKm.trim(),
    note: values.note.trim(),
  }
}

function kmError(value: string, label: string): string | undefined {
  if (!value) return undefined
  if (!/^\d+$/.test(value) || Number(value) > MAX_KM)
    return `${label} là số nguyên từ 0`
  return undefined
}

function validate(values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!values.plate) errors.plate = "Nhập biển số"
  else if (!PLATE.test(values.plate))
    errors.plate = "Biển số không hợp lệ (vd 64A-123.45)"
  if (!values.model) errors.model = "Nhập dòng xe"
  else if (values.model.length < 2) errors.model = "Dòng xe tối thiểu 2 ký tự"
  if (!values.courseCode) errors.courseCode = "Chọn hạng bằng"
  if (!values.branchId) errors.branchId = "Chọn chi nhánh"
  const odometer = kmError(values.odometer, "Số km")
  if (odometer) errors.odometer = odometer
  const datKm = kmError(values.datKm, "Km DAT")
  if (datKm) errors.datKm = datKm
  return errors
}

// Thêm: bỏ trường rỗng. Sửa: chỉ gửi trường đổi (không đổi chi nhánh);
// ngày/ghi chú/số xoá trống gửi null, số km xoá trống gửi 0.
function buildBody(
  values: FormValues,
  initial: FormValues,
  isEdit: boolean
): Body {
  if (!isEdit) {
    const body: Body = {
      plate: values.plate,
      model: values.model,
      courseCode: values.courseCode,
      branchId: values.branchId,
    }
    if (values.transmission) body.transmission = values.transmission
    if (values.odometer) body.odometer = Number(values.odometer)
    if (values.datKm) body.datKm = Number(values.datKm)
    for (const key of DATE_FIELDS) if (values[key]) body[key] = values[key]
    body.status = values.status
    if (values.note) body.note = values.note
    return body
  }
  const body: Body = {}
  if (values.plate !== initial.plate) body.plate = values.plate
  if (values.model !== initial.model) body.model = values.model
  if (values.courseCode !== initial.courseCode)
    body.courseCode = values.courseCode
  if (values.transmission !== initial.transmission)
    body.transmission = values.transmission || null
  if (Number(values.odometer) !== Number(initial.odometer))
    body.odometer = Number(values.odometer)
  if (Number(values.datKm) !== Number(initial.datKm))
    body.datKm = Number(values.datKm)
  for (const key of DATE_FIELDS)
    if (values[key] !== initial[key]) body[key] = values[key] || null
  if (values.status !== initial.status) body.status = values.status
  if (values.note !== initial.note) body.note = values.note || null
  return body
}

function SelectField<T extends string>({
  id,
  label,
  required,
  error,
  items,
  value,
  placeholder,
  onChange,
}: {
  id: string
  label: string
  required?: boolean
  error?: string
  items: { value: T; label: string }[]
  value: T | null
  placeholder?: string
  onChange: (value: T | null) => void
}) {
  return (
    <FormField id={id} label={label} required={required} error={error}>
      {(control) => (
        <Select
          items={items}
          value={value}
          onValueChange={(next) => onChange((next as T | null) ?? null)}
        >
          <SelectTrigger {...control} className="w-full">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FormField>
  )
}

function ReadOnlyVehicle({ vehicle }: { vehicle: Vehicle }) {
  const rows: [string, React.ReactNode][] = [
    ["Dòng xe", vehicle.model],
    [
      "Hạng",
      [vehicle.courseCode, transmissionLabel(vehicle.transmission)]
        .filter(Boolean)
        .join(" · "),
    ],
    ["Số km", vehicle.odometer.toLocaleString("vi-VN")],
    ["Km DAT", vehicle.datKm ? vehicle.datKm.toLocaleString("vi-VN") : "—"],
    [
      "BD gần nhất",
      vehicle.lastServiceAt ? formatDate(vehicle.lastServiceAt) : "—",
    ],
    [
      "BD kế tiếp",
      vehicle.nextServiceAt ? formatDate(vehicle.nextServiceAt) : "—",
    ],
    [
      "Hạn đăng kiểm",
      vehicle.registrationExpiresAt
        ? formatDate(vehicle.registrationExpiresAt)
        : "—",
    ],
    [
      "Trạng thái",
      <StatusPill
        key="status"
        status={VEHICLE_STATUS_LABELS[vehicle.status]}
      />,
    ],
  ]
  if (vehicle.note) rows.push(["Ghi chú", vehicle.note])

  return (
    <dl className="grid gap-3 text-[13px]">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 font-medium whitespace-pre-line">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function VehicleSheet({
  open,
  onOpenChange,
  vehicle,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  vehicle?: Vehicle
}) {
  const isEdit = Boolean(vehicle)
  const queryClient = useQueryClient()
  const canCreate = useCan("vehicle.create")
  const canUpdate = useCan("vehicle.update")
  const canDelete = useCan("vehicle.delete")
  const canEdit = isEdit ? canUpdate : canCreate
  const { branches, defaultBranchId, showBranchSelect } = useBranchChoice()
  const courses = useCourses()

  const [values, setValues] = useState<FormValues>(() =>
    initialValues(vehicle, defaultBranchId)
  )
  // Mốc so sánh khi sửa: chụp lúc mở sheet
  const [baseline, setBaseline] = useState<FormValues>(() =>
    initialValues(vehicle, defaultBranchId)
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [wasOpen, setWasOpen] = useState(open)
  const [shownId, setShownId] = useState(vehicle?.id)

  if (open !== wasOpen || vehicle?.id !== shownId) {
    setWasOpen(open)
    setShownId(vehicle?.id)
    if (open) {
      const initial = initialValues(vehicle, defaultBranchId)
      setValues(initial)
      setBaseline(initial)
      setErrors({})
    }
  }

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["vehicles"] })
    void queryClient.invalidateQueries({ queryKey: ["vehicle-alerts"] })
  }

  const mutation = useMutation({
    mutationFn: (body: Body) =>
      vehicle
        ? apiData<Vehicle>(`/vehicles/${vehicle.id}`, { method: "PATCH", body })
        : apiData<Vehicle>("/vehicles", { method: "POST", body }),
    meta: { silent: true },
    onSuccess: (saved) => {
      invalidate()
      toast.success(
        vehicle ? `Đã lưu xe ${saved.plate}` : `Đã thêm xe ${saved.plate}`
      )
      onOpenChange(false)
    },
    onError: (error) => {
      const fields = error instanceof ApiError ? fieldErrors(error.details) : {}
      setErrors(fields)
      if (Object.keys(fields).length === 0) toast.error(errorMessage(error))
    },
  })

  const remove = useMutation({
    mutationFn: () =>
      apiFetch<void>(`/vehicles/${vehicle!.id}`, { method: "DELETE" }),
    meta: { silent: true },
    onSuccess: () => {
      invalidate()
      toast.success(`Đã xoá xe ${vehicle!.plate}`)
      setDeleteOpen(false)
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(errorMessage(error))
      setDeleteOpen(false)
    },
  })

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = clean(values)
    const nextErrors = validate(next)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    const body = buildBody(next, clean(baseline), isEdit)
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
    value: course.code,
    label: course.code,
  }))
  // Hạng hiện tại không còn trong danh sách gói (vd. gói đã xoá)
  if (
    values.courseCode &&
    !courseItems.some((item) => item.value === values.courseCode)
  ) {
    courseItems.push({ value: values.courseCode, label: values.courseCode })
  }
  const transmissionItems = [
    { value: NO_TRANSMISSION, label: "Không" },
    ...TRANSMISSIONS.map((value) => ({
      value,
      label: TRANSMISSION_LABELS[value],
    })),
  ]
  const statusItems = VEHICLE_STATUSES.map((value) => ({
    value,
    label: VEHICLE_STATUS_LABELS[value],
  }))

  const deleteButton =
    vehicle && canDelete ? (
      <Button
        type="button"
        variant="ghost"
        className="mr-auto text-destructive hover:text-destructive"
        disabled={mutation.isPending}
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 aria-hidden="true" />
        Xoá
      </Button>
    ) : null

  return (
    <>
      <EntitySheet
        open={open}
        onOpenChange={onOpenChange}
        title={vehicle ? vehicle.plate : "Thêm xe"}
        description={
          vehicle
            ? nameById(branches, vehicle.branchId, undefined)
            : "Thông tin xe, số km và các mốc bảo dưỡng, đăng kiểm"
        }
        submitLabel={isEdit ? "Lưu" : "Thêm xe"}
        submitting={mutation.isPending}
        onSubmit={canEdit ? onSubmit : undefined}
        footer={deleteButton}
      >
        {canEdit ? (
          <>
            <div className="flex flex-col gap-1">
              <FormField
                id="vehicle-plate"
                label="Biển số"
                required
                error={errors.plate}
              >
                <Input
                  autoComplete="off"
                  maxLength={20}
                  placeholder="64A-123.45"
                  value={values.plate}
                  onChange={(event) =>
                    update("plate", event.target.value.toUpperCase())
                  }
                />
              </FormField>
              {errors.plate ? null : (
                <p className="text-xs text-muted-foreground">
                  Định dạng 64A-123.45 (ô tô) hoặc 64B1-234.56 (xe máy)
                </p>
              )}
            </div>
            <FormField
              id="vehicle-model"
              label="Dòng xe"
              required
              error={errors.model}
            >
              <Input
                autoComplete="off"
                maxLength={100}
                value={values.model}
                onChange={(event) => update("model", event.target.value)}
              />
            </FormField>
            <SelectField
              id="vehicle-course"
              label="Hạng"
              required
              error={errors.courseCode}
              items={courseItems}
              value={values.courseCode || null}
              placeholder="Chọn hạng"
              onChange={(value) => update("courseCode", value ?? "")}
            />
            {!isEdit && (showBranchSelect || errors.branchId) ? (
              <SelectField
                id="vehicle-branch"
                label="Chi nhánh"
                required
                error={errors.branchId}
                items={branchItems}
                value={values.branchId || null}
                placeholder="Chọn chi nhánh"
                onChange={(value) => update("branchId", value ?? "")}
              />
            ) : null}
            <SelectField
              id="vehicle-transmission"
              label="Số"
              error={errors.transmission}
              items={transmissionItems}
              value={values.transmission || NO_TRANSMISSION}
              onChange={(value) =>
                update(
                  "transmission",
                  !value || value === NO_TRANSMISSION
                    ? ""
                    : (value as Transmission)
                )
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                id="vehicle-odometer"
                label="Số km"
                error={errors.odometer}
              >
                <Input
                  inputMode="numeric"
                  autoComplete="off"
                  value={values.odometer}
                  onChange={(event) => update("odometer", event.target.value)}
                />
              </FormField>
              <FormField id="vehicle-dat" label="Km DAT" error={errors.datKm}>
                <Input
                  inputMode="numeric"
                  autoComplete="off"
                  value={values.datKm}
                  onChange={(event) => update("datKm", event.target.value)}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                id="vehicle-last-service"
                label="BD gần nhất"
                error={errors.lastServiceAt}
              >
                <Input
                  type="date"
                  value={values.lastServiceAt}
                  onChange={(event) =>
                    update("lastServiceAt", event.target.value)
                  }
                />
              </FormField>
              <FormField
                id="vehicle-next-service"
                label="BD kế tiếp"
                error={errors.nextServiceAt}
              >
                <Input
                  type="date"
                  value={values.nextServiceAt}
                  onChange={(event) =>
                    update("nextServiceAt", event.target.value)
                  }
                />
              </FormField>
            </div>
            <FormField
              id="vehicle-registration"
              label="Hạn đăng kiểm"
              error={errors.registrationExpiresAt}
            >
              <Input
                type="date"
                value={values.registrationExpiresAt}
                onChange={(event) =>
                  update("registrationExpiresAt", event.target.value)
                }
              />
            </FormField>
            <SelectField
              id="vehicle-status"
              label="Trạng thái"
              error={errors.status}
              items={statusItems}
              value={values.status}
              onChange={(value) => update("status", value ?? "active")}
            />
            <FormField id="vehicle-note" label="Ghi chú" error={errors.note}>
              <Textarea
                rows={3}
                maxLength={500}
                value={values.note}
                onChange={(event) => update("note", event.target.value)}
              />
            </FormField>
          </>
        ) : vehicle ? (
          <ReadOnlyVehicle vehicle={vehicle} />
        ) : null}
      </EntitySheet>

      {vehicle && canDelete ? (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={`Xoá xe ${vehicle.plate}?`}
          description="Xe sẽ bị ẩn khỏi danh sách và cảnh báo hạn. Biển số có thể dùng lại cho xe mới."
          confirmLabel="Xoá xe"
          destructive
          pending={remove.isPending}
          onConfirm={() => remove.mutate()}
        />
      ) : null}
    </>
  )
}
