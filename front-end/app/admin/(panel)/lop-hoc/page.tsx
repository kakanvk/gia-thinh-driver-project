import type { Metadata } from "next"
import { Suspense } from "react"

import { ClassList } from "@/components/admin/classes/class-list"

export const metadata: Metadata = {
  title: "Lớp học",
}

export default function ClassesPage() {
  return (
    <main id="admin-content" className="p-4">
      <Suspense>
        <ClassList />
      </Suspense>
    </main>
  )
}
