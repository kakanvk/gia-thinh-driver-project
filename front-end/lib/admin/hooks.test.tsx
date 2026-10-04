import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { makeQueryClient } from "@/components/providers/query-provider"
import { nameById, useBranchChoice } from "@/lib/admin/lookups"
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
