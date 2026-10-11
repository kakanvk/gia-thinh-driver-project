import type { Metadata } from "next"

import { ClassDetail } from "@/components/admin/classes/class-detail"

export const metadata: Metadata = {
  title: "Chi tiết lớp học",
}

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <main id="admin-content" className="p-4">
      <ClassDetail id={id} />
    </main>
  )
}
