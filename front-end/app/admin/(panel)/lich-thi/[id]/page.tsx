import type { Metadata } from "next"

import { ExamDetail } from "@/components/admin/exams/exam-detail"

export const metadata: Metadata = {
  title: "Chi tiết ca thi",
}

export default async function ExamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <main id="admin-content" className="p-4">
      <ExamDetail id={id} />
    </main>
  )
}
