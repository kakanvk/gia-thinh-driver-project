import type { Metadata } from "next"

import { StudentDetail } from "@/components/admin/students/student-detail"

export const metadata: Metadata = {
  title: "Chi tiết học viên",
}

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <main id="admin-content" className="p-4">
      <StudentDetail id={id} />
    </main>
  )
}
