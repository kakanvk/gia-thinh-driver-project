"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Trash2, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { StatusPill } from "@/components/admin/admin-ui"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { EntitySheet } from "@/components/admin/entity-sheet"
import { FormField } from "@/components/admin/form-field"
import { Badge } from "@/components/ui/badge"
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
import {
  INSTRUCTOR_STATUS_LABELS,
  INSTRUCTOR_STATUSES,
} from "@/lib/admin/labels"
import { nameById, useBranchChoice, useStaffOptions } from "@/lib/admin/lookups"
import { formatPassRate } from "@/lib/admin/training"
import type {
  Instructor,
  InstructorStats,
  InstructorStatus,
} from "@/lib/admin/types"
import { useCan } from "@/lib/admin/use-can"
import { apiData, apiFetch } from "@/lib/api/client"
import { ApiError, errorMessage, fieldErrors } from "@/lib/api/errors"

// Giống specialtiesSchema của instructors.validation.ts
const MAX_SPECIALTIES = 10
const MAX_SPECIALTY_LENGTH = 20
// Giá trị của mục "Không liên kết" trong ô Tài khoản liên kết
const NO_ACCOUNT = "none"

type FormValues = {
  name: string
  phone: string
  branchId: string
  specialties: string[]
  userId: string
  status: InstructorStatus
  note: string
}

type Body = Record<string, string | string[] | null>

function initialValues(
  instructor: Instructor | undefined,
  defaultBranchId: string
): FormValues {
  return {
    name: instructor?.name ?? "",
    phone: instructor?.phone ?? "",
    branchId: instructor?.branchId ?? defaultBranchId,
    specialties: instructor?.specialties ?? [],
    userId: instructor?.userId ?? "",
    status: instructor?.status ?? "active",
    note: instructor?.note ?? "",
  }
}

function clean(values: FormValues): FormValues {
  return {
    ...values,
    name: values.name.trim(),
    phone: values.phone.trim(),
    note: values.note.trim(),
  }
}

// Thêm: bỏ trường rỗng. Sửa: chỉ gửi trường đổi (không đổi chi nhánh),
// tài khoản/ghi chú xoá trống gửi null.
function buildBody(
  values: FormValues,
  initial: FormValues,
  isEdit: boolean
): Body {
  if (!isEdit) {
    const body: Body = {
      name: values.name,
      phone: values.phone,
      branchId: values.branchId,
    }
    if (values.specialties.length > 0) body.specialties = values.specialties
    if (values.userId) body.userId = values.userId
    body.status = values.status
    if (values.note) body.note = values.note
    return body
  }
  const body: Body = {}
  if (values.name !== initial.name) body.name = values.name
  if (values.phone !== initial.phone) body.phone = values.phone
  if (values.specialties.join(",") !== initial.specialties.join(","))
    body.specialties = values.specialties
  if (values.userId !== initial.userId) body.userId = values.userId || null
  if (values.status !== initial.status) body.status = values.status
  if (values.note !== initial.note) body.note = values.note || null
  return body
}

function validate(values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!values.name) errors.name = "Nhập họ và tên"
  else if (values.name.length < 2) errors.name = "Họ và tên tối thiểu 2 ký tự"
  if (!values.phone) errors.phone = "Nhập số điện thoại"
  if (!values.branchId) errors.branchId = "Chọn chi nhánh"
  return errors
}

// "Nguyễn Hoàng Đức" → "HĐ"
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return words
    .slice(-2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("")
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border/70 px-3 py-2">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="text-base font-semibold text-navy tabular-nums">
        {value}
      </dd>
    </div>
  )
}

function InstructorStatsPanel({ id }: { id: string }) {
  const stats = useQuery({
    queryKey: ["instructor-stats", id],
    queryFn: ({ signal }) =>
      apiData<InstructorStats>(`/instructors/${id}/stats`, { signal }),
  })

  if (stats.isPending) {
    return <div className="h-32 animate-pulse rounded-lg bg-muted" />
  }
  if (stats.isError) {
    return (
      <p className="text-[13px] text-muted-foreground">
        Không tải được thống kê.{" "}
        <button
          type="button"
          className="font-medium text-primary hover:underline"
          onClick={() => void stats.refetch()}
        >
          Thử lại
        </button>
      </p>
    )
  }

  const { classes, students, official } = stats.data
  return (
    <section aria-label="Thống kê giáo viên">
      <dl className="grid grid-cols-2 gap-2">
        <Stat label="Lớp" value={`${classes.total}/${classes.active}`} />
        <Stat label="Học viên" value={students} />
        <Stat
          label="Sát hạch"
          value={`${official.passed}/${official.failed}/${official.absent}`}
        />
        <Stat label="Tỷ lệ đậu" value={formatPassRate(official.passRate)} />
      </dl>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Lớp: tổng/đang dạy · Sát hạch: đậu/trượt/vắng · Tỷ lệ đậu tính trên thí
        sinh đậu + trượt.
      </p>
    </section>
  )
}

