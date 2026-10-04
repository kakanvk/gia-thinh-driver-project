import type { Metadata } from "next"
import { Suspense } from "react"

import { LeadList } from "@/components/admin/leads/lead-list"

export const metadata: Metadata = {
  title: "Khách hàng",
}

export default function LeadsPage() {
  return (
    <main id="admin-content" className="p-4">
      <Suspense>
        <LeadList />
      </Suspense>
    </main>
  )
}
