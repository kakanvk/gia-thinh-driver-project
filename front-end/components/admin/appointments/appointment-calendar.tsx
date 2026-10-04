"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import {
  AdminPageHeader,
  SectionHeading,
  StatusPill,
} from "@/components/admin/admin-ui"
import { AppointmentDetailSheet } from "@/components/admin/appointments/appointment-detail-sheet"
import { AppointmentFormSheet } from "@/components/admin/appointments/appointment-form-sheet"
import { useAuth } from "@/components/admin/auth-provider"
import { FilterSelect, type FilterItem } from "@/components/admin/filter-bar"
import { Button } from "@/components/ui/button"
import { formatDate, monthOf, shiftMonth, todayVn } from "@/lib/admin/datetime"
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_TYPE_LABELS,
} from "@/lib/admin/labels"
import { useBranchChoice, useStaffOptions } from "@/lib/admin/lookups"
import type {
  AppointmentStatus,
  CalendarItem,
  CalendarMonth,
} from "@/lib/admin/types"
import { useCan } from "@/lib/admin/use-can"
import { useListParams } from "@/lib/admin/use-list-params"
import { apiData } from "@/lib/api/client"
import { cn } from "@/lib/utils"

const FILTER_KEYS = ["month", "branchId", "assigneeId"] as const
const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
const MAX_PER_DAY = 3
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export const APPOINTMENT_STATUS_TONE: Record<AppointmentStatus, string> = {
  scheduled: "bg-primary/10 text-primary hover:bg-primary/20",
  done: "bg-success/10 text-success hover:bg-success/20",
  cancelled: "bg-muted text-muted-foreground line-through hover:bg-muted/80",
  no_show: "bg-destructive/10 text-destructive hover:bg-destructive/20",
}

type Cell = { date: string; day: number; outside: boolean }

function isoDay(year: number, monthIndex: number, day: number): string {
  // Date.UTC tự chuẩn hoá tháng/ngày tràn; đọc lại bằng UTC để không lệch múi giờ máy
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10)
}

// Lưới tuần bắt đầu thứ Hai, đủ số hàng để chứa trọn tháng
export function monthCells(month: string): Cell[] {
  const [year, m] = month.split("-").map(Number)
  const first = new Date(Date.UTC(year, m - 1, 1))
  const lead = (first.getUTCDay() + 6) % 7
  const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate()
  const total = Math.ceil((lead + daysInMonth) / 7) * 7
  return Array.from({ length: total }, (_, index) => {
    const date = isoDay(year, m - 1, index - lead + 1)
    return {
      date,
      day: Number(date.slice(8, 10)),
      outside: date.slice(0, 7) !== month,
    }
  })
}

function itemLabel(item: CalendarItem): string {
  return `${item.time} · ${item.title ?? item.lead?.name ?? APPOINTMENT_TYPE_LABELS[item.type]}`
}

