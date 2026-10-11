"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { AdminPageHeader, StatusPill } from "@/components/admin/admin-ui"
import { ClassFormSheet } from "@/components/admin/classes/class-form-sheet"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { FilterBar, FilterSelect } from "@/components/admin/filter-bar"
import { Pagination } from "@/components/admin/pagination"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/admin/datetime"
import { CLASS_STATUS_LABELS, CLASS_STATUSES } from "@/lib/admin/labels"
import {
  nameById,
  useBranchChoice,
  useCourses,
  useInstructorOptions,
} from "@/lib/admin/lookups"
import { classTitle } from "@/lib/admin/training"
import type { Page, TrainingClass } from "@/lib/admin/types"
import { useCan } from "@/lib/admin/use-can"
import { useListParams } from "@/lib/admin/use-list-params"
import { apiFetch } from "@/lib/api/client"

const LIMIT = 20
const FILTER_KEYS = [
  "q",
  "status",
  "branchId",
  "courseId",
  "instructorId",
] as const

// Thanh sĩ số filled/capacity
export function SeatBar({ cls }: { cls: TrainingClass }) {
  const percent =
    cls.capacity > 0 ? Math.min(100, (cls.filled / cls.capacity) * 100) : 0
  return (
    <div className="min-w-16">
      <span className="block font-semibold text-navy tabular-nums">
        {cls.filled}/{cls.capacity}
      </span>
      <span
        role="meter"
        aria-label={`Sĩ số ${cls.code}`}
        aria-valuemin={0}
        aria-valuemax={cls.capacity}
        aria-valuenow={cls.filled}
        className="mt-1 block h-1.5 w-16 overflow-hidden rounded-full bg-muted"
      >
        <span
          className={
            cls.seatsLeft <= 0
              ? "block h-full rounded-full bg-destructive"
              : "block h-full rounded-full bg-primary"
          }
          style={{ width: `${percent}%` }}
        />
      </span>
    </div>
  )
}

export function ClassList() {
  const router = useRouter()
  const canCreate = useCan("class.create")
  // Tài khoản giáo viên không có instructor.read: không lọc theo giáo viên
  const canReadInstructors = useCan("instructor.read")
  const { values, page, set, setPage } = useListParams(FILTER_KEYS)
  const { branches, showBranchSelect } = useBranchChoice()
  const courses = useCourses()
  const instructors = useInstructorOptions(values.branchId, {
    enabled: canReadInstructors,
  })
  const [formOpen, setFormOpen] = useState(false)

  const query = { ...values, page, limit: LIMIT, sort: "-startDate" }
  const classes = useQuery({
    queryKey: ["classes", query],
    queryFn: ({ signal }) =>
      apiFetch<Page<TrainingClass>>("/classes", { query, signal }),
    placeholderData: keepPreviousData,
  })

  const columns: DataTableColumn<TrainingClass>[] = [
    {
      key: "code",
      header: "Mã lớp",
      className: "whitespace-nowrap font-semibold text-navy",
      cell: (cls) => cls.code,
    },
    {
      key: "course",
      header: "Gói",
      className: "whitespace-nowrap",
      cell: (cls) => classTitle(cls),
    },
    {
      key: "branch",
      header: "Chi nhánh",
      className: "whitespace-nowrap",
      cell: (cls) => nameById(branches, cls.branchId, "—"),
    },
    {
      key: "dates",
      header: "Khai giảng – Kết thúc",
      className: "whitespace-nowrap",
      cell: (cls) =>
        `${formatDate(cls.startDate)} – ${formatDate(cls.endDate)}`,
    },
    {
      key: "schedule",
      header: "Lịch học",
      className: "text-muted-foreground",
      cell: (cls) => cls.scheduleText,
    },
    {
      key: "instructor",
      header: "Giáo viên",
      className: "whitespace-nowrap",
      cell: (cls) =>
        cls.instructor?.name ?? (
          <span className="text-muted-foreground">Chưa phân công</span>
        ),
    },
    {
      key: "seats",
      header: "Sĩ số",
      cell: (cls) => <SeatBar cls={cls} />,
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (cls) => <StatusPill status={CLASS_STATUS_LABELS[cls.status]} />,
    },
  ]

  return (
    <>
      <AdminPageHeader
        title="Lớp học"
        action={
          canCreate ? (
            <Button type="button" onClick={() => setFormOpen(true)}>
              <Plus aria-hidden="true" />
              Mở lớp
            </Button>
          ) : null
        }
      />

      <section className="mt-4 overflow-hidden rounded-xl border border-border/80 bg-card">
        <FilterBar
          search={{
            value: values.q,
            placeholder: "Tìm mã lớp",
            onChange: (q) => set({ q }),
          }}
        >
          <FilterSelect
            label="Trạng thái"
            items={CLASS_STATUSES.map((status) => ({
              value: status,
              label: CLASS_STATUS_LABELS[status],
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
              // Giáo viên thuộc chi nhánh cũ không còn trong danh sách lọc
              onChange={(branchId) => set({ branchId, instructorId: "" })}
            />
          ) : null}
          <FilterSelect
            label="Gói"
            items={(courses.data ?? []).map((course) => ({
              value: course.id,
              label: course.code,
            }))}
            value={values.courseId}
            onChange={(courseId) => set({ courseId })}
          />
          {canReadInstructors ? (
            <FilterSelect
              label="Giáo viên"
              items={(instructors.data ?? []).map((item) => ({
                value: item.id,
                label: item.name,
              }))}
              value={values.instructorId}
              onChange={(instructorId) => set({ instructorId })}
            />
          ) : null}
        </FilterBar>

        {classes.data ? (
          <p className="border-b border-border/70 px-5 py-2.5 text-[13px] text-muted-foreground">
            {classes.data.meta.total} lớp
          </p>
        ) : null}

        <DataTable
          columns={columns}
          rows={classes.data?.data}
          rowKey={(cls) => cls.id}
          isLoading={classes.isPending}
          error={classes.error}
          onRetry={() => void classes.refetch()}
          onRowClick={(cls) => router.push(`/admin/lop-hoc/${cls.id}`)}
          empty="Chưa có lớp nào khớp bộ lọc."
        />
        {classes.data ? (
          <Pagination
            page={classes.data.meta.page}
            limit={classes.data.meta.limit}
            total={classes.data.meta.total}
            onPageChange={setPage}
          />
        ) : null}
      </section>

      {canCreate ? (
        <ClassFormSheet
          open={formOpen}
          onOpenChange={setFormOpen}
          onSaved={(cls) => router.push(`/admin/lop-hoc/${cls.id}`)}
        />
      ) : null}
    </>
  )
}
