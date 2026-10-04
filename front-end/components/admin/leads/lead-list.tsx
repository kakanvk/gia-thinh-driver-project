"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Download, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { AdminPageHeader, StatusPill } from "@/components/admin/admin-ui"
import { useAuth } from "@/components/admin/auth-provider"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { FilterBar } from "@/components/admin/filter-bar"
import { LeadFormSheet } from "@/components/admin/leads/lead-form-sheet"
import { Pagination } from "@/components/admin/pagination"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  formatDate,
  formatTime,
  isOverdue,
  todayVn,
} from "@/lib/admin/datetime"
import {
  LEAD_SOURCE_LABELS,
  LEAD_SOURCES,
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
} from "@/lib/admin/labels"
import {
  nameById,
  useBranchChoice,
  useStaffOptions,
} from "@/lib/admin/lookups"
import type { Lead, Page } from "@/lib/admin/types"
import { useCan } from "@/lib/admin/use-can"
import { useListParams } from "@/lib/admin/use-list-params"
import { apiDownload, apiFetch } from "@/lib/api/client"
import { errorMessage } from "@/lib/api/errors"
import { cn } from "@/lib/utils"

const LIMIT = 20
const FILTER_KEYS = [
  "q",
  "status",
  "branchId",
  "assigneeId",
  "source",
  "followUpDue",
] as const
// Giá trị "Tất cả" cho Select lọc (Base UI không có item rỗng)
const ALL = "all"

type Item = { value: string; label: string }

