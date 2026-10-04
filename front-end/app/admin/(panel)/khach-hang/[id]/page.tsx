import type { Metadata } from "next"

import { LeadDetail } from "@/components/admin/leads/lead-detail"

export const metadata: Metadata = {
  title: "Chi tiết khách hàng",
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <main id="admin-content" className="p-4">
      <LeadDetail id={id} />
    </main>
  )
}
