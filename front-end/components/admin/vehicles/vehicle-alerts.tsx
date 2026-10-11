"use client"

import { useQuery } from "@tanstack/react-query"
import { TriangleAlert } from "lucide-react"

import { formatDate } from "@/lib/admin/datetime"
import type {
  Vehicle,
  VehicleAlert,
  VehicleAlertReason,
} from "@/lib/admin/types"
import { apiData } from "@/lib/api/client"
import { cn } from "@/lib/utils"

// Cửa sổ cảnh báo: hạn bảo dưỡng/đăng kiểm trong 30 ngày tới hoặc đã quá
const ALERT_DAYS = 30

const REASON_LABELS: Record<VehicleAlertReason["type"], string> = {
  service: "Bảo dưỡng",
  registration: "Đăng kiểm",
}

export function useVehicleAlerts() {
  return useQuery({
    queryKey: ["vehicle-alerts"],
    queryFn: ({ signal }) =>
      apiData<VehicleAlert[]>("/vehicles/alerts", {
        query: { days: ALERT_DAYS },
        signal,
      }),
  })
}

// "quá hạn 3 ngày" | "còn 10 ngày (21/10/2026)"
export function dueText(reason: VehicleAlertReason): string {
  return reason.overdue
    ? `quá hạn ${Math.abs(reason.daysLeft)} ngày`
    : `còn ${reason.daysLeft} ngày (${formatDate(reason.dueAt)})`
}

// Badge cột Đăng kiểm: theo cảnh báo đăng kiểm của xe (nếu có)
export function registrationBadge(
  alerts: VehicleAlert[] | undefined,
  vehicleId: string
): "Quá hạn" | "Sắp đến hạn" | null {
  const reason = alerts
    ?.find((alert) => alert.vehicle.id === vehicleId)
    ?.reasons.find((item) => item.type === "registration")
  if (!reason) return null
  return reason.overdue ? "Quá hạn" : "Sắp đến hạn"
}

export function VehicleAlerts({
  alerts,
  onSelect,
}: {
  alerts: VehicleAlert[] | undefined
  onSelect: (vehicle: Vehicle) => void
}) {
  if (!alerts || alerts.length === 0) return null

  return (
    <section
      aria-labelledby="vehicle-alerts-title"
      className="mt-4 rounded-xl border border-highlight/60 bg-highlight/10 px-4 py-3"
    >
      <h2
        id="vehicle-alerts-title"
        className="flex items-center gap-2 text-[13px] font-semibold text-foreground"
      >
        <TriangleAlert aria-hidden="true" className="size-4" />
        Cảnh báo hạn xe
      </h2>
      <ul className="mt-2 flex flex-col gap-1">
        {alerts.flatMap(({ vehicle, reasons }) =>
          reasons.map((reason) => (
            <li key={`${vehicle.id}-${reason.type}`}>
              <button
                type="button"
                className={cn(
                  "text-left text-[13px] hover:underline",
                  reason.overdue
                    ? "font-medium text-destructive"
                    : "text-foreground"
                )}
                onClick={() => onSelect(vehicle)}
              >
                <span className="font-semibold tabular-nums">
                  {vehicle.plate}
                </span>
                {` — ${REASON_LABELS[reason.type]}: ${dueText(reason)}`}
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}
