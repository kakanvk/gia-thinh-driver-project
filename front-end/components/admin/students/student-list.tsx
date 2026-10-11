"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { AdminPageHeader, StatusPill } from "@/components/admin/admin-ui"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { FilterBar, FilterSelect } from "@/components/admin/filter-bar"
import { Pagination } from "@/components/admin/pagination"
import { StudentFormSheet } from "@/components/admin/students/student-form-sheet"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/admin/datetime"
import { STUDENT_STATUS_LABELS, STUDENT_STATUSES } from "@/lib/admin/labels"
import {
  nameById,
  useBranchChoice,
  useClassOptions,
  useCourses,
} from "@/lib/admin/lookups"
import type { Page, Student } from "@/lib/admin/types"
import { useCan } from "@/lib/admin/use-can"
import { useListParams } from "@/lib/admin/use-list-params"
import { apiFetch } from "@/lib/api/client"

const LIMIT = 20
const FILTER_KEYS = ["q", "status", "branchId", "courseId", "classId"] as const

export function StudentList() {
  const router = useRouter()
  const canCreate = useCan("student.create")
  // Tư vấn viên không có class.read: không tra mã lớp, không lọc theo lớp
  const canReadClasses = useCan("class.read")
  const { values, page, set, setPage } = useListParams(FILTER_KEYS)
  const { branches, showBranchSelect } = useBranchChoice()
  const courses = useCourses()
  const classes = useClassOptions({
    branchId: values.branchId,
    includeFinished: true,
    enabled: canReadClasses,
  })
  const [formOpen, setFormOpen] = useState(false)

  const query = { ...values, page, limit: LIMIT, sort: "-createdAt" }
  const students = useQuery({
    queryKey: ["students", query],
    queryFn: ({ signal }) =>
      apiFetch<Page<Student>>("/students", { query, signal }),
    placeholderData: keepPreviousData,
  })

  function classCell(student: Student) {
    if (!student.classId) {
      return <span className="text-muted-foreground">Chưa xếp lớp</span>
    }
    return (
      classes.data?.find((cls) => cls.id === student.classId)?.code ??
      "Đã xếp lớp"
    )
  }

  const columns: DataTableColumn<Student>[] = [
    {
      key: "code",
      header: "Mã",
      className: "whitespace-nowrap font-medium text-navy",
      cell: (student) => student.code,
    },
    {
      key: "name",
      header: "Học viên",
      cell: (student) => (
        <div className="min-w-36">
          <p className="font-semibold text-foreground">{student.name}</p>
          <p className="text-xs text-muted-foreground">{student.phone}</p>
        </div>
      ),
    },
    {
      key: "course",
      header: "Gói",
      className: "whitespace-nowrap",
      cell: (student) => student.courseCode,
    },
    {
      key: "branch",
      header: "Chi nhánh",
      className: "whitespace-nowrap",
      cell: (student) => nameById(branches, student.branchId, "—"),
    },
    {
      key: "class",
      header: "Lớp",
      className: "whitespace-nowrap",
      cell: classCell,
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (student) => (
        <StatusPill status={STUDENT_STATUS_LABELS[student.status]} />
      ),
    },
    {
      key: "enrolledAt",
      header: "Nhập học",
      className: "whitespace-nowrap text-muted-foreground",
      cell: (student) => formatDate(student.enrolledAt),
    },
  ]

  return (
    <>
      <AdminPageHeader
        title="Học viên"
        action={
          canCreate ? (
            <Button type="button" onClick={() => setFormOpen(true)}>
              <Plus aria-hidden="true" />
              Thêm học viên
            </Button>
          ) : null
        }
      />

      <section className="mt-4 overflow-hidden rounded-xl border border-border/80 bg-card">
        <FilterBar
          search={{
            value: values.q,
            placeholder: "Tìm tên, SĐT hoặc mã học viên",
            onChange: (q) => set({ q }),
          }}
        >
          <FilterSelect
            label="Trạng thái"
            items={STUDENT_STATUSES.map((status) => ({
              value: status,
              label: STUDENT_STATUS_LABELS[status],
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
              // Lớp thuộc chi nhánh cũ không còn trong danh sách lọc
              onChange={(branchId) => set({ branchId, classId: "" })}
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
          {canReadClasses ? (
            <FilterSelect
              label="Lớp"
              items={(classes.data ?? [])
                .filter(
                  (cls) => !values.courseId || cls.courseId === values.courseId
                )
                .map((cls) => ({ value: cls.id, label: cls.code }))}
              value={values.classId}
              onChange={(classId) => set({ classId })}
            />
          ) : null}
        </FilterBar>

        <DataTable
          columns={columns}
          rows={students.data?.data}
          rowKey={(student) => student.id}
          isLoading={students.isPending}
          error={students.error}
          onRetry={() => void students.refetch()}
          onRowClick={(student) => router.push(`/admin/hoc-vien/${student.id}`)}
          empty="Chưa có học viên nào khớp bộ lọc."
        />
        {students.data ? (
          <Pagination
            page={students.data.meta.page}
            limit={students.data.meta.limit}
            total={students.data.meta.total}
            onPageChange={setPage}
          />
        ) : null}
      </section>

      {canCreate ? (
        <StudentFormSheet
          open={formOpen}
          onOpenChange={setFormOpen}
          onSaved={(student) => router.push(`/admin/hoc-vien/${student.id}`)}
        />
      ) : null}
    </>
  )
}
