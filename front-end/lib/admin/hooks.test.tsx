import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { makeQueryClient } from "@/components/providers/query-provider"
import {
  nameById,
  useBranchChoice,
  useClassOptions,
  useInstructorOptions,
  useStaffOptions,
} from "@/lib/admin/lookups"
import { useListParams } from "@/lib/admin/use-list-params"
import { setAccessToken } from "@/lib/api/session"
import { jsonResponse, mockFetch } from "@/test/fetch-mock"

const replace = vi.fn()
let search = "status=new&page=3"
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/admin/khach-hang",
  useSearchParams: () => new URLSearchParams(search),
}))
let auth: Record<string, unknown>
vi.mock("@/components/admin/auth-provider", () => ({ useAuth: () => auth }))

beforeEach(() => {
  replace.mockClear()
  search = "status=new&page=3"
  setAccessToken("t")
})

describe("useListParams", () => {
  it("đọc URL, đổi bộ lọc về trang 1 và bỏ giá trị rỗng", () => {
    const { result } = renderHook(() => useListParams(["q", "status"] as const))
    expect(result.current.values).toEqual({ q: "", status: "new" })
    expect(result.current.page).toBe(3)
    act(() => result.current.set({ q: "an", status: "" }))
    expect(replace).toHaveBeenCalledWith("/admin/khach-hang?q=an", {
      scroll: false,
    })
    act(() => result.current.setPage(2))
    expect(replace).toHaveBeenLastCalledWith(
      "/admin/khach-hang?status=new&page=2",
      { scroll: false }
    )
  })
})

describe("lookups", () => {
  it("nameById", () => {
    expect(nameById([{ id: "1", name: "Tân Ngãi" }], "1")).toBe("Tân Ngãi")
    expect(nameById([], "x", "—")).toBe("—")
    expect(nameById(undefined, null, "Chưa phân công")).toBe("Chưa phân công")
  })

  it("chi nhánh mặc định: nhân viên một chi nhánh thì ẩn ô chọn; quản trị viên phải chọn", async () => {
    mockFetch({
      "GET /branches": () =>
        jsonResponse(200, {
          data: [
            { id: "b1", name: "Tân Ngãi", slug: "tan-ngai", officeName: "VP1" },
            {
              id: "b2",
              name: "Vũng Liêm",
              slug: "vung-liem",
              officeName: "VP VL",
            },
          ],
          meta: { page: 1, limit: 100, total: 2 },
        }),
    })
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={makeQueryClient()}>
        {children}
      </QueryClientProvider>
    )
    auth = { user: { role: "consultant", branchIds: ["b2"] }, permissions: [] }
    const staff = renderHook(() => useBranchChoice(), { wrapper })
    // Nhân viên chỉ thấy chi nhánh của mình
    await waitFor(() => expect(staff.result.current.branches).toHaveLength(1))
    expect(staff.result.current.branches[0].id).toBe("b2")
    expect(staff.result.current).toMatchObject({
      defaultBranchId: "b2",
      showBranchSelect: false,
    })
    auth = { user: { role: "super_admin", branchIds: [] }, permissions: ["*"] }
    const admin = renderHook(() => useBranchChoice(), { wrapper })
    await waitFor(() => expect(admin.result.current.branches).toHaveLength(2))
    expect(admin.result.current).toMatchObject({
      defaultBranchId: "",
      showBranchSelect: true,
    })
  })
})

describe("lookups đào tạo", () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={makeQueryClient()}>
      {children}
    </QueryClientProvider>
  )
  const urlOf = (fn: { mock: { calls: unknown[][] } }, index = 0) =>
    new URL(String(fn.mock.calls[index][0]), "http://localhost")

  it("useInstructorOptions: giáo viên đang hoạt động theo chi nhánh", async () => {
    const { fn } = mockFetch({
      "GET /instructors": () =>
        jsonResponse(200, {
          data: [{ id: "i1", name: "Thầy Hùng" }],
          meta: { page: 1, limit: 100, total: 1 },
        }),
    })
    const { result } = renderHook(() => useInstructorOptions("b1"), {
      wrapper,
    })
    await waitFor(() => expect(result.current.data).toHaveLength(1))
    const url = urlOf(fn)
    expect(url.searchParams.get("status")).toBe("active")
    expect(url.searchParams.get("limit")).toBe("100")
    expect(url.searchParams.get("branchId")).toBe("b1")
  })

  it("useClassOptions: lọc chi nhánh + gói, bỏ lớp đã kết thúc", async () => {
    const { fn } = mockFetch({
      "GET /classes": () =>
        jsonResponse(200, {
          data: [
            { id: "k1", code: "B-01", status: "enrolling" },
            { id: "k2", code: "B-02", status: "finished" },
            { id: "k3", code: "B-03", status: "ongoing" },
          ],
          meta: { page: 1, limit: 100, total: 3 },
        }),
    })
    const { result } = renderHook(
      () => useClassOptions({ branchId: "b1", courseId: "c1" }),
      { wrapper }
    )
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data?.map((cls) => cls.id)).toEqual(["k1", "k3"])
    const url = urlOf(fn)
    expect(url.pathname.endsWith("/classes")).toBe(true)
    expect(url.searchParams.get("branchId")).toBe("b1")
    expect(url.searchParams.get("courseId")).toBe("c1")
    expect(url.searchParams.get("limit")).toBe("100")
  })

  it("useStaffOptions role=instructor: tài khoản giáo viên theo chi nhánh", async () => {
    const { fn } = mockFetch({
      "GET /users/options": () =>
        jsonResponse(200, {
          data: [{ id: "u1", name: "GV A", role: "instructor", branchIds: [] }],
        }),
    })
    const { result } = renderHook(() => useStaffOptions("b1", "instructor"), {
      wrapper,
    })
    await waitFor(() => expect(result.current.data).toHaveLength(1))
    const url = urlOf(fn)
    expect(url.searchParams.get("role")).toBe("instructor")
    expect(url.searchParams.get("branchId")).toBe("b1")
  })
})
