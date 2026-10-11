import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { InstructorList } from "@/components/admin/instructors/instructor-list"
import { makeQueryClient } from "@/components/providers/query-provider"
import type { Instructor, InstructorStats } from "@/lib/admin/types"
import { setAccessToken } from "@/lib/api/session"
import { canAccess } from "@/lib/auth/routes"
import { jsonResponse, mockFetch } from "@/test/fetch-mock"

const { toastSuccess, toastError, replace, push } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
}))
vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}))

let search = ""
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => "/admin/giao-vien",
  useSearchParams: () => new URLSearchParams(search),
}))

let auth: Record<string, unknown>
vi.mock("@/components/admin/auth-provider", () => ({ useAuth: () => auth }))

const manager = {
  id: "u2",
  name: "Lê Quản Lý",
  username: "quanly",
  phone: "0779666665",
  role: "branch_manager",
  branchIds: ["b1"],
  status: "active",
}
const MANAGER_PERMISSIONS = ["instructor.*", "class.*"]

function instructor(overrides: Partial<Instructor> = {}): Instructor {
  return {
    id: "i1",
    name: "Nguyễn Hoàng Đức",
    phone: "0907226880",
    userId: "u9",
    specialties: ["B", "C1"],
    branchId: "b1",
    status: "active",
    note: null,
    createdAt: "2026-10-01T09:00:00+07:00",
    updatedAt: "2026-10-01T09:00:00+07:00",
    ...overrides,
  }
}

function stats(overrides: Partial<InstructorStats["official"]> = {}) {
  return {
    classes: { total: 3, active: 1 },
    students: 42,
    official: { passed: 0, failed: 0, absent: 2, passRate: null, ...overrides },
  } satisfies InstructorStats
}

const instructorsPage = {
  data: [
    instructor(),
    instructor({
      id: "i2",
      name: "Trần Quốc Hưng",
      phone: "0932771205",
      userId: null,
      specialties: [],
      status: "on_leave",
    }),
  ],
  meta: { page: 1, limit: 20, total: 2 },
}

const lookups = {
  "GET /branches": () =>
    jsonResponse(200, {
      data: [
        { id: "b1", name: "Tân Ngãi", slug: "tan-ngai", officeName: "VP1" },
      ],
      meta: { page: 1, limit: 100, total: 1 },
    }),
  "GET /users/options": () =>
    jsonResponse(200, {
      data: [
        {
          id: "u9",
          name: "Tài khoản Đức",
          role: "instructor",
          branchIds: ["b1"],
        },
        {
          id: "u10",
          name: "Tài khoản Hưng",
          role: "instructor",
          branchIds: ["b1"],
        },
      ],
    }),
}

function urlsOf(fn: ReturnType<typeof mockFetch>["fn"], path: string): URL[] {
  return fn.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === `/api/v1${path}`)
}

function bodyOf(
  calls: ReturnType<typeof mockFetch>["calls"],
  key: string,
  index = 0
): unknown {
  const call = calls.filter((item) => item.key === key)[index]
  return call ? JSON.parse(String(call.init.body)) : undefined
}

function countOf(calls: ReturnType<typeof mockFetch>["calls"], key: string) {
  return calls.filter((call) => call.key === key).length
}

