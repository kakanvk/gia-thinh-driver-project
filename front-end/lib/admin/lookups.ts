"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import { useAuth } from "@/components/admin/auth-provider"
import type {
  BranchOption,
  CourseOption,
  Instructor,
  Page,
  StaffOption,
  TrainingClass,
} from "@/lib/admin/types"
import { apiData, apiFetch } from "@/lib/api/client"

const LOOKUP_STALE_MS = 10 * 60 * 1000

export function useBranches() {
  return useQuery({
    queryKey: ["lookup", "branches"],
    queryFn: () =>
      apiFetch<Page<BranchOption>>("/branches", { query: { limit: 100 } }).then(
        (res) => res.data
      ),
    staleTime: LOOKUP_STALE_MS,
  })
}

export function useCourses() {
  return useQuery({
    queryKey: ["lookup", "courses"],
    queryFn: () =>
      apiFetch<Page<CourseOption>>("/courses", { query: { limit: 100 } }).then(
        (res) => res.data
      ),
    staleTime: LOOKUP_STALE_MS,
  })
}

// Không có role: nhân viên phụ trách khách/lịch hẹn; role=instructor: tài
// khoản giáo viên để liên kết (cần quyền instructor.create/update)
export function useStaffOptions(branchId?: string, role?: "instructor") {
  return useQuery({
    queryKey: ["lookup", "staff", branchId || "all", role ?? "staff"],
    queryFn: () =>
      apiData<StaffOption[]>("/users/options", {
        query: { branchId: branchId || undefined, role },
      }),
    staleTime: LOOKUP_STALE_MS,
  })
}

// Danh sách chọn đổi theo thao tác của nhân viên (sĩ số, trạng thái) nên cache
// ngắn; key bắt đầu bằng tên tài nguyên để mutation của màn đó làm mới luôn
const TRAINING_OPTIONS_STALE_MS = 30 * 1000

export function useInstructorOptions(branchId?: string) {
  return useQuery({
    queryKey: ["instructors", "options", branchId || "all"],
    queryFn: () =>
      apiFetch<Page<Instructor>>("/instructors", {
        query: {
          status: "active",
          limit: 100,
          branchId: branchId || undefined,
        },
      }).then((res) => res.data),
    staleTime: TRAINING_OPTIONS_STALE_MS,
  })
}

// Lớp chưa kết thúc theo chi nhánh/gói (chọn lớp cho học viên, tra mã lớp)
export function useClassOptions({
  branchId,
  courseId,
}: { branchId?: string; courseId?: string } = {}) {
  return useQuery({
    queryKey: [
      "classes",
      "options",
      { branchId: branchId || "", courseId: courseId || "" },
    ],
    queryFn: () =>
      apiFetch<Page<TrainingClass>>("/classes", {
        query: {
          branchId: branchId || undefined,
          courseId: courseId || undefined,
          limit: 100,
        },
      }).then((res) => res.data.filter((cls) => cls.status !== "finished")),
    staleTime: TRAINING_OPTIONS_STALE_MS,
  })
}

export function nameById<T extends { id: string; name: string }>(
  list: T[] | undefined,
  id: string | null | undefined,
  fallback = ""
): string {
  if (!id) return fallback
  return list?.find((item) => item.id === id)?.name ?? fallback
}

// super_admin: chưa chọn sẵn, luôn hiện ô chọn; nhân viên: chi nhánh đầu tiên
// của mình, chỉ hiện ô chọn khi thuộc nhiều chi nhánh
export function useBranchChoice(): {
  branches: BranchOption[]
  defaultBranchId: string
  showBranchSelect: boolean
} {
  const { user } = useAuth()
  const { data } = useBranches()
  const isAdmin = user?.role === "super_admin"
  const branchIds = useMemo(() => user?.branchIds ?? [], [user])

  const branches = useMemo(() => {
    const all = data ?? []
    return isAdmin ? all : all.filter((branch) => branchIds.includes(branch.id))
  }, [data, isAdmin, branchIds])

  return {
    branches,
    defaultBranchId: isAdmin ? "" : (branchIds[0] ?? ""),
    showBranchSelect: isAdmin || branchIds.length > 1,
  }
}
