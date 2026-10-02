import type { Metadata } from "next"
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  Users,
} from "lucide-react"

import {
  AdminPageHeader,
  SectionHeading,
  StatusPill,
} from "@/components/admin/admin-ui"
import { calendarEvents, registrations } from "@/lib/admin-data"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Lịch đăng ký",
}

const weekdays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
const calendarCells = [
  { day: 31, outside: true },
  ...Array.from({ length: 30 }, (_, index) => ({
    day: index + 1,
    outside: false,
  })),
  ...Array.from({ length: 4 }, (_, index) => ({
    day: index + 1,
    outside: true,
  })),
]

const eventTone = {
  primary: "bg-primary/10 text-primary hover:bg-primary/20",
  signal: "bg-signal/20 text-navy hover:bg-signal/30",
  warning: "bg-highlight/25 text-foreground hover:bg-highlight/35",
}

const viewModes = [
  { label: "Ngày", active: false },
  { label: "Tuần", active: false },
  { label: "Tháng", active: true },
]

export default function RegistrationCalendarPage() {
  const todayRegistrations = registrations.filter((item) =>
    item.schedule.startsWith("24/09")
  )

  return (
    <main id="admin-content" className="p-4">
      <AdminPageHeader
        title="Lịch đăng ký"
        action={
          <button
            type="button"
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-primary/85"
          >
            <Plus aria-hidden="true" className="size-4" />
            Tạo lịch hẹn
          </button>
        }
      />

      <div className="mt-4 grid gap-3 min-[1360px]:grid-cols-[minmax(0,1fr)_260px]">
        <section className="rounded-lg bg-background p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Tháng trước"
                className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
              </button>
              <h2 className="min-w-32 text-center text-sm font-semibold text-navy">
                Tháng 09, 2026
              </h2>
              <button
                type="button"
                aria-label="Tháng sau"
                className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronRight aria-hidden="true" className="size-4" />
              </button>
              <button
                type="button"
                className="ml-1 hidden h-8 items-center rounded-md bg-muted/60 px-3 text-[11px] font-medium text-foreground transition-colors hover:bg-muted sm:inline-flex"
              >
                Hôm nay
              </button>
            </div>

            <div
              className="flex rounded-md bg-muted/60 p-0.5"
              aria-label="Chế độ xem lịch"
            >
              {viewModes.map((mode) => (
                <button
                  key={mode.label}
                  type="button"
                  aria-pressed={mode.active}
                  className={cn(
                    "h-7 rounded-sm px-2.5 text-[11px] font-medium transition-colors",
                    mode.active
                      ? "bg-background text-primary shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-2 overflow-x-auto">
            <div className="min-w-190">
              <div className="grid grid-cols-7">
                {weekdays.map((day) => (
                  <div
                    key={day}
                    className="px-2 py-1 text-center text-[10px] font-semibold tracking-wide text-muted-foreground uppercase"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-px bg-border/40">
                {calendarCells.map((cell, index) => {
                  const event = cell.outside
                    ? undefined
                    : calendarEvents.find((item) => item.day === cell.day)
                  const isToday = !cell.outside && cell.day === 24
                  const [time, branch] = event ? event.meta.split(" · ") : []

                  return (
                    <div
                      key={`${cell.outside ? "outside" : "inside"}-${cell.day}-${index}`}
                      className="min-h-24 bg-background p-2"
                    >
                      <time
                        className={cn(
                          "grid size-6 place-items-center rounded-md text-[11px] font-semibold",
                          isToday
                            ? "bg-primary text-primary-foreground"
                            : cell.outside
                              ? "text-muted-foreground/45"
                              : "text-muted-foreground"
                        )}
                      >
                        {cell.day}
                      </time>

                      {event ? (
                        <button
                          type="button"
                          className={cn(
                            "mt-1.5 block w-full rounded-md px-2 py-1.5 text-left transition-colors",
                            eventTone[event.tone]
                          )}
                        >
                          <span className="flex items-center gap-1 text-[9px] font-medium opacity-80">
                            <Clock3 aria-hidden="true" className="size-2.5" />
                            {time}
                          </span>
                          <span className="mt-0.5 block truncate text-[10px] font-semibold">
                            {event.title}
                          </span>
                          <span className="mt-1 inline-flex rounded-full bg-background/70 px-1.5 py-px text-[9px] font-medium">
                            {branch}
                          </span>
                        </button>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        <aside className="flex flex-col gap-3">
          <section className="rounded-lg bg-background p-4 shadow-sm">
            <SectionHeading
              title="Hôm nay, 24/09"
              description={`${todayRegistrations.length} lịch hẹn cần xử lý`}
              icon={CalendarPlus}
            />
            <div className="mt-3 flex flex-col gap-1">
              {todayRegistrations.map((registration) => (
                <article
                  key={registration.id}
                  className="rounded-md p-2 transition-colors hover:bg-muted/60"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-secondary text-[10px] font-semibold text-secondary-foreground">
                      {registration.initials}
                    </span>
                    <span className="min-w-0">
                      <span
                        className="block truncate text-[13px] font-semibold"
                        title={registration.student}
                      >
                        {registration.student}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        Hạng {registration.course}
                      </span>
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Clock3
                        aria-hidden="true"
                        className="size-3.5 shrink-0"
                      />
                      <span className="truncate">
                        {registration.schedule.split(" · ")[1]} ·{" "}
                        {registration.branch}
                      </span>
                    </span>
                    <StatusPill status={registration.status} />
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-lg bg-navy p-4 text-white">
            <Users aria-hidden="true" className="size-5 text-signal" />
            <p className="mt-2 text-xl font-bold">42</p>
            <p className="mt-1 text-[13px] font-semibold">
              Lịch đăng ký tuần này
            </p>
            <p className="mt-1 text-[11px] leading-4 text-white/65">
              12 lịch tại Tân Ngãi · 9 lịch tại Vũng Liêm · 21 lịch tại các chi
              nhánh khác.
            </p>
          </section>
        </aside>
      </div>
    </main>
  )
}
