import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { classStatus, classTitle, consultHref, formatDate, seatsLabel } from "@/lib/public/format"
import type { UpcomingClass } from "@/lib/public/types"

export function ClassSchedule({ classes }: { classes: UpcomingClass[] | null }) {
  if (!classes || classes.length === 0) {
    return (
      <div className="rounded-md border border-border p-6 sm:p-7">
        <p className="text-sm leading-6 text-muted-foreground">
          Chưa có lớp sắp khai giảng, để lại thông tin để được báo lịch sớm.
        </p>
        <Link
          href="/tu-van"
          className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary hover:underline"
        >
          Đăng ký nhận lịch
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="hidden grid-cols-[1.2fr_0.8fr_1fr_1fr] gap-4 bg-navy px-6 py-4 text-xs font-semibold text-white/70 sm:grid">
        <span>Lớp</span>
        <span>Khai giảng</span>
        <span>Tình trạng</span>
        <span></span>
      </div>
      {classes.slice(0, 8).map((item, index) => {
        const status = classStatus(item)
        return (
          <div key={item.code}>
            {index > 0 ? <Separator /> : null}
            <div className="grid gap-4 px-5 py-5 sm:grid-cols-[1.2fr_0.8fr_1fr_1fr] sm:items-center sm:px-6">
              <div>
                <strong className="text-navy">{classTitle(item)}</strong>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.branch.name}
                  {item.scheduleText ? ` · ${item.scheduleText}` : ""}
                </p>
              </div>
              <span className="text-sm font-semibold">{formatDate(item.startDate)}</span>
              <div>
                <Badge variant={status.urgent ? "destructive" : "secondary"}>{status.label}</Badge>
                <p className="mt-1 text-xs text-muted-foreground">{seatsLabel(item.seatsLeft)}</p>
              </div>
              <Link
                href={consultHref(item.branch.slug, item.course.code)}
                className="inline-flex h-11 items-center justify-between gap-2 rounded-md bg-primary/[0.06] px-3.5 text-sm font-bold text-primary transition-colors active:bg-primary/10 sm:h-auto sm:bg-transparent sm:px-0 sm:hover:bg-transparent sm:hover:underline"
              >
                Giữ chỗ lớp này
                <ChevronRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}
