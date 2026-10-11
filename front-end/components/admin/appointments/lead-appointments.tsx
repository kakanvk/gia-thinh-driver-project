"use client"

import { useQuery } from "@tanstack/react-query"
import { CalendarPlus } from "lucide-react"
import { useState } from "react"

import { SectionHeading, StatusPill } from "@/components/admin/admin-ui"
import { AppointmentDetailSheet } from "@/components/admin/appointments/appointment-detail-sheet"
import { AppointmentFormSheet } from "@/components/admin/appointments/appointment-form-sheet"
import { Button } from "@/components/ui/button"
import { formatDateTime } from "@/lib/admin/datetime"
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_TYPE_LABELS,
} from "@/lib/admin/labels"
import { nameById, useStaffOptions } from "@/lib/admin/lookups"
import type { Appointment, Lead, Page } from "@/lib/admin/types"
import { useCan } from "@/lib/admin/use-can"
import { apiFetch } from "@/lib/api/client"

export function LeadAppointments({ lead }: { lead: Lead }) {
  const canCreate = useCan("appointment.create")
  const staff = useStaffOptions()
  const [formOpen, setFormOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  const query = { leadId: lead.id, sort: "-startAt" }
  const appointments = useQuery({
    queryKey: ["appointments", query],
    queryFn: ({ signal }) =>
      apiFetch<Page<Appointment>>("/appointments", { query, signal }),
  })
  const items = appointments.data?.data ?? []
  const total = appointments.data?.meta.total ?? 0

  return (
    <section className="rounded-xl border border-border/80 bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <SectionHeading title="Lịch hẹn của khách" />
        {canCreate ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setFormOpen(true)}
          >
            <CalendarPlus aria-hidden="true" />
            Đặt lịch hẹn
          </Button>
        ) : null}
      </div>

      {appointments.isPending ? (
        <p className="mt-3 text-sm text-muted-foreground">Đang tải…</p>
      ) : appointments.error ? (
        <div className="mt-3 flex items-center gap-3 text-sm">
          <span className="text-destructive">Không tải được lịch hẹn.</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void appointments.refetch()}
          >
            Thử lại
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Chưa có lịch hẹn nào.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-border/60">
          {items.map((appointment) => (
            <li key={appointment.id}>
              <button
                type="button"
                onClick={() => setDetailId(appointment.id)}
                className="flex w-full flex-wrap items-center justify-between gap-2 py-2 text-left hover:bg-muted/40"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-navy">
                    {formatDateTime(appointment.startAt)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    <span>{APPOINTMENT_TYPE_LABELS[appointment.type]}</span>
                    {" · "}
                    {appointment.assigneeId
                      ? nameById(
                          staff.data,
                          appointment.assigneeId,
                          "Nhân viên"
                        )
                      : "Chưa phân công"}
                  </span>
                </span>
                <StatusPill
                  status={APPOINTMENT_STATUS_LABELS[appointment.status]}
                />
              </button>
            </li>
          ))}
        </ul>
      )}
      {total > items.length ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Hiện {items.length}/{total} lịch hẹn gần nhất.
        </p>
      ) : null}

      {canCreate ? (
        <AppointmentFormSheet
          open={formOpen}
          onOpenChange={setFormOpen}
          lead={lead}
        />
      ) : null}
      <AppointmentDetailSheet
        appointmentId={detailId}
        onOpenChange={(open) => {
          if (!open) setDetailId(null)
        }}
      />
    </section>
  )
}
