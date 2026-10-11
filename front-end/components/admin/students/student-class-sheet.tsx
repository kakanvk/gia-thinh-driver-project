"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { EntitySheet } from "@/components/admin/entity-sheet"
import { FormField } from "@/components/admin/form-field"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useClassOptions } from "@/lib/admin/lookups"
import type { Student } from "@/lib/admin/types"
import { apiData } from "@/lib/api/client"
import { ApiError, errorMessage, fieldErrors } from "@/lib/api/errors"

// Xếp lớp / đổi lớp / bỏ lớp cho một học viên: PATCH /students/:id/class
export function StudentClassSheet({
  open,
  onOpenChange,
  student,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  student: Student
}) {
  const queryClient = useQueryClient()
  // Luôn bắt đầu trống: lớp hiện tại có thể đã kết thúc (không còn trong danh sách)
  const [classId, setClassId] = useState("")
  const [fieldError, setFieldError] = useState("")
  const [formError, setFormError] = useState("")
  const [wasOpen, setWasOpen] = useState(open)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setClassId("")
      setFieldError("")
      setFormError("")
    }
  }

  // Lớp cùng chi nhánh + gói, bỏ lớp đã kết thúc (useClassOptions lọc sẵn)
  const classes = useClassOptions({
    branchId: student.branchId,
    courseId: student.courseId,
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: (target: string | null) =>
      apiData<Student>(`/students/${student.id}/class`, {
        method: "PATCH",
        body: { classId: target },
      }),
    meta: { silent: true },
    onSuccess: (saved, target) => {
      queryClient.setQueryData(["student", saved.id], saved)
      void queryClient.invalidateQueries({ queryKey: ["students"] })
      // Sĩ số lớp cũ và lớp mới đều đổi
      void queryClient.invalidateQueries({ queryKey: ["classes"] })
      void queryClient.invalidateQueries({ queryKey: ["class"] })
      void queryClient.invalidateQueries({ queryKey: ["class-students"] })
      if (target) {
        const code = classes.data?.find((cls) => cls.id === target)?.code
        toast.success(code ? `Đã xếp vào lớp ${code}` : "Đã xếp lớp")
      } else {
        toast.success("Đã bỏ học viên khỏi lớp")
      }
      onOpenChange(false)
    },
    onError: (error) => {
      const fields = error instanceof ApiError ? fieldErrors(error.details) : {}
      if (fields.classId) {
        setFieldError(fields.classId)
        setFormError(error instanceof ApiError ? error.message : "")
      } else {
        setFormError(errorMessage(error))
      }
    },
  })

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError("")
    if (!classId) {
      setFieldError("Chọn lớp cần xếp")
      return
    }
    setFieldError("")
    if (classId === student.classId) {
      onOpenChange(false)
      return
    }
    mutation.mutate(classId)
  }

  const items = (classes.data ?? []).map((cls) => {
    const current = cls.id === student.classId
    const full = cls.seatsLeft <= 0 && !current
    return {
      value: cls.id,
      label: current
        ? `${cls.code} · lớp hiện tại`
        : full
          ? `${cls.code} · Hết chỗ`
          : `${cls.code} · còn ${cls.seatsLeft} chỗ`,
      disabled: full,
    }
  })

  return (
    <EntitySheet
      open={open}
      onOpenChange={onOpenChange}
      title={student.classId ? "Đổi lớp" : "Xếp lớp"}
      description={`${student.name} · ${student.code} · ${student.courseCode}`}
      submitLabel="Lưu"
      submitting={mutation.isPending}
      onSubmit={onSubmit}
      footer={
        student.classId ? (
          <Button
            type="button"
            variant="destructive"
            className="mr-auto"
            disabled={mutation.isPending}
            onClick={() => {
              setFormError("")
              mutation.mutate(null)
            }}
          >
            Bỏ lớp
          </Button>
        ) : null
      }
    >
      <FormField
        id="student-class-select"
        label="Lớp"
        required
        error={fieldError}
      >
        {(control) => (
          <Select
            items={items}
            value={classId || null}
            onValueChange={(value) => {
              setClassId(value ?? "")
              setFieldError("")
            }}
          >
            <SelectTrigger {...control} className="w-full">
              <SelectValue
                placeholder={classes.isPending ? "Đang tải…" : "Chọn lớp"}
              />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
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
      {classes.data && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Chưa có lớp nào cùng chi nhánh và gói học đang nhận học viên.
        </p>
      ) : null}
      {formError ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {formError}
        </p>
      ) : null}
    </EntitySheet>
  )
}
