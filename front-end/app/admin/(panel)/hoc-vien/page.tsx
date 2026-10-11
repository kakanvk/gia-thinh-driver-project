import type { Metadata } from "next"
import { Suspense } from "react"

import { StudentList } from "@/components/admin/students/student-list"

export const metadata: Metadata = {
  title: "Học viên",
}

export default function StudentsPage() {
  return (
    <main id="admin-content" className="p-4">
      <Suspense>
        <StudentList />
      </Suspense>
    </main>
  )
}
