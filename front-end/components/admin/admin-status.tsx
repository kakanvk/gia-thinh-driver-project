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
