"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Plus, TriangleAlert } from "lucide-react"
import { useState } from "react"

import { AdminPageHeader, StatusPill } from "@/components/admin/admin-ui"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { FilterBar, FilterSelect } from "@/components/admin/filter-bar"
import { Pagination } from "@/components/admin/pagination"
import {
  registrationBadge,
  useVehicleAlerts,
  VehicleAlerts,
} from "@/components/admin/vehicles/vehicle-alerts"
import { VehicleSheet } from "@/components/admin/vehicles/vehicle-sheet"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/admin/datetime"
import { VEHICLE_STATUS_LABELS, VEHICLE_STATUSES } from "@/lib/admin/labels"
import { nameById, useBranchChoice, useCourses } from "@/lib/admin/lookups"
import { transmissionLabel } from "@/lib/admin/training"
import type { Page, Vehicle } from "@/lib/admin/types"
import { useCan } from "@/lib/admin/use-can"
import { useListParams } from "@/lib/admin/use-list-params"
import { apiFetch } from "@/lib/api/client"
import { cn } from "@/lib/utils"

const LIMIT = 20
const FILTER_KEYS = ["q", "status", "branchId", "courseCode"] as const

const numberFormatter = new Intl.NumberFormat("vi-VN")
const empty = <span className="text-muted-foreground">—</span>

function dateCell(iso: string | null) {
  return iso ? formatDate(iso) : empty
}

export function VehicleList() {
  const canCreate = useCan("vehicle.create")
  const { values, page, set, setPage } = useListParams(FILTER_KEYS)
  const { branches, showBranchSelect } = useBranchChoice()
  const courses = useCourses()
  const alerts = useVehicleAlerts()
  // Giữ xe đang xem khi đóng để sheet không đổi nội dung lúc trượt ra
  const [sheet, setSheet] = useState<{ open: boolean; vehicle?: Vehicle }>({
    open: false,
  })

  const query = { ...values, page, limit: LIMIT, sort: "plate" }
  const vehicles = useQuery({
    queryKey: ["vehicles", query],
    queryFn: ({ signal }) =>
      apiFetch<Page<Vehicle>>("/vehicles", { query, signal }),
    placeholderData: keepPreviousData,
  })

  const openVehicle = (vehicle: Vehicle) => setSheet({ open: true, vehicle })

  const columns: DataTableColumn<Vehicle>[] = [
    {
      key: "plate",
      header: "Biển số",
      className: "whitespace-nowrap font-semibold text-foreground tabular-nums",
      cell: (item) => item.plate,
    },
    {
      key: "model",
      header: "Dòng xe",
      className: "text-muted-foreground",
      cell: (item) => item.model,
    },
    {
      key: "course",
      header: "Hạng",
      className: "whitespace-nowrap font-semibold",
      cell: (item) =>
        [item.courseCode, transmissionLabel(item.transmission)]
          .filter(Boolean)
          .join(" · "),
    },
    {
      key: "branch",
      header: "Chi nhánh",
      className: "whitespace-nowrap text-muted-foreground",
      cell: (item) => nameById(branches, item.branchId, "—"),
    },
    {
      key: "odometer",
      header: "Số km",
      className: "whitespace-nowrap tabular-nums",
      cell: (item) => `${numberFormatter.format(item.odometer)} km`,
    },
    {
      key: "datKm",
      header: "Km DAT",
      className: "whitespace-nowrap tabular-nums",
      cell: (item) =>
        item.datKm ? `${numberFormatter.format(item.datKm)} km` : empty,
    },
    {
      key: "lastService",
      header: "BD gần nhất",
      className: "whitespace-nowrap tabular-nums text-muted-foreground",
      cell: (item) => dateCell(item.lastServiceAt),
    },
    {
      key: "nextService",
      header: "BD kế tiếp",
      className: "whitespace-nowrap tabular-nums",
      cell: (item) => dateCell(item.nextServiceAt),
    },
    {
      key: "registration",
      header: "Đăng kiểm",
      className: "whitespace-nowrap",
      cell: (item) => {
        const badge = registrationBadge(alerts.data, item.id)
        return (
          <>
            <span className="block tabular-nums">
              {dateCell(item.registrationExpiresAt)}
            </span>
            {badge ? (
              <span
                className={cn(
                  "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  badge === "Quá hạn"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-highlight/25 text-foreground"
                )}
              >
                <TriangleAlert aria-hidden="true" className="size-3" />
                {badge}
              </span>
            ) : null}
          </>
        )
      },
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (item) => (
        <StatusPill status={VEHICLE_STATUS_LABELS[item.status]} />
      ),
    },
  ]

  return (
    <>
      <AdminPageHeader
        title="Xe tập lái"
        action={
          canCreate ? (
            <Button type="button" onClick={() => setSheet({ open: true })}>
              <Plus aria-hidden="true" />
              Thêm xe
            </Button>
          ) : null
        }
      />

      <VehicleAlerts alerts={alerts.data} onSelect={openVehicle} />

      <section className="mt-4 overflow-hidden rounded-xl border border-border/80 bg-card">
        <FilterBar
          search={{
            value: values.q,
            placeholder: "Tìm biển số hoặc dòng xe",
            onChange: (q) => set({ q }),
          }}
        >
          <FilterSelect
            label="Trạng thái"
            items={VEHICLE_STATUSES.map((status) => ({
              value: status,
              label: VEHICLE_STATUS_LABELS[status],
            }))}
            value={values.status}
            onChange={(status) => set({ status })}
          />
          <FilterSelect
            label="Hạng"
            items={(courses.data ?? []).map((course) => ({
              value: course.code,
              label: course.code,
            }))}
            value={values.courseCode}
            onChange={(courseCode) => set({ courseCode })}
          />
          {showBranchSelect ? (
            <FilterSelect
              label="Chi nhánh"
              items={branches.map((branch) => ({
                value: branch.id,
                label: branch.name,
              }))}
              value={values.branchId}
              onChange={(branchId) => set({ branchId })}
            />
          ) : null}
        </FilterBar>

        {vehicles.data ? (
          <p className="border-b border-border/70 px-5 py-2.5 text-[13px] text-muted-foreground">
            {vehicles.data.meta.total} xe
          </p>
        ) : null}

        <DataTable
          columns={columns}
          rows={vehicles.data?.data}
          rowKey={(item) => item.id}
          isLoading={vehicles.isPending}
          error={vehicles.error}
          onRetry={() => void vehicles.refetch()}
          onRowClick={openVehicle}
          empty="Chưa có xe nào khớp bộ lọc."
        />
        {vehicles.data ? (
          <Pagination
            page={vehicles.data.meta.page}
            limit={vehicles.data.meta.limit}
            total={vehicles.data.meta.total}
            onPageChange={setPage}
          />
        ) : null}
      </section>

      <VehicleSheet
        open={sheet.open}
        onOpenChange={(open) => setSheet((current) => ({ ...current, open }))}
        vehicle={sheet.vehicle}
      />
    </>
  )
}
