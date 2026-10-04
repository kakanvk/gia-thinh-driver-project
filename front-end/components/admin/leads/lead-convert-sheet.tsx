"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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
import { useCourses } from "@/lib/admin/lookups"
import type { Lead, Page } from "@/lib/admin/types"
import { useCan } from "@/lib/admin/use-can"
import { apiData, apiFetch } from "@/lib/api/client"
import { ApiError, errorMessage, fieldErrors } from "@/lib/api/errors"

// Giá trị "không chọn" cho Select (Base UI không có item rỗng)
const NONE = "none"

type ClassOption = { id: string; code: string; status: string }
type ConvertResult = { lead: Lead; student: { id: string; code: string } }

type FormValues = {
  courseId: string
  classId: string
  email: string
  dob: string
  idNumber: string
  address: string
  enrolledAt: string
  note: string
}

function initialValues(lead: Lead): FormValues {
  return {
    courseId: lead.courseId ?? "",
    classId: "",
    email: lead.email ?? "",
    dob: "",
    idNumber: "",
    address: "",
    enrolledAt: todayVn(),
    note: "",
  }
}

export function LeadConvertSheet({
  open,
  onOpenChange,
  lead,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  lead: Lead
}) {
  const queryClient = useQueryClient()
  // Tư vấn viên có student.create nhưng không có class.read: bỏ ô chọn lớp
  const canReadClasses = useCan("class.read")
  const courses = useCourses()
  const [values, setValues] = useState<FormValues>(() => initialValues(lead))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [wasOpen, setWasOpen] = useState(open)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setValues(initialValues(lead))
      setErrors({})
    }
  }

  const classQuery = {
    branchId: lead.branchId,
    courseId: values.courseId,
    limit: 100,
  }
  const classes = useQuery({
    queryKey: ["classes", classQuery],
    queryFn: ({ signal }) =>
      apiFetch<Page<ClassOption>>("/classes", { query: classQuery, signal }),
    enabled: open && canReadClasses && Boolean(values.courseId),
  })

  const mutation = useMutation({
    mutationFn: (body: Record<string, string>) =>
      apiData<ConvertResult>(`/leads/${lead.id}/convert`, {
        method: "POST",
        body,
      }),
    meta: { silent: true },
    onSuccess: (result) => {
      queryClient.setQueryData(["lead", result.lead.id], result.lead)
      void queryClient.invalidateQueries({ queryKey: ["lead", lead.id] })
      void queryClient.invalidateQueries({ queryKey: ["leads"] })
      void queryClient.invalidateQueries({
        queryKey: ["lead-activities", lead.id],
      })
      toast.success(`Đã tạo học viên ${result.student.code}`)
      onOpenChange(false)
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
    const clean = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, value.trim()])
    ) as FormValues
    const nextErrors: Record<string, string> = {}
    if (!clean.courseId) nextErrors.courseId = "Chọn gói học"
    if (clean.idNumber && !/^\d{12}$/.test(clean.idNumber))
      nextErrors.idNumber = "CCCD gồm 12 chữ số"
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    const body = Object.fromEntries(
      Object.entries(clean).filter(([, value]) => value)
    )
    mutation.mutate(body)
  }

  const courseItems = (courses.data ?? []).map((course) => ({
    value: course.id,
    label: `${course.code} · ${course.name}`,
  }))
  const classItems = [
    { value: NONE, label: "Chưa xếp lớp" },
    ...(classes.data?.data ?? [])
      .filter((item) => item.status !== "finished")
      .map((item) => ({ value: item.id, label: item.code })),
  ]

  return (
    <EntitySheet
      open={open}
      onOpenChange={onOpenChange}
      title="Chuyển thành học viên"
      description={`${lead.name} · ${lead.phone}`}
      submitLabel="Chuyển thành học viên"
      submitting={mutation.isPending}
      onSubmit={onSubmit}
    >
      <FormField id="convert-course" label="Gói học" required error={errors.courseId}>
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
              <SelectValue placeholder="Chọn gói học" />
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
      {canReadClasses ? (
        <FormField id="convert-class" label="Lớp" error={errors.classId}>
          {(control) => (
            <Select
              items={classItems}
              value={values.classId || NONE}
              disabled={!values.courseId}
              onValueChange={(value) =>
                update("classId", !value || value === NONE ? "" : value)
              }
            >
              <SelectTrigger {...control} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {classItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
      ) : null}
      <FormField id="convert-email" label="Email" error={errors.email}>
        <Input
          type="email"
          autoComplete="off"
          value={values.email}
          onChange={(event) => update("email", event.target.value)}
        />
      </FormField>
      <FormField id="convert-dob" label="Ngày sinh" error={errors.dob}>
        <Input
          type="date"
          value={values.dob}
          onChange={(event) => update("dob", event.target.value)}
        />
      </FormField>
      <FormField id="convert-id-number" label="CCCD" error={errors.idNumber}>
        <Input
          inputMode="numeric"
          autoComplete="off"
          maxLength={12}
          value={values.idNumber}
          onChange={(event) => update("idNumber", event.target.value)}
        />
      </FormField>
      <FormField id="convert-address" label="Địa chỉ" error={errors.address}>
        <Input
          value={values.address}
          onChange={(event) => update("address", event.target.value)}
        />
      </FormField>
      <FormField
        id="convert-enrolled-at"
        label="Ngày nhập học"
        error={errors.enrolledAt}
      >
        <Input
          type="date"
          value={values.enrolledAt}
          onChange={(event) => update("enrolledAt", event.target.value)}
        />
      </FormField>
      <FormField id="convert-note" label="Ghi chú" error={errors.note}>
        <Textarea
          rows={3}
          value={values.note}
          onChange={(event) => update("note", event.target.value)}
        />
      </FormField>
    </EntitySheet>
  )
}
