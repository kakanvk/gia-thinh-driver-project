import type { Metadata } from "next"
import { Suspense } from "react"

import { InstructorList } from "@/components/admin/instructors/instructor-list"

export const metadata: Metadata = {
  title: "Giáo viên",
}

export default function InstructorsPage() {
  return (
    <main id="admin-content" className="p-4">
      <Suspense>
        <InstructorList />
      </Suspense>
    </main>
  )
}
