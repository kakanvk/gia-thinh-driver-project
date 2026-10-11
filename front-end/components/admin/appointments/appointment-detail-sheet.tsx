"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Pencil, Trash2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"

import { StatusPill } from "@/components/admin/admin-ui"
import {
  AppointmentFormSheet,
  invalidateAppointments,
} from "@/components/admin/appointments/appointment-form-sheet"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { EntitySheet } from "@/components/admin/entity-sheet"
import { FormField } from "@/components/admin/form-field"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { formatDateTime, formatTime } from "@/lib/admin/datetime"
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_TYPE_LABELS,
} from "@/lib/admin/labels"
import { nameById, useBranches, useStaffOptions } from "@/lib/admin/lookups"
import type { Appointment, AppointmentStatus, Lead } from "@/lib/admin/types"
import { useCan } from "@/lib/admin/use-can"
import { apiData, apiFetch } from "@/lib/api/client"
import { ApiError, errorMessage, fieldErrors } from "@/lib/api/errors"

const STATUSES = Object.keys(APPOINTMENT_STATUS_LABELS) as AppointmentStatus[]

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5 py-2">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{children}</dd>
    </div>
  )
}

const empty = <span className="text-muted-foreground">—</span>

export function AppointmentDetailSheet({
  appointmentId,
  onOpenChange,
}: {
  appointmentId: string | null
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const canUpdate = useCan("appointment.update")
  const canDelete = useCan("appointment.delete")
  const branches = useBranches()
  const staff = useStaffOptions()
  const [note, setNote] = useState("")
  const [noteError, setNoteError] = useState("")
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [shownId, setShownId] = useState(appointmentId)

  // Mỗi lần mở lịch hẹn khác: xoá ghi chú đang gõ
  if (appointmentId !== shownId) {
    setShownId(appointmentId)
    setNote("")
    setNoteError("")
  }

  const detail = useQuery({
    queryKey: ["appointment", appointmentId],
    queryFn: ({ signal }) =>
      apiData<Appointment>(`/appointments/${appointmentId}`, { signal }),
    enabled: appointmentId !== null,
  })
  const appointment = detail.data
  const leadId = appointment?.leadId ?? null
  const lead = useQuery({
    queryKey: ["lead", leadId],
    queryFn: ({ signal }) => apiData<Lead>(`/leads/${leadId}`, { signal }),
    enabled: leadId !== null,
  })

  const changeStatus = useMutation({
    mutationFn: (body: { status: AppointmentStatus; note?: string }) =>
      apiData<Appointment>(`/appointments/${appointmentId}/status`, {
        method: "PATCH",
        body,
      }),
    meta: { silent: true },
    onSuccess: (saved) => {
      queryClient.setQueryData(["appointment", saved.id], saved)
      invalidateAppointments(queryClient, saved)
      setNote("")
      toast.success(
        `Đã chuyển sang "${APPOINTMENT_STATUS_LABELS[saved.status]}"`
      )
    },
    onError: (error) => {
      const fields = error instanceof ApiError ? fieldErrors(error.details) : {}
      if (fields.note) setNoteError(fields.note)
      else toast.error(errorMessage(error))
    },
  })

  const remove = useMutation({
    mutationFn: (target: Appointment) =>
      apiFetch<void>(`/appointments/${target.id}`, { method: "DELETE" }),
    onSuccess: (_result, target) => {
      invalidateAppointments(queryClient, target)
      toast.success("Đã xoá lịch hẹn")
      setDeleteOpen(false)
      onOpenChange(false)
    },
  })

  function pickStatus(status: AppointmentStatus) {
    const value = note.trim()
    if (value.length > 1000) {
      setNoteError("Ghi chú tối đa 1000 ký tự")
      return
    }
    setNoteError("")
    changeStatus.mutate(value ? { status, note: value } : { status })
  }

  const busy = changeStatus.isPending || remove.isPending

  return (
    <EntitySheet
      open={appointmentId !== null}
      onOpenChange={onOpenChange}
      title="Chi tiết lịch hẹn"
      description={
        appointment
          ? `${APPOINTMENT_TYPE_LABELS[appointment.type]} · ${formatDateTime(appointment.startAt)}`
          : undefined
      }
      footer={
        appointment && (canUpdate || canDelete) ? (
          <>
            {canDelete ? (
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 aria-hidden="true" />
                Xoá
              </Button>
            ) : null}
            {canUpdate ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setEditOpen(true)}
              >
                <Pencil aria-hidden="true" />
                Sửa
              </Button>
            ) : null}
          </>
        ) : null
      }
    >
      {detail.isPending ? (
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      ) : detail.error ? (
        <div className="flex flex-col items-start gap-2 text-sm">
          <p className="text-destructive">
            {detail.error instanceof ApiError && detail.error.status === 404
              ? "Không tìm thấy lịch hẹn."
              : "Không tải được lịch hẹn."}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void detail.refetch()}
          >
            Thử lại
          </Button>
        </div>
      ) : appointment ? (
        <>
          <dl className="divide-y divide-border/60">
            <Row label="Thời gian">
              <span className="font-medium">
                {formatDateTime(appointment.startAt)}
              </span>{" "}
              <span className="text-muted-foreground">
                – {formatTime(appointment.endAt)} ({appointment.durationMinutes}{" "}
                phút)
              </span>
            </Row>
            <Row label="Trạng thái">
              <StatusPill
                status={APPOINTMENT_STATUS_LABELS[appointment.status]}
              />
            </Row>
            <Row label="Loại">{APPOINTMENT_TYPE_LABELS[appointment.type]}</Row>
            <Row label="Tiêu đề">{appointment.title ?? empty}</Row>
            <Row label="Khách hàng">
              {appointment.leadId ? (
                <Link
                  href={`/admin/khach-hang/${appointment.leadId}`}
                  className="font-medium text-primary hover:underline"
                >
                  {lead.data
                    ? `${lead.data.name} · ${lead.data.phone}`
                    : "Xem khách hàng"}
                </Link>
              ) : (
                empty
              )}
            </Row>
            <Row label="Chi nhánh">
              {nameById(branches.data, appointment.branchId, "—")}
            </Row>
            <Row label="Phụ trách">
              {appointment.assigneeId
                ? nameById(staff.data, appointment.assigneeId, "Nhân viên")
                : empty}
            </Row>
            <Row label="Ghi chú">
              {appointment.note ? (
                <span className="whitespace-pre-line">{appointment.note}</span>
              ) : (
                empty
              )}
            </Row>
          </dl>

          {canUpdate ? (
            <section
              aria-label="Đổi trạng thái"
              className="flex flex-col gap-3 rounded-lg border border-border/80 p-3"
            >
              <p className="text-[13px] font-semibold text-navy">
                Đổi trạng thái
              </p>
              <FormField
                id="appointment-status-note"
                label="Ghi chú kèm theo"
                error={noteError}
              >
                <Textarea
                  rows={2}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </FormField>
              <div className="flex flex-wrap gap-2">
                {STATUSES.filter((status) => status !== appointment.status).map(
                  (status) => (
                    <Button
                      key={status}
                      type="button"
                      size="sm"
                      variant={status === "no_show" ? "destructive" : "outline"}
                      disabled={busy}
                      onClick={() => pickStatus(status)}
                    >
                      {APPOINTMENT_STATUS_LABELS[status]}
                    </Button>
                  )
                )}
              </div>
            </section>
          ) : null}

          {canUpdate ? (
            <AppointmentFormSheet
              open={editOpen}
              onOpenChange={setEditOpen}
              appointment={appointment}
            />
          ) : null}
          {canDelete ? (
            <ConfirmDialog
              open={deleteOpen}
              onOpenChange={setDeleteOpen}
              title="Xoá lịch hẹn?"
              description={`${APPOINTMENT_TYPE_LABELS[appointment.type]} · ${formatDateTime(appointment.startAt)}. Không thể hoàn tác.`}
              confirmLabel="Xoá lịch hẹn"
              destructive
              pending={remove.isPending}
              onConfirm={() => remove.mutate(appointment)}
            />
          ) : null}
        </>
      ) : null}
    </EntitySheet>
  )
}
