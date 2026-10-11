import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { LeadList } from "@/components/admin/leads/lead-list"
import { makeQueryClient } from "@/components/providers/query-provider"
import type { Lead } from "@/lib/admin/types"
import { apiDownload } from "@/lib/api/client"
import { setAccessToken } from "@/lib/api/session"
import { jsonResponse, mockFetch } from "@/test/fetch-mock"

// vi.mock được đưa lên đầu file: biến dùng trong factory phải tạo bằng vi.hoisted
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
  usePathname: () => "/admin/khach-hang",
  useSearchParams: () => new URLSearchParams(search),
}))

let auth: Record<string, unknown>
vi.mock("@/components/admin/auth-provider", () => ({ useAuth: () => auth }))

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiDownload: vi.fn(async () => undefined),
}))

const consultant = {
  id: "u1",
  name: "Trần Mỹ Duyên",
  username: "duyen",
  phone: "0779666664",
  role: "consultant",
  branchIds: ["b1"],
  status: "active",
}
const CONSULTANT_PERMISSIONS = [
  "lead.read",
  "lead.create",
  "lead.update",
  "appointment.*",
]

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "l1",
    code: "KH0001",
    name: "Nguyễn Văn An",
    phone: "0901234567",
    email: null,
    courseId: null,
    courseCode: "B-SO-SAN",
    branchId: "b1",
    preferredContactTime: null,
    note: null,
    source: "facebook",
    utm: null,
    status: "new",
    lostReason: null,
    assigneeId: null,
    nextFollowUpAt: "2020-01-01T08:00:00+07:00",
    studentId: null,
    lastActivityAt: "2026-10-01T09:00:00+07:00",
    createdAt: "2026-10-01T09:00:00+07:00",
    updatedAt: "2026-10-01T09:00:00+07:00",
    ...overrides,
  }
}

const leadsPage = {
  data: [
    lead(),
    lead({
      id: "l2",
      code: "KH0002",
      name: "Lê Thị Bình",
      phone: "0907654321",
      status: "contacted",
      source: "walk_in",
      assigneeId: "u2",
      nextFollowUpAt: null,
      courseCode: null,
    }),
  ],
  meta: { page: 2, limit: 20, total: 45 },
}

const lookups = {
  "GET /branches": () =>
    jsonResponse(200, {
      data: [
        { id: "b1", name: "Tân Ngãi", slug: "tan-ngai", officeName: "VP1" },
        { id: "b2", name: "Vũng Liêm", slug: "vung-liem", officeName: "VP2" },
      ],
      meta: { page: 1, limit: 100, total: 2 },
    }),
  "GET /users/options": () =>
    jsonResponse(200, {
      data: [
        { id: "u1", name: "Trần Mỹ Duyên", role: "consultant", branchIds: ["b1"] },
        { id: "u2", name: "Phạm Hoàng Long", role: "consultant", branchIds: ["b1"] },
      ],
    }),
  "GET /courses": () =>
    jsonResponse(200, {
      data: [{ id: "c1", code: "B-SO-SAN", name: "B số sàn" }],
      meta: { page: 1, limit: 100, total: 1 },
    }),
}

function setup(extra: Parameters<typeof mockFetch>[0] = {}) {
  return mockFetch({
    "GET /leads": () => jsonResponse(200, leadsPage),
    ...lookups,
    ...extra,
  })
}

function urlsOf(fn: ReturnType<typeof mockFetch>["fn"], path: string): URL[] {
  return fn.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === `/api/v1${path}`)
}

function renderList() {
  const client = makeQueryClient()
  client.setDefaultOptions({ queries: { retry: false } })
  return render(
    <QueryClientProvider client={client}>
      <LeadList />
    </QueryClientProvider>
  )
}

async function choose(trigger: HTMLElement, option: string) {
  await userEvent.click(trigger)
  await userEvent.click(await screen.findByRole("option", { name: option }))
}

