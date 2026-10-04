"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"

import { AdminShell } from "@/components/admin/admin-shell"
import {
  AdminShellSkeleton,
  AdminStatus,
  Forbidden,
} from "@/components/admin/admin-status"
import { useAuth } from "@/components/admin/auth-provider"
import { Button } from "@/components/ui/button"
import { hasPermission } from "@/lib/auth/permissions"
import {
  canAccess,
  firstAllowedPath,
  LOGIN_PATH,
  loginUrl,
} from "@/lib/auth/routes"

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { status, permissions, signedOut, retry } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const needsHome =
    status === "authenticated" &&
    pathname === "/admin" &&
    !hasPermission(permissions, "dashboard.read")

  useEffect(() => {
    if (status === "anonymous") {
      router.replace(
        signedOut
          ? LOGIN_PATH
          : loginUrl(`${pathname}${window.location.search}`)
      )
    } else if (needsHome) {
      router.replace(firstAllowedPath(permissions))
    }
  }, [status, signedOut, needsHome, pathname, permissions, router])

  if (status === "offline") {
    return (
      <AdminStatus
        title="Không kết nối được máy chủ"
        description="Kiểm tra kết nối mạng rồi thử lại."
        action={<Button onClick={retry}>Thử lại</Button>}
      />
    )
  }
  if (status !== "authenticated" || needsHome) return <AdminShellSkeleton />

  return (
    <AdminShell>
      {canAccess(pathname, permissions) ? (
        children
      ) : (
        <Forbidden home={firstAllowedPath(permissions)} />
      )}
    </AdminShell>
  )
}
