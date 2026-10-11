import type { Metadata } from "next"
import { Suspense } from "react"

import { ExamList } from "@/components/admin/exams/exam-list"

export const metadata: Metadata = {
  title: "Lịch thi & sát hạch",
}

export default function ExamSchedulePage() {
  return (
    <main id="admin-content" className="p-4">
      <Suspense>
        <ExamList />
      </Suspense>
    </main>
  )
}
