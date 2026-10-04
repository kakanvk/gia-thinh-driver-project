import type { Metadata } from "next"

import { AuthProvider } from "@/components/admin/auth-provider"
import { QueryProvider } from "@/components/providers/query-provider"

export const metadata: Metadata = {
  title: {
    default: "Tổng quan quản trị | Gia Thịnh",
    template: "%s | Quản trị Gia Thịnh",
  },
  description: "Khu vực quản lý học viên, lịch đăng ký và nội dung Gia Thịnh.",
  robots: {
    index: false,
    follow: false,
  },
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <QueryProvider>
      <AuthProvider>{children}</AuthProvider>
    </QueryProvider>
  )
}