export function AppointmentCalendar() {
  const { user } = useAuth()
  const canCreate = useCan("appointment.create")
  const { values, set } = useListParams(FILTER_KEYS)
  const { branches, showBranchSelect } = useBranchChoice()
  const staff = useStaffOptions()
  const today = todayVn()
  const currentMonth = monthOf(today)
  const month = MONTH_RE.test(values.month) ? values.month : currentMonth
  const [pickedDay, setPickedDay] = useState(today)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  // Ngày đang chọn luôn thuộc tháng đang xem: mặc định hôm nay, hoặc ngày 1
  const selectedDay =
    monthOf(pickedDay) === month
      ? pickedDay
      : month === currentMonth
        ? today
        : `${month}-01`

  const filters = { branchId: values.branchId, assigneeId: values.assigneeId }
  const calendar = useQuery({
    queryKey: ["calendar", month, filters],
    queryFn: ({ signal }) =>
      apiData<CalendarMonth>("/appointments/calendar", {
        query: { month, ...filters },
        signal,
      }),
    placeholderData: keepPreviousData,
  })

  const byDay = new Map<string, CalendarItem[]>()
  for (const item of calendar.data?.month === month
    ? calendar.data.items
    : []) {
    const list = byDay.get(item.date) ?? []
    list.push(item)
    byDay.set(item.date, list)
  }
  const dayItems = byDay.get(selectedDay) ?? []

  const staffItems: FilterItem[] = [
    ...(user ? [{ value: user.id, label: "Của tôi" }] : []),
    ...(staff.data ?? [])
      .filter(
        (option) =>
          option.id !== user?.id &&
          (!values.branchId || option.branchIds.includes(values.branchId))
      )
      .map((option) => ({ value: option.id, label: option.name })),
  ]
  const [year, monthNumber] = month.split("-")

  return (
    <>
      <AdminPageHeader
        title="Lịch hẹn"
        action={
          canCreate ? (
            <Button type="button" onClick={() => setFormOpen(true)}>
              <Plus aria-hidden="true" />
              Tạo lịch hẹn
            </Button>
          ) : null
        }
      />

      <div className="mt-4 grid gap-3 min-[1360px]:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-lg bg-background p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Tháng trước"
                onClick={() => set({ month: shiftMonth(month, -1) })}
                className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
              </button>
              <h2
                aria-live="polite"
                className="min-w-32 text-center text-sm font-semibold text-navy"
              >
                Tháng {monthNumber}, {year}
              </h2>
              <button
                type="button"
                aria-label="Tháng sau"
                onClick={() => set({ month: shiftMonth(month, 1) })}
                className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronRight aria-hidden="true" className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setPickedDay(today)
                  set({ month: currentMonth })
                }}
                className="ml-1 inline-flex h-8 items-center rounded-md bg-muted/60 px-3 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
              >
                Hôm nay
              </button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {showBranchSelect ? (
                <FilterSelect
                  label="Chi nhánh"
                  items={branches.map((branch) => ({
                    value: branch.id,
                    label: branch.name,
                  }))}
                  value={values.branchId}
                  onChange={(branchId) =>
                    set({
                      branchId,
                      // Người cụ thể của chi nhánh cũ không còn trong danh sách
                      assigneeId:
                        values.assigneeId === user?.id ? values.assigneeId : "",
                    })
                  }
                />
              ) : null}
              <FilterSelect
                label="Phụ trách"
                items={staffItems}
                value={values.assigneeId}
                onChange={(assigneeId) => set({ assigneeId })}
              />
            </div>
          </div>

          {calendar.error ? (
            <div className="mt-3 flex items-center gap-3 rounded-md bg-destructive/10 px-3 py-2 text-sm">
              <span className="text-destructive">Không tải được lịch hẹn.</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void calendar.refetch()}
              >
                Thử lại
              </Button>
            </div>
          ) : null}

          <div className="mt-2 overflow-x-auto">
            <div
              className={cn(
                "min-w-190",
                calendar.isFetching && "opacity-70 transition-opacity"
              )}
              aria-busy={calendar.isFetching}
            >
              <div className="grid grid-cols-7">
                {WEEKDAYS.map((day) => (
                  <div
                    key={day}
                    className="px-2 py-1 text-center text-[10px] font-semibold tracking-wide text-muted-foreground uppercase"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-px bg-border/40">
                {monthCells(month).map((cell) => {
                  const items = cell.outside ? [] : (byDay.get(cell.date) ?? [])
                  const isToday = cell.date === today
                  const isSelected = !cell.outside && cell.date === selectedDay
                  const hidden = items.length - MAX_PER_DAY

                  return (
                    <div
                      key={cell.date}
                      data-testid="calendar-cell"
                      data-date={cell.date}
                      className={cn(
                        "min-h-24 bg-background p-2",
                        isSelected && "bg-primary/5"
                      )}
                    >
                      {cell.outside ? (
                        <span className="grid size-6 place-items-center text-[11px] font-semibold text-muted-foreground/45">
                          {cell.day}
                        </span>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Ngày ${formatDate(cell.date)}${items.length ? `, ${items.length} lịch hẹn` : ""}`}
                          aria-pressed={isSelected}
                          onClick={() => setPickedDay(cell.date)}
                          className={cn(
                            "grid size-6 place-items-center rounded-md text-[11px] font-semibold transition-colors",
                            isToday
                              ? "bg-primary text-primary-foreground"
                              : isSelected
                                ? "bg-primary/15 text-primary"
                                : "text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {cell.day}
                        </button>
                      )}

                      {items.slice(0, MAX_PER_DAY).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setDetailId(item.id)}
                          className={cn(
                            "mt-1 block w-full truncate rounded-md px-1.5 py-1 text-left text-[10px] font-semibold transition-colors",
                            APPOINTMENT_STATUS_TONE[item.status]
                          )}
                        >
                          {itemLabel(item)}
                        </button>
                      ))}
                      {hidden > 0 ? (
                        <button
                          type="button"
                          onClick={() => setPickedDay(cell.date)}
                          className="mt-1 rounded px-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                        >
                          +{hidden}
                        </button>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        <aside>
          <section
            aria-label={`Lịch hẹn ngày ${formatDate(selectedDay)}`}
            className="rounded-lg bg-background p-4 shadow-sm"
          >
            <SectionHeading
              title={`${selectedDay === today ? "Hôm nay, " : ""}${formatDate(selectedDay)}`}
              description={
                calendar.isPending ? "Đang tải…" : `${dayItems.length} lịch hẹn`
              }
              icon={CalendarDays}
            />
            <ul className="mt-3 flex flex-col gap-1">
              {dayItems.map((item) => (
                <li
                  key={item.id}
                  className="rounded-md p-2 transition-colors hover:bg-muted/60"
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setDetailId(item.id)}
                      className="min-w-0 text-left"
                    >
                      <span className="block text-[13px] font-semibold text-navy">
                        {item.time} · {APPOINTMENT_TYPE_LABELS[item.type]}
                      </span>
                      {item.title ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.title}
                        </span>
                      ) : null}
                    </button>
                    <StatusPill
                      status={APPOINTMENT_STATUS_LABELS[item.status]}
                    />
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {item.lead ? (
                      <Link
                        href={`/admin/khach-hang/${item.lead.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {item.lead.name}
                      </Link>
                    ) : (
                      "Không gắn khách"
                    )}
                    {" · "}
                    {item.assignee?.name ?? "Chưa phân công"}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      {canCreate ? (
        <AppointmentFormSheet
          open={formOpen}
          onOpenChange={setFormOpen}
          defaultDate={selectedDay}
        />
      ) : null}
      <AppointmentDetailSheet
        appointmentId={detailId}
        onOpenChange={(open) => {
          if (!open) setDetailId(null)
        }}
      />
    </>
  )
}