function SpecialtiesInput({
  control,
  value,
  onChange,
}: {
  control: React.ComponentProps<"input">
  value: string[]
  onChange: (value: string[]) => void
}) {
  const [draft, setDraft] = useState("")

  function commit() {
    const code = draft.trim().toUpperCase()
    setDraft("")
    if (!code || value.includes(code) || value.length >= MAX_SPECIALTIES) return
    onChange([...value, code])
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((code) => (
            <Badge key={code} variant="secondary" className="pr-1">
              {code}
              <button
                type="button"
                aria-label={`Bỏ hạng ${code}`}
                className="grid size-4 place-items-center rounded-full hover:bg-muted"
                onClick={() => onChange(value.filter((item) => item !== code))}
              >
                <X aria-hidden="true" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
      <Input
        {...control}
        autoComplete="off"
        maxLength={MAX_SPECIALTY_LENGTH}
        placeholder={
          value.length >= MAX_SPECIALTIES
            ? `Tối đa ${MAX_SPECIALTIES} hạng`
            : "Nhập hạng (VD: B, C1) rồi nhấn Enter"
        }
        disabled={value.length >= MAX_SPECIALTIES}
        value={draft}
        onChange={(event) => setDraft(event.target.value.toUpperCase())}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault()
            commit()
          }
        }}
        onBlur={commit}
      />
    </div>
  )
}

