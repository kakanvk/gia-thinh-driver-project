import Link from "next/link"
import { ShieldAlert } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"

// data-admin-shell: globals.css ẩn footer website trên các màn admin
export function AdminStatus({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div
      data-admin-shell
      role="status"
      className="grid min-h-svh place-items-center bg-muted/60 p-6 text-center text-[13px]"
    >
      <div className="flex max-w-sm flex-col items-center gap-3">
        <p className="text-base font-semibold text-navy">{title}</p>
        {description ? (
          <p className="text-muted-foreground">{description}</p>
        ) : null}
        {action}
      </div>
    </div>
  )
}

// Khung admin dạng skeleton (sidebar + header + nội dung) hiển thị trong lúc dựng phiên
export function AdminShellSkeleton() {
  const bar = "animate-pulse rounded-md bg-muted"
  return (
    <div
      data-admin-shell
      role="status"
      aria-busy="true"
      className="min-h-svh bg-muted/60 text-[13px]"
    >
      <span className="sr-only">Đang tải…</span>
      <aside
        aria-hidden="true"
        className="fixed inset-y-0 left-0 hidden w-64 flex-col gap-6 border-r border-border/70 bg-background px-4 py-5 lg:flex"
      >
        <div className="flex min-h-12 items-center gap-3 px-2">
          <div className={`size-10 ${bar}`} />
          <div className="flex flex-col gap-1.5">
            <div className={`h-3.5 w-24 ${bar}`} />
            <div className={`h-2.5 w-28 ${bar}`} />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className={`h-10 ${bar}`} />
          ))}
        </div>
      </aside>
      <div aria-hidden="true" className="min-h-svh lg:pl-64">
        <div className="sticky top-0 z-40 flex min-h-16 items-center gap-3 border-b border-border/70 bg-background px-4">
          <div className={`size-9 lg:hidden ${bar}`} />
          <div className={`hidden h-9 max-w-md flex-1 sm:block ${bar}`} />
          <div className="ml-auto flex items-center gap-2">
            <div className={`size-9 ${bar}`} />
            <div className={`h-9 w-24 ${bar}`} />
          </div>
        </div>
        <div className="flex flex-col gap-4 p-4">
          <div className={`h-7 w-48 ${bar}`} />
          <div className="h-64 animate-pulse rounded-md bg-background" />
        </div>
      </div>
    </div>
  )
}

export function Forbidden({ home }: { home: string }) {
  return (
    <main
      id="admin-content"
      className="grid place-items-center p-10 text-center"
    >
      <div className="flex max-w-sm flex-col items-center gap-3">
        <ShieldAlert
          aria-hidden="true"
          className="size-10 text-muted-foreground"
        />
        <h1 className="text-lg font-bold text-navy">Không có quyền truy cập</h1>
        <p className="text-muted-foreground">
          Tài khoản của bạn không được xem trang này. Liên hệ quản trị viên nếu
          cần cấp quyền.
        </p>
        <Link href={home} className={buttonVariants({ size: "sm" })}>
          Về trang của tôi
        </Link>
      </div>
    </main>
  )
}