beforeEach(() => {
  toastSuccess.mockClear()
  toastError.mockClear()
  replace.mockClear()
  push.mockClear()
  vi.mocked(apiDownload).mockClear()
  search = ""
  setAccessToken("t1")
  auth = { user: consultant, permissions: CONSULTANT_PERMISSIONS }
})

describe("LeadList", () => {
  it("gọi /leads theo bộ lọc trên URL và hiển thị các cột", async () => {
    search = "status=new&page=2"
    const { fn } = setup()
    renderList()

    expect(await screen.findByText("Nguyễn Văn An")).toBeInTheDocument()
    const [url] = urlsOf(fn, "/leads")
    expect(Object.fromEntries(url.searchParams)).toEqual({
      status: "new",
      page: "2",
      limit: "20",
      sort: "-createdAt",
    })

    const first = screen.getByText("Nguyễn Văn An").closest("tr")!
    await waitFor(() =>
      expect(within(first).getByText("Tân Ngãi")).toBeInTheDocument()
    )
    expect(within(first).getByText("KH0001")).toBeInTheDocument()
    expect(within(first).getByText("0901234567")).toBeInTheDocument()
    expect(within(first).getByText("B-SO-SAN")).toBeInTheDocument()
    expect(within(first).getByText("Facebook")).toBeInTheDocument()
    expect(within(first).getByText("Mới")).toBeInTheDocument()
    expect(within(first).getByText("Chưa phân công")).toBeInTheDocument()
    expect(within(first).getByText("01/01 08:00")).toHaveClass(
      "text-destructive"
    )

    const second = screen.getByText("Lê Thị Bình").closest("tr")!
    await waitFor(() =>
      expect(within(second).getByText("Phạm Hoàng Long")).toBeInTheDocument()
    )
    expect(within(second).getByText("Đã liên hệ")).toBeInTheDocument()
    expect(within(second).getByText("Tại văn phòng")).toBeInTheDocument()
    expect(screen.getByText("Trang 2/3 · 45 bản ghi")).toBeInTheDocument()

    await userEvent.click(first)
    expect(push).toHaveBeenCalledWith("/admin/khach-hang/l1")
  })

  it("gõ tìm kiếm → sau debounce ghi q lên URL, bỏ page", async () => {
    search = "page=3"
    setup()
    renderList()
    await userEvent.type(
      screen.getByRole("searchbox", { name: /Tìm tên/ }),
      "an"
    )
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/admin/khach-hang?q=an", {
        scroll: false,
      })
    )
  })

  it("lọc Phụ trách: Của tôi và Chưa phân công", async () => {
    setup()
    renderList()
    await screen.findByText("Nguyễn Văn An")
    await choose(screen.getByRole("combobox", { name: "Phụ trách" }), "Của tôi")
    expect(replace).toHaveBeenLastCalledWith(
      "/admin/khach-hang?assigneeId=u1",
      { scroll: false }
    )
    await choose(
      screen.getByRole("combobox", { name: "Phụ trách" }),
      "Chưa phân công"
    )
    expect(replace).toHaveBeenLastCalledWith(
      "/admin/khach-hang?assigneeId=none",
      { scroll: false }
    )
  })

  it("tư vấn viên không thấy Xuất CSV", async () => {
    setup()
    renderList()
    await screen.findByText("Nguyễn Văn An")
    expect(
      screen.queryByRole("button", { name: /Xuất CSV/ })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Thêm khách/ })).toBeInTheDocument()
  })

  it("quản lý xuất CSV theo bộ lọc hiện tại, không kèm trang", async () => {
    search = "status=new&q=an&page=2"
    auth = {
      user: { ...consultant, role: "branch_manager" },
      permissions: ["lead.*", "appointment.*"],
    }
    setup()
    renderList()
    await userEvent.click(
      await screen.findByRole("button", { name: /Xuất CSV/ })
    )
    await waitFor(() => expect(apiDownload).toHaveBeenCalledTimes(1))
    const [path, query, filename] = vi.mocked(apiDownload).mock.calls[0]
    expect(path).toBe("/leads/export")
    expect(query).toEqual({ q: "an", status: "new" })
    expect(filename).toMatch(/^khach-hang-\d{8}\.csv$/)
  })

  it("thêm khách: gửi đúng body, toast và mở trang chi tiết", async () => {
    const { calls } = setup({
      "POST /leads": (init) => {
        expect(JSON.parse(String(init.body))).toEqual({
          name: "Võ Minh Khang",
          phone: "0911222333",
          branchId: "b1",
          source: "facebook",
          nextFollowUpAt: "2026-10-21T08:30:00+07:00",
        })
        return jsonResponse(201, {
          data: lead({ id: "l9", code: "KH0009", name: "Võ Minh Khang" }),
        })
      },
    })
    renderList()
    await userEvent.click(screen.getByRole("button", { name: /Thêm khách/ }))
    const dialog = await screen.findByRole("dialog")
    expect(
      within(dialog).queryByRole("combobox", { name: /Chi nhánh/ })
    ).not.toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText(/Họ và tên/), "Võ Minh Khang")
    await userEvent.type(within(dialog).getByLabelText(/Số điện thoại/), "0911222333")
    await choose(within(dialog).getByRole("combobox", { name: "Nguồn" }), "Facebook")
    fireEvent.change(within(dialog).getByLabelText("Hẹn gọi lại"), {
      target: { value: "2026-10-21T08:30" },
    })
    await userEvent.click(within(dialog).getByRole("button", { name: "Thêm khách" }))

    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/khach-hang/l9"))
    expect(toastSuccess).toHaveBeenCalledWith("Đã thêm khách KH0009")
    expect(calls.filter((call) => call.key === "POST /leads")).toHaveLength(1)
  })

  it("thêm khách: lỗi trường từ backend hiện dưới ô, sheet vẫn mở", async () => {
    setup({
      "POST /leads": () =>
        jsonResponse(400, {
          error: {
            code: "VALIDATION_ERROR",
            message: "Dữ liệu không hợp lệ",
            details: [
              {
                path: "body.phone",
                message: "Số điện thoại phải có 10 chữ số, bắt đầu bằng 0",
              },
            ],
          },
        }),
    })
    renderList()
    await userEvent.click(screen.getByRole("button", { name: /Thêm khách/ }))
    const dialog = await screen.findByRole("dialog")
    await userEvent.type(within(dialog).getByLabelText(/Họ và tên/), "Võ Minh Khang")
    await userEvent.type(within(dialog).getByLabelText(/Số điện thoại/), "0911")
    await userEvent.click(within(dialog).getByRole("button", { name: "Thêm khách" }))

    const message = await within(dialog).findByText(
      "Số điện thoại phải có 10 chữ số, bắt đầu bằng 0"
    )
    expect(within(dialog).getByLabelText(/Số điện thoại/)).toHaveAttribute(
      "aria-describedby",
      message.id
    )
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
    expect(toastError).not.toHaveBeenCalled()
  })

  it("thêm khách: thiếu tên/SĐT báo lỗi tại ô, không gửi request", async () => {
    const { calls } = setup()
    renderList()
    await userEvent.click(screen.getByRole("button", { name: /Thêm khách/ }))
    const dialog = await screen.findByRole("dialog")
    await userEvent.click(within(dialog).getByRole("button", { name: "Thêm khách" }))
    expect(within(dialog).getByText("Nhập họ và tên")).toBeInTheDocument()
    expect(within(dialog).getByText("Nhập số điện thoại")).toBeInTheDocument()
    expect(calls.some((call) => call.key === "POST /leads")).toBe(false)
  })

  it("API lỗi 500 → hiện lỗi và Thử lại tải lại", async () => {
    setup({
      "GET /leads": [
        () => jsonResponse(500, { error: { code: "SERVER_ERROR", message: "x" } }),
        () => jsonResponse(200, leadsPage),
      ],
    })
    renderList()
    expect(await screen.findByText("Không tải được dữ liệu.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }))
    expect(await screen.findByText("Nguyễn Văn An")).toBeInTheDocument()
  })
})