function FilterSelect({
  label,
  items,
  value,
  onChange,
}: {
  label: string
  items: Item[]
  value: string
  onChange: (value: string) => void
}) {
  const all = [{ value: ALL, label: `${label}: Tất cả` }, ...items]
  return (
    <Select
      items={all}
      value={value || ALL}
      onValueChange={(next) => onChange(!next || next === ALL ? "" : next)}
    >
      <SelectTrigger aria-label={label} className="h-9 bg-background text-[13px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {all.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// "dd/MM HH:mm" cắt từ chuỗi ISO (không phụ thuộc múi giờ máy)
function shortDateTime(iso: string): string {
  return `${formatDate(iso).slice(0, 5)} ${formatTime(iso)}`
}

export function LeadList() {
  const router = useRouter()
  const { user } = useAuth()
  const canCreate = useCan("lead.create")
  const canExport = useCan("lead.export")
  const { values, page, set, setPage } = useListParams(FILTER_KEYS)
  const { branches, showBranchSelect } = useBranchChoice()
  const staff = useStaffOptions()
  const [formOpen, setFormOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const query = { ...values, page, limit: LIMIT, sort: "-createdAt" }
  const leads = useQuery({
    queryKey: ["leads", query],
    queryFn: ({ signal }) =>
      apiFetch<Page<Lead>>("/leads", { query, signal }),
    placeholderData: keepPreviousData,
  })

  async function exportCsv() {
    setExporting(true)
    try {
      await apiDownload(
        "/leads/export",
        Object.fromEntries(Object.entries(values).filter(([, value]) => value)),
        `khach-hang-${todayVn().replaceAll("-", "")}.csv`
      )
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setExporting(false)
    }
  }

  const staffItems: Item[] = [
    ...(user ? [{ value: user.id, label: "Của tôi" }] : []),
    { value: "none", label: "Chưa phân công" },
    ...(staff.data ?? [])
      .filter(
        (option) =>
          option.id !== user?.id &&
          (!values.branchId || option.branchIds.includes(values.branchId))
      )
      .map((option) => ({ value: option.id, label: option.name })),
  ]

  const columns: DataTableColumn<Lead>[] = [
    {
      key: "code",
      header: "Mã",
      className: "whitespace-nowrap font-medium text-navy",
      cell: (lead) => lead.code,
    },
    {
      key: "name",
      header: "Khách",
      cell: (lead) => (
        <div className="min-w-36">
          <p className="font-semibold text-foreground">{lead.name}</p>
          <p className="text-xs text-muted-foreground">{lead.phone}</p>
        </div>
      ),
    },
    {
      key: "course",
      header: "Gói",
      className: "whitespace-nowrap",
      cell: (lead) => lead.courseCode ?? "—",
    },
    {
      key: "branch",
      header: "Chi nhánh",
      className: "whitespace-nowrap",
      cell: (lead) => nameById(branches, lead.branchId, "—"),
    },
    {
      key: "source",
      header: "Nguồn",
      className: "whitespace-nowrap",
      cell: (lead) => LEAD_SOURCE_LABELS[lead.source],
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (lead) => <StatusPill status={LEAD_STATUS_LABELS[lead.status]} />,
    },
    {
      key: "assignee",
      header: "Phụ trách",
      className: "whitespace-nowrap",
      cell: (lead) =>
        lead.assigneeId ? (
          nameById(staff.data, lead.assigneeId, "Nhân viên")
        ) : (
          <span className="text-muted-foreground">Chưa phân công</span>
        ),
    },
    {
      key: "followUp",
      header: "Hẹn gọi lại",
      className: "whitespace-nowrap",
      cell: (lead) =>
        lead.nextFollowUpAt ? (
          <span
            className={cn(
              isOverdue(lead.nextFollowUpAt) &&
                "font-semibold text-destructive"
            )}
          >
            {shortDateTime(lead.nextFollowUpAt)}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "createdAt",
      header: "Ngày tạo",
      className: "whitespace-nowrap text-muted-foreground",
      cell: (lead) => formatDate(lead.createdAt),
    },
  ]

  return (
    <>
      <AdminPageHeader
        title="Khách hàng"
        action={
          <div className="flex flex-wrap gap-2">
            {canExport ? (
              <Button
                type="button"
                variant="outline"
                disabled={exporting}
                onClick={exportCsv}
              >
                <Download aria-hidden="true" />
                Xuất CSV
              </Button>
            ) : null}
            {canCreate ? (
              <Button type="button" onClick={() => setFormOpen(true)}>
                <Plus aria-hidden="true" />
                Thêm khách
              </Button>
            ) : null}
          </div>
        }
      />

      <section className="mt-4 overflow-hidden rounded-xl border border-border/80 bg-card">
        <FilterBar
          search={{
            value: values.q,
            placeholder: "Tìm tên, SĐT hoặc mã khách",
            onChange: (q) => set({ q }),
          }}
        >
          <FilterSelect
            label="Trạng thái"
            items={LEAD_STATUSES.map((status) => ({
              value: status,
              label: LEAD_STATUS_LABELS[status],
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
            label="Phụ trách"
            items={staffItems}
            value={values.assigneeId}
            onChange={(assigneeId) => set({ assigneeId })}
          />
          <FilterSelect
            label="Nguồn"
            items={LEAD_SOURCES.map((source) => ({
              value: source,
              label: LEAD_SOURCE_LABELS[source],
            }))}
            value={values.source}
            onChange={(source) => set({ source })}
          />
          <label className="flex h-9 items-center gap-2 px-1 text-[13px]">
            <Checkbox
              checked={values.followUpDue === "true"}
              onCheckedChange={(checked) =>
                set({ followUpDue: checked ? "true" : "" })
              }
            />
            Cần gọi lại
          </label>
        </FilterBar>

        <DataTable
          columns={columns}
          rows={leads.data?.data}
          rowKey={(lead) => lead.id}
          isLoading={leads.isPending}
          error={leads.error}
          onRetry={() => void leads.refetch()}
          onRowClick={(lead) => router.push(`/admin/khach-hang/${lead.id}`)}
          empty="Chưa có khách hàng nào khớp bộ lọc."
        />
        {leads.data ? (
          <Pagination
            page={leads.data.meta.page}
            limit={leads.data.meta.limit}
            total={leads.data.meta.total}
            onPageChange={setPage}
          />
        ) : null}
      </section>

      <LeadFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={(lead) => router.push(`/admin/khach-hang/${lead.id}`)}
      />
    </>
  )
}