export function InstructorSheet({
  open,
  onOpenChange,
  instructor,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  instructor?: Instructor
}) {
  const isEdit = Boolean(instructor)
  const queryClient = useQueryClient()
  const canCreate = useCan("instructor.create")
  const canUpdate = useCan("instructor.update")
  const canDelete = useCan("instructor.delete")
  const canEdit = isEdit ? canUpdate : canCreate
  const { branches, defaultBranchId, showBranchSelect } = useBranchChoice()

  const [values, setValues] = useState<FormValues>(() =>
    initialValues(instructor, defaultBranchId)
  )
  // Mốc so sánh khi sửa: chụp lúc mở sheet
  const [baseline, setBaseline] = useState<FormValues>(() =>
    initialValues(instructor, defaultBranchId)
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [wasOpen, setWasOpen] = useState(open)
  const [shownId, setShownId] = useState(instructor?.id)

  if (open !== wasOpen || instructor?.id !== shownId) {
    setWasOpen(open)
    setShownId(instructor?.id)
    if (open) {
      const initial = initialValues(instructor, defaultBranchId)
      setValues(initial)
      setBaseline(initial)
      setErrors({})
    }
  }

  // Tài khoản giáo viên cùng chi nhánh để liên kết (cần instructor.create/update)
  const accounts = useStaffOptions(values.branchId, "instructor", {
    enabled: open && canEdit && Boolean(values.branchId),
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["instructors"] })
    // Tên giáo viên hiển thị ở danh sách/chi tiết lớp
    void queryClient.invalidateQueries({ queryKey: ["classes"] })
    void queryClient.invalidateQueries({ queryKey: ["class"] })
  }

  const mutation = useMutation({
    mutationFn: (body: Body) =>
      instructor
        ? apiData<Instructor>(`/instructors/${instructor.id}`, {
            method: "PATCH",
            body,
          })
        : apiData<Instructor>("/instructors", { method: "POST", body }),
    meta: { silent: true },
    onSuccess: (saved) => {
      invalidate()
      toast.success(
        instructor
          ? `Đã lưu giáo viên ${saved.name}`
          : `Đã thêm giáo viên ${saved.name}`
      )
      onOpenChange(false)
    },
    onError: (error, body) => {
      const fields = error instanceof ApiError ? fieldErrors(error.details) : {}
      // 409 không kèm trường: còn lớp đang dạy (khi chuyển Nghỉ việc) hoặc
      // tài khoản đã gắn với hồ sơ khác — hiện dưới ô tương ứng
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        Object.keys(fields).length === 0
      ) {
        if (body.status === "inactive" && /lớp/i.test(error.message))
          fields.status = error.message
        else if ("userId" in body) fields.userId = error.message
      }
      setErrors(fields)
      if (Object.keys(fields).length === 0) toast.error(errorMessage(error))
    },
  })

  const remove = useMutation({
    mutationFn: () =>
      apiFetch<void>(`/instructors/${instructor!.id}`, { method: "DELETE" }),
    meta: { silent: true },
    onSuccess: () => {
      invalidate()
      void queryClient.cancelQueries({
        queryKey: ["instructor-stats", instructor!.id],
      })
      toast.success(`Đã xoá giáo viên ${instructor!.name}`)
      setDeleteOpen(false)
      onOpenChange(false)
    },
    onError: (error) => {
      // 409 còn lớp đang dạy: báo một lần, giữ sheet
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
  const accountItems = [
    { value: NO_ACCOUNT, label: "Không liên kết" },
    ...(accounts.data ?? []).map((user) => ({
      value: user.id,
      label: user.name,
    })),
  ]
  // Tài khoản đang gắn nhưng không còn trong danh sách (vd. đã khoá)
  if (
    values.userId &&
    !accountItems.some((item) => item.value === values.userId)
  ) {
    accountItems.push({ value: values.userId, label: "Tài khoản đã liên kết" })
  }
  const statusItems = INSTRUCTOR_STATUSES.map((value) => ({
    value,
    label: INSTRUCTOR_STATUS_LABELS[value],
  }))

  const title = isEdit ? (instructor?.name ?? "") : "Thêm giáo viên"
  const deleteButton =
    instructor && canDelete ? (
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
        title={title}
        description={
          isEdit
            ? nameById(branches, instructor?.branchId, undefined)
            : "Hồ sơ giáo viên, chuyên môn và tài khoản đăng nhập"
        }
        submitLabel={isEdit ? "Lưu" : "Thêm giáo viên"}
        submitting={mutation.isPending}
        onSubmit={canEdit ? onSubmit : undefined}
        footer={deleteButton}
      >
        {instructor ? <InstructorStatsPanel id={instructor.id} /> : null}

        {canEdit ? (
          <>
            <FormField
              id="instructor-name"
              label="Họ và tên"
              required
              error={errors.name}
            >
              <Input
                autoComplete="off"
                maxLength={100}
                value={values.name}
                onChange={(event) => update("name", event.target.value)}
              />
            </FormField>
            <FormField
              id="instructor-phone"
              label="Số điện thoại"
              required
              error={errors.phone}
            >
              <Input
                type="tel"
                autoComplete="off"
                inputMode="tel"
                value={values.phone}
                onChange={(event) => update("phone", event.target.value)}
              />
            </FormField>
            {!isEdit && (showBranchSelect || errors.branchId) ? (
              <FormField
                id="instructor-branch"
                label="Chi nhánh"
                required
                error={errors.branchId}
              >
                {(control) => (
                  <Select
                    items={branchItems}
                    value={values.branchId || null}
                    onValueChange={(value) =>
                      // Tài khoản liên kết phải cùng chi nhánh: chọn lại
                      setValues((current) => ({
                        ...current,
                        branchId: value ?? "",
                        userId: "",
                      }))
                    }
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
              id="instructor-specialties"
              label="Chuyên môn"
              error={errors.specialties}
            >
              {(control) => (
                <SpecialtiesInput
                  control={control}
                  value={values.specialties}
                  onChange={(specialties) => update("specialties", specialties)}
                />
              )}
            </FormField>
            <FormField
              id="instructor-user"
              label="Tài khoản liên kết"
              error={errors.userId}
            >
              {(control) => (
                <Select
                  items={accountItems}
                  value={values.userId || NO_ACCOUNT}
                  disabled={!values.branchId}
                  onValueChange={(value) =>
                    update(
                      "userId",
                      !value || value === NO_ACCOUNT ? "" : value
                    )
                  }
                >
                  <SelectTrigger {...control} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accountItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <FormField
              id="instructor-status"
              label="Trạng thái"
              error={errors.status}
            >
              {(control) => (
                <Select
                  items={statusItems}
                  value={values.status}
                  onValueChange={(value) =>
                    update("status", (value as InstructorStatus) ?? "active")
                  }
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
            <FormField id="instructor-note" label="Ghi chú" error={errors.note}>
              <Textarea
                rows={3}
                maxLength={500}
                value={values.note}
                onChange={(event) => update("note", event.target.value)}
              />
            </FormField>
          </>
        ) : instructor ? (
          <dl className="grid gap-3 text-[13px]">
            <div>
              <dt className="text-muted-foreground">Số điện thoại</dt>
              <dd className="font-medium">{instructor.phone}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Chuyên môn</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {instructor.specialties.length > 0
                  ? instructor.specialties.map((code) => (
                      <Badge key={code} variant="secondary">
                        {code}
                      </Badge>
                    ))
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Trạng thái</dt>
              <dd className="mt-1">
                <StatusPill
                  status={INSTRUCTOR_STATUS_LABELS[instructor.status]}
                />
              </dd>
            </div>
            {instructor.note ? (
              <div>
                <dt className="text-muted-foreground">Ghi chú</dt>
                <dd className="whitespace-pre-line">{instructor.note}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </EntitySheet>

      {instructor && canDelete ? (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={`Xoá giáo viên ${instructor.name}?`}
          description="Chỉ xoá được khi giáo viên không còn phụ trách lớp đang hoạt động. Tài khoản liên kết sẽ được gỡ."
          confirmLabel="Xoá giáo viên"
          destructive
          pending={remove.isPending}
          onConfirm={() => remove.mutate()}
        />
      ) : null}
    </>
  )
}
