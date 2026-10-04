import type { Metadata } from "next"
import { Suspense } from "react"

import { AppointmentCalendar } from "@/components/admin/appointments/appointment-calendar"

export const metadata: Metadata = {
  title: "Lịch hẹn",
}

export default function AppointmentsPage() {
  return (
    <main id="admin-content" className="p-4">
      <Suspense>
        <AppointmentCalendar />
      </Suspense>
    </main>
  )
}
