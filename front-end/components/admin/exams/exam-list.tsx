"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { AdminPageHeader, StatusPill } from "@/components/admin/admin-ui"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { ExamFormSheet } from "@/components/admin/exams/exam-form-sheet"
import { FilterBar, FilterSelect } from "@/components/admin/filter-bar"
import { Pagination } from "@/components/admin/pagination"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatDate } from "@/lib/admin/datetime"
import {
  EXAM_STATUS_LABELS,
  EXAM_STATUSES,
  EXAM_TYPE_LABELS,
  EXAM_TYPES,
} from "@/lib/admin/labels"
import { nameById, useBranchChoice, useCourses } from "@/lib/admin/lookups"
import { formatPassRate, passRate } from "@/lib/admin/training"
import type { ExamSession, Page } from "@/lib/admin/types"
import { useCan } from "@/lib/admin/use-can"
import { useListParams } from "@/lib/admin/use-list-params"
import { apiFetch } from "@/lib/api/client"

const LIMIT = 20
const FILTER_KEYS = [
  "q",
  "type",
  "status",
  "branchId",
  "courseId",
  "from",
  "to",
] as const

const empty = <span className="text-muted-foreground">—</span>

function DateFilter({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Input
      type="date"
      aria-label={label}
      title={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 bg-background text-[13px] sm:w-40"
    />
  )
}

export function ExamList() {
  const router = useRouter()
  const canCreate = useCan("exam.create")
  const { values, page, set, setPage } = useListParams(FILTER_KEYS)
  const { branches, showBranchSelect } = useBranchChoice()
  const courses = useCourses()
  const [formOpen, setFormOpen] = useState(false)

  const query = { ...values, page, limit: LIMIT, sort: "-date" }
  const exams = useQuery({
    queryKey: ["exams", query],
    queryFn: ({ signal }) =>
      apiFetch<Page<ExamSession>>("/exams", { query, signal }),
    placeholderData: keepPreviousData,
  })

  const columns: DataTableColumn<ExamSession>[] = [
    {
      key: "code",
      header: "Mã ca",
      className: "whitespace-nowrap font-semibold text-navy",
      cell: (exam) => exam.code,
    },
    {
      key: "type",
      header: "Loại",
      className: "whitespace-nowrap",
      cell: (exam) => EXAM_TYPE_LABELS[exam.type],
    },
    {
      key: "course",
      header: "Gói",
      className: "whitespace-nowrap",
      cell: (exam) => exam.courseCode,
    },
    {
      key: "branch",
      header: "Chi nhánh",
      className: "whitespace-nowrap",
      cell: (exam) => nameById(branches, exam.branchId, "—"),
    },
    {
      key: "date",
      header: "Ngày thi",
      className: "whitespace-nowrap",
      cell: (exam) => formatDate(exam.date),
    },
    {
      key: "location",
      header: "Địa điểm",
      className: "text-muted-foreground",
      cell: (exam) => exam.location ?? empty,
    },
    {
      key: "candidates",
      header: "Thí sinh",
      className: "font-semibold text-navy tabular-nums",
      cell: (exam) => exam.stats.candidates,
    },
    {
      key: "results",
      header: "Đậu/Trượt/Vắng",
      className: "whitespace-nowrap tabular-nums",
      cell: (exam) =>
        `${exam.stats.passed} / ${exam.stats.failed} / ${exam.stats.absent}`,
    },
    {
      key: "passRate",
      header: "Tỷ lệ đậu",
      className: "whitespace-nowrap font-semibold text-navy tabular-nums",
      cell: (exam) => {
        const rate = passRate(exam.stats)
        return rate === null ? empty : formatPassRate(rate)
      },
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (exam) => <StatusPill status={EXAM_STATUS_LABELS[exam.status]} />,
    },
  ]

  return (
    <>
      <AdminPageHeader
        title="Lịch thi & sát hạch"
        action={
          canCreate ? (
            <Button type="button" onClick={() => setFormOpen(true)}>
              <Plus aria-hidden="true" />
              Xếp ca thi
            </Button>
          ) : null
        }
      />

      <section className="mt-4 overflow-hidden rounded-xl border border-border/80 bg-card">
        <FilterBar
          search={{
            value: values.q,
            placeholder: "Tìm mã ca thi",
            onChange: (q) => set({ q }),
          }}
        >
          <FilterSelect
            label="Loại"
            items={EXAM_TYPES.map((type) => ({
              value: type,
              label: EXAM_TYPE_LABELS[type],
            }))}
            value={values.type}
            onChange={(type) => set({ type })}
          />
          <FilterSelect
            label="Trạng thái"
            items={EXAM_STATUSES.map((status) => ({
              value: status,
              label: EXAM_STATUS_LABELS[status],
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
          <FilterSelect
            label="Gói"
            items={(courses.data ?? []).map((course) => ({
              value: course.id,
              label: course.code,
            }))}
            value={values.courseId}
            onChange={(courseId) => set({ courseId })}
          />
          <DateFilter
            label="Từ ngày"
            value={values.from}
            onChange={(from) => set({ from })}
          />
          <DateFilter
            label="Đến ngày"
            value={values.to}
            onChange={(to) => set({ to })}
          />
        </FilterBar>

        {exams.data ? (
          <p className="border-b border-border/70 px-5 py-2.5 text-[13px] text-muted-foreground">
            {exams.data.meta.total} ca thi
          </p>
        ) : null}

        <DataTable
          columns={columns}
          rows={exams.data?.data}
          rowKey={(exam) => exam.id}
          isLoading={exams.isPending}
          error={exams.error}
          onRetry={() => void exams.refetch()}
          onRowClick={(exam) => router.push(`/admin/lich-thi/${exam.id}`)}
          empty="Chưa có ca thi nào khớp bộ lọc."
        />
        {exams.data ? (
          <Pagination
            page={exams.data.meta.page}
            limit={exams.data.meta.limit}
            total={exams.data.meta.total}
            onPageChange={setPage}
          />
        ) : null}
      </section>

      {canCreate ? (
        <ExamFormSheet
          open={formOpen}
          onOpenChange={setFormOpen}
          onSaved={(exam) => router.push(`/admin/lich-thi/${exam.id}`)}
        />
      ) : null}
    </>
  )
}