function renderWithClient(ui: React.ReactElement) {
  const client = makeQueryClient()
  client.setDefaultOptions({ queries: { retry: false } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

async function choose(trigger: HTMLElement, option: string | RegExp) {
  await userEvent.click(trigger)
  await userEvent.click(await screen.findByRole("option", { name: option }))
}

function setup(extra: Parameters<typeof mockFetch>[0] = {}) {
  return mockFetch({
    "GET /instructors": () => jsonResponse(200, instructorsPage),
    "GET /instructors/i1/stats": () => jsonResponse(200, { data: stats() }),
    ...lookups,
    ...extra,
  })
}

async function openRow(name: string) {
  await userEvent.click(await screen.findByText(name))
  return screen.findByRole("dialog")
}

beforeEach(() => {
  toastSuccess.mockClear()
  toastError.mockClear()
  replace.mockClear()
  push.mockClear()
  search = ""
  setAccessToken("t1")
  auth = { user: manager, permissions: MANAGER_PERMISSIONS }
})

describe("InstructorList", () => {
  it("gọi /instructors theo bộ lọc trên URL, hiện chuyên môn và tài khoản", async () => {
    search = "status=active&q=duc&page=2"
    const { fn } = setup()
    renderWithClient(<InstructorList />)

    expect(await screen.findByText("Nguyễn Hoàng Đức")).toBeInTheDocument()
    const [url] = urlsOf(fn, "/instructors")
    expect(Object.fromEntries(url.searchParams)).toEqual({
      status: "active",
      q: "duc",
      page: "2",
      limit: "20",
      sort: "name",
    })

    const row = screen.getByText("Nguyễn Hoàng Đức").closest("tr")!
    expect(within(row).getByText("HĐ")).toBeInTheDocument()
    expect(within(row).getByText("0907226880")).toBeInTheDocument()
    expect(within(row).getByText("B")).toBeInTheDocument()
    expect(within(row).getByText("C1")).toBeInTheDocument()
    expect(within(row).getByText("Tân Ngãi")).toBeInTheDocument()
    expect(await within(row).findByText("Tài khoản Đức")).toBeInTheDocument()
    expect(within(row).getByText("Đang hoạt động")).toBeInTheDocument()

    const other = screen.getByText("Trần Quốc Hưng").closest("tr")!
    expect(within(other).getByText("Tạm nghỉ")).toBeInTheDocument()
    expect(within(other).getAllByText("—").length).toBeGreaterThan(0)

    const [options] = urlsOf(fn, "/users/options")
    expect(options.searchParams.get("role")).toBe("instructor")
    expect(screen.getByText("2 giáo viên")).toBeInTheDocument()
    expect(
      screen.queryByRole("columnheader", { name: /Giờ dạy/ })
    ).not.toBeInTheDocument()
  })

  it("lọc trạng thái ghi lên URL và về trang 1", async () => {
    search = "page=3"
    setup()
    renderWithClient(<InstructorList />)
    await screen.findByText("Nguyễn Hoàng Đức")

    await choose(
      screen.getByRole("combobox", { name: /Trạng thái/ }),
      "Nghỉ việc"
    )
    expect(replace).toHaveBeenCalledWith("/admin/giao-vien?status=inactive", {
      scroll: false,
    })
  })

  it("sheet chi tiết hiện thống kê, tỷ lệ đậu null → —", async () => {
    setup()
    renderWithClient(<InstructorList />)
    const dialog = await openRow("Nguyễn Hoàng Đức")

    const classes = await within(dialog).findByText("3/1")
    expect(classes.closest("div")).toHaveTextContent("Lớp")
    expect(within(dialog).getByText("42")).toBeInTheDocument()
    expect(within(dialog).getByText("0/0/2")).toBeInTheDocument()
    const rate = within(dialog).getByText("Tỷ lệ đậu").closest("div")!
    expect(rate).toHaveTextContent("—")
  })

  it("tỷ lệ đậu có số → hiện phần trăm", async () => {
    setup({
      "GET /instructors/i1/stats": () =>
        jsonResponse(200, {
          data: stats({ passed: 5, failed: 2, passRate: 71.4 }),
        }),
    })
    renderWithClient(<InstructorList />)
    const dialog = await openRow("Nguyễn Hoàng Đức")
    expect(await within(dialog).findByText("71,4%")).toBeInTheDocument()
  })

  it("tài khoản liên kết theo chi nhánh, chọn Không liên kết → userId null", async () => {
    const { fn, calls } = setup({
      "PATCH /instructors/i1": () =>
        jsonResponse(200, { data: instructor({ userId: null }) }),
    })
    renderWithClient(<InstructorList />)
    const dialog = await openRow("Nguyễn Hoàng Đức")

    const account = within(dialog).getByRole("combobox", {
      name: /Tài khoản liên kết/,
    })
    await waitFor(() =>
      expect(
        urlsOf(fn, "/users/options").some(
          (url) =>
            url.searchParams.get("role") === "instructor" &&
            url.searchParams.get("branchId") === "b1"
        )
      ).toBe(true)
    )
    await waitFor(() => expect(account).toHaveTextContent("Tài khoản Đức"))
    await choose(account, "Không liên kết")
    await userEvent.click(within(dialog).getByRole("button", { name: "Lưu" }))

    await waitFor(() =>
      expect(bodyOf(calls, "PATCH /instructors/i1")).toEqual({ userId: null })
    )
    expect(toastSuccess).toHaveBeenCalledWith(
      "Đã lưu giáo viên Nguyễn Hoàng Đức"
    )
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
  })

  it("chuyển Nghỉ việc khi còn lớp → lỗi dưới ô Trạng thái, sheet vẫn mở", async () => {
    const message =
      "Giáo viên còn phụ trách lớp đang hoạt động, hãy đổi giáo viên cho các lớp đó trước"
    const { calls } = setup({
      "PATCH /instructors/i1": () =>
        jsonResponse(409, { error: { code: "CONFLICT", message } }),
    })
    renderWithClient(<InstructorList />)
    const dialog = await openRow("Nguyễn Hoàng Đức")

    const status = within(dialog).getByRole("combobox", { name: /Trạng thái/ })
    await choose(status, "Nghỉ việc")
    await userEvent.click(within(dialog).getByRole("button", { name: "Lưu" }))

    const error = await within(dialog).findByText(message)
    expect(bodyOf(calls, "PATCH /instructors/i1")).toEqual({
      status: "inactive",
    })
    expect(status).toHaveAttribute("aria-describedby", error.id)
    expect(status).toHaveAttribute("aria-invalid", "true")
    expect(toastError).not.toHaveBeenCalled()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("thêm giáo viên: chuyên môn in hoa → POST /instructors", async () => {
    const { calls } = setup({
      "POST /instructors": () =>
        jsonResponse(201, {
          data: instructor({ id: "i3", name: "Võ Thị Hồng", userId: null }),
        }),
    })
    renderWithClient(<InstructorList />)
    await screen.findByText("Nguyễn Hoàng Đức")

    await userEvent.click(
      screen.getByRole("button", { name: "Thêm giáo viên" })
    )
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).queryByText("Tỷ lệ đậu")).not.toBeInTheDocument()
    await userEvent.type(
      within(dialog).getByLabelText(/Họ và tên/),
      "Võ Thị Hồng"
    )
    await userEvent.type(
      within(dialog).getByLabelText(/Số điện thoại/),
      "0988214630"
    )
    const specialties = within(dialog).getByLabelText(/Chuyên môn/)
    await userEvent.type(specialties, "b{Enter}")
    await userEvent.type(specialties, "c1{Enter}")
    await userEvent.type(specialties, "b{Enter}")
    expect(
      within(dialog).getByRole("button", { name: "Bỏ hạng B" })
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole("button", { name: "Bỏ hạng C1" })
    ).toBeInTheDocument()

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Thêm giáo viên" })
    )
    await waitFor(() =>
      expect(bodyOf(calls, "POST /instructors")).toEqual({
        name: "Võ Thị Hồng",
        phone: "0988214630",
        branchId: "b1",
        specialties: ["B", "C1"],
        status: "active",
      })
    )
    expect(toastSuccess).toHaveBeenCalledWith("Đã thêm giáo viên Võ Thị Hồng")
  })

  it("thêm giáo viên thiếu trường bắt buộc → lỗi tại ô, không gọi API", async () => {
    const { calls } = setup()
    renderWithClient(<InstructorList />)
    await screen.findByText("Nguyễn Hoàng Đức")
    await userEvent.click(
      screen.getByRole("button", { name: "Thêm giáo viên" })
    )
    const dialog = await screen.findByRole("dialog")
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Thêm giáo viên" })
    )
    expect(within(dialog).getByText("Nhập họ và tên")).toBeInTheDocument()
    expect(within(dialog).getByText("Nhập số điện thoại")).toBeInTheDocument()
    expect(countOf(calls, "POST /instructors")).toBe(0)
  })

  it("xoá giáo viên → DELETE, đóng sheet", async () => {
    const { calls } = setup({
      "DELETE /instructors/i1": () => jsonResponse(204),
    })
    renderWithClient(<InstructorList />)
    const dialog = await openRow("Nguyễn Hoàng Đức")
    await userEvent.click(within(dialog).getByRole("button", { name: "Xoá" }))
    const confirm = await screen.findByRole("alertdialog")
    await userEvent.click(
      within(confirm).getByRole("button", { name: "Xoá giáo viên" })
    )

    await waitFor(() =>
      expect(countOf(calls, "DELETE /instructors/i1")).toBe(1)
    )
    expect(toastSuccess).toHaveBeenCalledWith(
      "Đã xoá giáo viên Nguyễn Hoàng Đức"
    )
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
  })

  it("chỉ có instructor.read: không nút thêm/lưu/xoá, không gọi users/options", async () => {
    auth = { user: manager, permissions: ["instructor.read"] }
    const { calls } = setup()
    renderWithClient(<InstructorList />)
    await screen.findByText("Nguyễn Hoàng Đức")
    expect(
      screen.queryByRole("button", { name: "Thêm giáo viên" })
    ).not.toBeInTheDocument()

    const dialog = await openRow("Nguyễn Hoàng Đức")
    expect(await within(dialog).findByText("3/1")).toBeInTheDocument()
    expect(
      within(dialog).queryByRole("button", { name: "Lưu" })
    ).not.toBeInTheDocument()
    expect(
      within(dialog).queryByRole("button", { name: "Xoá" })
    ).not.toBeInTheDocument()
    expect(countOf(calls, "GET /users/options")).toBe(0)
  })

  it("tư vấn viên không có instructor.read → trang bị chặn", () => {
    const consultant = ["lead.read", "lead.create", "appointment.read"]
    expect(canAccess("/admin/giao-vien", consultant)).toBe(false)
    expect(canAccess("/admin/giao-vien", ["instructor.read"])).toBe(true)
  })
})
