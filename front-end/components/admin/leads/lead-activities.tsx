"use client"

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { SectionHeading } from "@/components/admin/admin-ui"
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
import { formatDateTime, toVnIso } from "@/lib/admin/datetime"
import { ACTIVITY_LABELS, LEAD_STATUS_LABELS } from "@/lib/admin/labels"
import { nameById, useStaffOptions } from "@/lib/admin/lookups"
import type { ActivityType, LeadActivity, Page } from "@/lib/admin/types"
import { apiData, apiFetch } from "@/lib/api/client"
import { ApiError, errorMessage, fieldErrors } from "@/lib/api/errors"

const LIMIT = 20
const MANUAL_TYPES = [
  "call",
  "note",
  "sms",
  "meeting",
] as const satisfies readonly ActivityType[]
type ManualType = (typeof MANUAL_TYPES)[number]

function activityTitle(activity: LeadActivity): string {
  const label = ACTIVITY_LABELS[activity.type]
  if (activity.type === "status_change" && activity.toStatus) {
    const to = LEAD_STATUS_LABELS[activity.toStatus]
    return activity.fromStatus
      ? `${label}: ${LEAD_STATUS_LABELS[activity.fromStatus]} → ${to}`
      : `${label}: ${to}`
  }
  return label
}

export function LeadActivities({
  leadId,
  canUpdate,
}: {
  leadId: string
  canUpdate: boolean
}) {
  const staff = useStaffOptions()
  const activities = useInfiniteQuery({
    queryKey: ["lead-activities", leadId],
    queryFn: ({ pageParam, signal }) =>
      apiFetch<Page<LeadActivity>>(`/leads/${leadId}/activities`, {
        query: { page: pageParam, limit: LIMIT },
        signal,
      }),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.data.length, 0)
      return loaded < last.meta.total && last.data.length > 0
        ? last.meta.page + 1
        : undefined
    },
  })
  // Trang offset có thể lệch khi có hoạt động mới chen vào giữa các lần tải —
  // bỏ bản ghi trùng id để không hiển thị lặp.
  const seen = new Set<string>()
  const items = (
    activities.data?.pages.flatMap((page) => page.data) ?? []
  ).filter(
    (activity) => !seen.has(activity.id) && Boolean(seen.add(activity.id))
  )

  return (
    <section className="rounded-xl border border-border/80 bg-card p-4">
      <SectionHeading title="Lịch sử chăm sóc" />
      {canUpdate ? <ActivityForm leadId={leadId} /> : null}

      {activities.isPending ? (
        <p className="mt-4 text-sm text-muted-foreground">Đang tải…</p>
      ) : activities.error && items.length === 0 ? (
        <div className="mt-4 flex items-center gap-3 text-sm">
          <span className="text-destructive">Không tải được lịch sử.</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void activities.refetch()}
          >
            Thử lại
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Chưa có hoạt động nào.
        </p>
      ) : (
        <ol
          aria-label="Lịch sử chăm sóc"
          className="mt-4 flex flex-col gap-4 border-l border-border pl-4"
        >
          {items.map((activity) => (
            <li key={activity.id} className="relative">
              <span
                aria-hidden="true"
                className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-card bg-primary"
              />
              <p className="text-sm font-semibold text-navy">
                {activityTitle(activity)}
              </p>
              {activity.content ? (
                <p className="mt-0.5 text-sm whitespace-pre-line">
                  {activity.content}
                </p>
              ) : null}
              <p className="mt-0.5 text-xs text-muted-foreground">
                {activity.byUserId
                  ? nameById(staff.data, activity.byUserId, "Nhân viên")
                  : "Hệ thống"}{" "}
                · {formatDateTime(activity.at)}
              </p>
            </li>
          ))}
        </ol>
      )}

      {activities.hasNextPage ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          disabled={activities.isFetchingNextPage}
          onClick={() => void activities.fetchNextPage()}
        >
          Xem thêm
        </Button>
      ) : null}
    </section>
  )
}

function ActivityForm({ leadId }: { leadId: string }) {
  const queryClient = useQueryClient()
  const [type, setType] = useState<ManualType>("call")
  const [content, setContent] = useState("")
  const [followUp, setFollowUp] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  const mutation = useMutation({
    mutationFn: (body: Record<string, string>) =>
      apiData<LeadActivity>(`/leads/${leadId}/activities`, {
        method: "POST",
        body,
      }),
    meta: { silent: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["lead-activities", leadId],
      })
      void queryClient.invalidateQueries({ queryKey: ["lead", leadId] })
      void queryClient.invalidateQueries({ queryKey: ["leads"] })
      toast.success("Đã ghi hoạt động")
      setContent("")
      setFollowUp("")
      setErrors({})
    },
    onError: (error) => {
      const fields = error instanceof ApiError ? fieldErrors(error.details) : {}
      setErrors(fields)
      if (Object.keys(fields).length === 0) toast.error(errorMessage(error))
    },
  })

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = content.trim()
    if (!text) {
      setErrors({ content: "Nhập nội dung" })
      return
    }
    setErrors({})
    mutation.mutate({
      type,
      content: text,
      ...(followUp ? { nextFollowUpAt: toVnIso(followUp) } : {}),
    })
  }

  const typeItems = MANUAL_TYPES.map((value) => ({
    value,
    label: ACTIVITY_LABELS[value],
  }))

  return (
    <form
      noValidate
      aria-label="Ghi hoạt động"
      onSubmit={onSubmit}
      className="mt-4 flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/30 p-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="activity-type" label="Loại" error={errors.type}>
          {(control) => (
            <Select
              items={typeItems}
              value={type}
              onValueChange={(value) => {
                if (value) setType(value as ManualType)
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
        <FormField
          id="activity-follow-up"
          label="Hẹn gọi lại"
          error={errors.nextFollowUpAt}
        >
          <Input
            type="datetime-local"
            value={followUp}
            onChange={(event) => setFollowUp(event.target.value)}
          />
        </FormField>
      </div>
      <FormField
        id="activity-content"
        label="Nội dung"
        required
        error={errors.content}
      >
        <Textarea
          rows={2}
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
      </FormField>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          Lưu hoạt động
        </Button>
      </div>
    </form>
  )
}
