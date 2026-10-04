import type { LucideIcon } from "lucide-react"
import { Search, SlidersHorizontal } from "lucide-react"

import { cn } from "@/lib/utils"

export function AdminPageHeader({
  title,
  action,
}: {
  title: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="text-lg font-bold tracking-tight text-navy sm:text-xl">
        {title}
      </h1>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function SectionHeading({
  title,
  description,
  icon: Icon,
  action,
}: {
  title: string
  description?: string
  icon?: LucideIcon
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Icon aria-hidden="true" className="size-4" />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-navy">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

const statusStyles: Record<string, string> = {
  "Đã xác nhận": "bg-success/10 text-success",
  "Đã đặt cọc": "bg-primary/10 text-primary",
  "Chờ tư vấn": "bg-highlight/25 text-foreground",
  "Đang học": "bg-primary/10 text-primary",
  "Đang nhận hồ sơ": "bg-primary/10 text-primary",
  "Sắp khai giảng": "bg-highlight/25 text-foreground",
  "Đã kết thúc": "bg-muted text-muted-foreground",
  "Đã có kết quả": "bg-success/10 text-success",
  "Sắp diễn ra": "bg-primary/10 text-primary",
  "Đã thu đủ": "bg-success/10 text-success",
  "Đang đóng theo đợt": "bg-primary/10 text-primary",
  "Quá hạn": "bg-destructive/10 text-destructive",
  "Bị báo cáo": "bg-destructive/10 text-destructive",
  "Đang chạy": "bg-success/10 text-success",
  "Bảo dưỡng": "bg-highlight/25 text-foreground",
  "Tạm dừng": "bg-muted text-muted-foreground",
  "Tạm nghỉ": "bg-muted text-muted-foreground",
  "Chờ xác nhận": "bg-highlight/25 text-foreground",
  "Đã hoàn tất": "bg-success/10 text-success",
  "Đang hoạt động": "bg-success/10 text-success",
  "Đã xuất bản": "bg-success/10 text-success",
  "Đã duyệt": "bg-primary/10 text-primary",
  "Chờ duyệt": "bg-highlight/25 text-foreground",
  "Bản nháp": "bg-muted text-muted-foreground",
  // Trạng thái khách hàng
  Mới: "bg-signal/20 text-navy",
  "Đã liên hệ": "bg-primary/10 text-primary",
  "Đã tư vấn": "bg-primary/10 text-primary",
  "Đặt cọc": "bg-highlight/25 text-foreground",
  "Hoàn tất hồ sơ": "bg-highlight/40 text-foreground",
  "Nhập học": "bg-success/10 text-success",
  "Không thành công": "bg-destructive/10 text-destructive",
  // Trạng thái lịch hẹn (lịch thi mẫu cũng dùng "Đã lên lịch")
  "Đã lên lịch": "bg-signal/20 text-navy",
  "Hoàn thành": "bg-success/10 text-success",
  "Đã hủy": "bg-muted text-muted-foreground",
  "Khách không đến": "bg-destructive/10 text-destructive",
}

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-semibold whitespace-nowrap",
        statusStyles[status] ?? "bg-muted text-muted-foreground"
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  )
}

export function TableToolbar({
  searchLabel,
  searchPlaceholder,
  summary,
  action,
}: {
  searchLabel: string
  searchPlaceholder: string
  summary: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[13px] font-semibold text-navy">{summary}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative min-w-0 sm:w-72">
          <span className="sr-only">{searchLabel}</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            placeholder={searchPlaceholder}
            className="h-9 w-full rounded-md border border-border bg-background pr-3 pl-9 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          />
        </label>
        <button
          type="button"
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-[13px] font-medium text-foreground hover:bg-muted"
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          Bộ lọc
        </button>
        {action}
      </div>
    </div>
  )
}
