"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { useState } from "react"

import { AdminPageHeader, StatusPill } from "@/components/admin/admin-ui"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { FilterBar, FilterSelect } from "@/components/admin/filter-bar"
import {
  initialsOf,
  InstructorSheet,
} from "@/components/admin/instructors/instructor-sheet"
import { Pagination } from "@/components/admin/pagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  INSTRUCTOR_STATUS_LABELS,
  INSTRUCTOR_STATUSES,
} from "@/lib/admin/labels"
import { nameById, useBranchChoice, useStaffOptions } from "@/lib/admin/lookups"
import type { Instructor, Page } from "@/lib/admin/types"
import { useCan } from "@/lib/admin/use-can"
import { useListParams } from "@/lib/admin/use-list-params"
import { apiFetch } from "@/lib/api/client"

const LIMIT = 20
const FILTER_KEYS = ["q", "status", "branchId"] as const

const empty = <span className="text-muted-foreground">—</span>

export function InstructorList() {
  const canCreate = useCan("instructor.create")
  const canUpdate = useCan("instructor.update")
  const { values, page, set, setPage } = useListParams(FILTER_KEYS)
  const { branches, showBranchSelect } = useBranchChoice()
  // Tên tài khoản liên kết: /users/options?role=instructor cần quyền tạo/sửa
  const accounts = useStaffOptions(values.branchId, "instructor", {
    enabled: canCreate || canUpdate,
  })
  // Giữ giáo viên đang xem khi đóng để sheet không đổi nội dung lúc trượt ra
  const [sheet, setSheet] = useState<{
    open: boolean
    instructor?: Instructor
  }>({ open: false })

  const query = { ...values, page, limit: LIMIT, sort: "name" }
  const instructors = useQuery({
    queryKey: ["instructors", query],
    queryFn: ({ signal }) =>
      apiFetch<Page<Instructor>>("/instructors", { query, signal }),
    placeholderData: keepPreviousData,
  })

  const columns: DataTableColumn<Instructor>[] = [
    {
      key: "name",
      header: "Giáo viên",
      cell: (item) => (
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-[11px] font-semibold text-primary"
          >
            {initialsOf(item.name)}
          </span>
          <span className="min-w-0">
            <span className="block font-semibold text-foreground">
              {item.name}
            </span>
            <span className="block text-xs text-muted-foreground">
              {item.phone}
            </span>
          </span>
        </div>
      ),
    },
    {
      key: "specialties",
      header: "Chuyên môn",
      cell: (item) =>
        item.specialties.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {item.specialties.map((code) => (
              <Badge key={code} variant="secondary">
                {code}
              </Badge>
            ))}
          </span>
        ) : (
          empty
        ),
    },
    {
      key: "branch",
      header: "Chi nhánh",
      className: "whitespace-nowrap text-muted-foreground",
      cell: (item) => nameById(branches, item.branchId, "—"),
    },
    {
      key: "account",
      header: "Tài khoản",
      className: "whitespace-nowrap",
      cell: (item) =>
        item.userId
          ? nameById(accounts.data, item.userId, "Đã liên kết")
          : empty,
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (item) => (
        <StatusPill status={INSTRUCTOR_STATUS_LABELS[item.status]} />
      ),
    },
  ]

  return (
    <>
      <AdminPageHeader
        title="Giáo viên"
        action={
          canCreate ? (
            <Button type="button" onClick={() => setSheet({ open: true })}>
              <Plus aria-hidden="true" />
              Thêm giáo viên
            </Button>
          ) : null
        }
      />

      <section className="mt-4 overflow-hidden rounded-xl border border-border/80 bg-card">
        <FilterBar
          search={{
            value: values.q,
            placeholder: "Tìm tên hoặc số điện thoại",
            onChange: (q) => set({ q }),
          }}
        >
          <FilterSelect
            label="Trạng thái"
            items={INSTRUCTOR_STATUSES.map((status) => ({
              value: status,
              label: INSTRUCTOR_STATUS_LABELS[status],
            }))}
            value={values.status}
            onChange={(status) => set({ status })}
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

        {instructors.data ? (
          <p className="border-b border-border/70 px-5 py-2.5 text-[13px] text-muted-foreground">
            {instructors.data.meta.total} giáo viên
          </p>
        ) : null}

        <DataTable
          columns={columns}
          rows={instructors.data?.data}
          rowKey={(item) => item.id}
          isLoading={instructors.isPending}
          error={instructors.error}
          onRetry={() => void instructors.refetch()}
          onRowClick={(item) => setSheet({ open: true, instructor: item })}
          empty="Chưa có giáo viên nào khớp bộ lọc."
        />
        {instructors.data ? (
          <Pagination
            page={instructors.data.meta.page}
            limit={instructors.data.meta.limit}
            total={instructors.data.meta.total}
            onPageChange={setPage}
          />
        ) : null}
      </section>

      <InstructorSheet
        open={sheet.open}
        onOpenChange={(open) => setSheet((current) => ({ ...current, open }))}
        instructor={sheet.instructor}
      />
    </>
  )
}
