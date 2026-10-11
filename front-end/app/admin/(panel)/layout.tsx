import { AdminGuard } from "@/components/admin/admin-guard"

export default function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminGuard>{children}</AdminGuard>
}
