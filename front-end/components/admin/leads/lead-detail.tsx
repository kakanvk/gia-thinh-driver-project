"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Pencil, Trash2, UserRoundCheck } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { SectionHeading, StatusPill } from "@/components/admin/admin-ui"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { LeadActivities } from "@/components/admin/leads/lead-activities"
import { LeadAssign } from "@/components/admin/leads/lead-assign"
import { LeadConvertSheet } from "@/components/admin/leads/lead-convert-sheet"
import { LeadFormSheet } from "@/components/admin/leads/lead-form-sheet"
import { LeadStatusMenu } from "@/components/admin/leads/lead-status-menu"
import { Button } from "@/components/ui/button"
import { formatDateTime, isOverdue } from "@/lib/admin/datetime"
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS } from "@/lib/admin/labels"
import { isOpenStatus } from "@/lib/admin/lead-status"
import { nameById, useBranches } from "@/lib/admin/lookups"
import type { Lead } from "@/lib/admin/types"
import { useCan } from "@/lib/admin/use-can"
import { apiData, apiFetch } from "@/lib/api/client"
import { ApiError } from "@/lib/api/errors"
import { cn } from "@/lib/utils"

const CONVERTIBLE = ["deposited", "docs_completed"]

function InfoRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
      <dt className="w-36 shrink-0 text-xs font-medium text-muted-foreground sm:pt-0.5">
        {label}
      </dt>
      <dd className="min-w-0 text-sm break-words">{children}</dd>
    </div>
  )
}

const empty = <span className="text-muted-foreground">—</span>

export function LeadDetail({ id }: { id: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const canUpdate = useCan("lead.update")
  const canDelete = useCan("lead.delete")
  const canConvert = useCan("student.create")
  const branches = useBranches()
  const [editOpen, setEditOpen] = useState(false)
  const [convertOpen, setConvertOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const leadQuery = useQuery({
    queryKey: ["lead", id],
    queryFn: ({ signal }) => apiData<Lead>(`/leads/${id}`, { signal }),
  })

  const remove = useMutation({
    mutationFn: () => apiFetch<void>(`/leads/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["leads"] })
      queryClient.removeQueries({ queryKey: ["lead", id] })
      toast.success("Đã xoá khách")
      setDeleteOpen(false)
      router.push("/admin/khach-hang")
    },
  })

  const backLink = (
    <Link
      href="/admin/khach-hang"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Về danh sách khách hàng
    </Link>
  )

  if (leadQuery.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        {backLink}
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  if (leadQuery.error) {
    const notFound =
      leadQuery.error instanceof ApiError && leadQuery.error.status === 404
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-border/80 bg-card p-6">
        <p className="font-semibold text-navy">
          {notFound ? "Không tìm thấy khách hàng" : "Không tải được dữ liệu."}
        </p>
        {notFound ? (
          <p className="text-sm text-muted-foreground">
            Khách có thể đã bị xoá hoặc không thuộc chi nhánh của bạn.
          </p>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => void leadQuery.refetch()}
          >
            Thử lại
          </Button>
        )}
        {backLink}
      </div>
    )
  }

  const lead = leadQuery.data
  const utm = Object.entries(lead.utm ?? {}).filter(([, value]) => value)
  const showConvert =
    canConvert && CONVERTIBLE.includes(lead.status) && !lead.studentId

  return (
    <div className="flex flex-col gap-4">
      {backLink}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-navy sm:text-xl">
              {lead.name}
            </h1>
            <StatusPill status={LEAD_STATUS_LABELS[lead.status]} />
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{lead.code}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canUpdate ? <LeadStatusMenu lead={lead} /> : null}
          {canUpdate ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditOpen(true)}
            >
              <Pencil aria-hidden="true" />
              Sửa
            </Button>
          ) : null}
          {showConvert ? (
            <Button type="button" onClick={() => setConvertOpen(true)}>
              <UserRoundCheck aria-hidden="true" />
              Chuyển thành học viên
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 aria-hidden="true" />
              Xoá
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="rounded-xl border border-border/80 bg-card p-4">
            <SectionHeading title="Thông tin khách" />
            <dl className="mt-2 divide-y divide-border/60">
              <InfoRow label="Số điện thoại">
                <a
                  href={`tel:${lead.phone}`}
                  className="font-medium text-primary hover:underline"
                >
                  {lead.phone}
                </a>
              </InfoRow>
              <InfoRow label="Email">{lead.email ?? empty}</InfoRow>
              <InfoRow label="Chi nhánh">
                {nameById(branches.data, lead.branchId, "—")}
              </InfoRow>
              <InfoRow label="Gói học">{lead.courseCode ?? empty}</InfoRow>
              <InfoRow label="Nguồn">
                <span>{LEAD_SOURCE_LABELS[lead.source]}</span>
                {utm.length > 0 ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    UTM: {utm.map(([key, value]) => `${key}: ${value}`).join(" · ")}
                  </span>
                ) : null}
              </InfoRow>
              <InfoRow label="Giờ liên hệ">
                {lead.preferredContactTime ?? empty}
              </InfoRow>
              <InfoRow label="Ghi chú">
                {lead.note ? (
                  <span className="whitespace-pre-line">{lead.note}</span>
                ) : (
                  empty
                )}
              </InfoRow>
              <InfoRow label="Phụ trách">
                <LeadAssign lead={lead} canUpdate={canUpdate} />
              </InfoRow>
              <InfoRow label="Hẹn gọi lại">
                {lead.nextFollowUpAt ? (
                  <span
                    className={cn(
                      isOpenStatus(lead.status) &&
                        isOverdue(lead.nextFollowUpAt) &&
                        "font-semibold text-destructive"
                    )}
                  >
                    {formatDateTime(lead.nextFollowUpAt)}
                  </span>
                ) : (
                  empty
                )}
              </InfoRow>
              {lead.status === "lost" ? (
                <InfoRow label="Lý do không thành công">
                  {lead.lostReason ?? empty}
                </InfoRow>
              ) : null}
              <InfoRow label="Ngày tạo">{formatDateTime(lead.createdAt)}</InfoRow>
              <InfoRow label="Hoạt động gần nhất">
                {formatDateTime(lead.lastActivityAt)}
              </InfoRow>
            </dl>
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <LeadActivities leadId={lead.id} canUpdate={canUpdate} />
        </div>
      </div>

      {canUpdate ? (
        <LeadFormSheet open={editOpen} onOpenChange={setEditOpen} lead={lead} />
      ) : null}
      {showConvert ? (
        <LeadConvertSheet
          open={convertOpen}
          onOpenChange={setConvertOpen}
          lead={lead}
        />
      ) : null}
      {canDelete ? (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={`Xoá khách ${lead.name}?`}
          description="Lịch hẹn đang chờ của khách sẽ bị huỷ. Không thể hoàn tác."
          confirmLabel="Xoá khách"
          destructive
          pending={remove.isPending}
          onConfirm={() => remove.mutate()}
        />
      ) : null}
    </div>
  )
}
