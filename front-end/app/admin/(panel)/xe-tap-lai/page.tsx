import type { Metadata } from "next"
import { Suspense } from "react"

import { VehicleList } from "@/components/admin/vehicles/vehicle-list"

export const metadata: Metadata = {
  title: "Xe tập lái",
}

export default function TrainingVehiclesPage() {
  return (
    <main id="admin-content" className="p-4">
      <Suspense>
        <VehicleList />
      </Suspense>
    </main>
  )
}
