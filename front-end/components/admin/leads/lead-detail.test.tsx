import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { LeadDetail } from "@/components/admin/leads/lead-detail"
import { makeQueryClient } from "@/components/providers/query-provider"
import { todayVn } from "@/lib/admin/datetime"
import type { Lead, LeadActivity } from "@/lib/admin/types"
import { setAccessToken } from "@/lib/api/session"
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => "/admin/khach-hang/l1",
  useSearchParams: () => new URLSearchParams(""),
}))

let auth: Record<string, unknown>
vi.mock("@/components/admin/auth-provider", () => ({ useAuth: () => auth }))

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
  "student.read",
  "student.create",
]
const MANAGER_PERMISSIONS = ["lead.*", "appointment.*", "student.*", "class.*"]

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "l1",
    code: "KH0001",
    name: "Nguyễn Văn An",
    phone: "0901234567",
    email: "an@example.com",
    courseId: "c1",
    courseCode: "B-SO-SAN",
    branchId: "b1",
    preferredContactTime: "Sau 17h",
    note: "Muốn học cuối tuần",
    source: "facebook",
    utm: { source: "fb", campaign: "thang10" },
    status: "contacted",
    lostReason: null,
    assigneeId: null,
    nextFollowUpAt: null,
    studentId: null,
    lastActivityAt: "2026-10-01T09:00:00+07:00",
    createdAt: "2026-10-01T09:00:00+07:00",
    updatedAt: "2026-10-01T09:00:00+07:00",
    ...overrides,
  }
}

function activity(overrides: Partial<LeadActivity> = {}): LeadActivity {
  return {
    id: "a1",
    leadId: "l1",
    type: "status_change",
    fromStatus: "new",
    toStatus: "contacted",
    content: null,
    byUserId: "u2",
    at: "2026-10-02T10:15:00+07:00",
    ...overrides,
  }
}

const activitiesPage = {
  data: [activity()],
  meta: { page: 1, limit: 20, total: 1 },
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
          id: "u1",
          name: "Trần Mỹ Duyên",
          role: "consultant",
          branchIds: ["b1"],
        },
        {
          id: "u2",
          name: "Phạm Hoàng Long",
          role: "consultant",
          branchIds: ["b1"],
        },
      ],
    }),
  "GET /courses": () =>
    jsonResponse(200, {
      data: [
        { id: "c1", code: "B-SO-SAN", name: "B số sàn" },
        { id: "c2", code: "B-TU-DONG", name: "B số tự động" },
      ],
      meta: { page: 1, limit: 100, total: 2 },
    }),
}

function setup(
  current: Lead = lead(),
  extra: Parameters<typeof mockFetch>[0] = {}
) {
  return mockFetch({
    "GET /leads/l1": () => jsonResponse(200, { data: current }),
    "GET /leads/l1/activities": () => jsonResponse(200, activitiesPage),
    ...lookups,
    ...extra,
  })
}

function urlsOf(fn: ReturnType<typeof mockFetch>["fn"], path: string): URL[] {
  return fn.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === `/api/v1${path}`)
}

function bodyOf(
  calls: ReturnType<typeof mockFetch>["calls"],
  key: string
): unknown {
  const call = calls.find((item) => item.key === key)
  return call ? JSON.parse(String(call.init.body)) : undefined
}

function renderDetail() {
  const client = makeQueryClient()
  client.setDefaultOptions({ queries: { retry: false } })
  return render(
    <QueryClientProvider client={client}>
      <LeadDetail id="l1" />
    </QueryClientProvider>
  )
}

async function choose(trigger: HTMLElement, option: string) {
  await userEvent.click(trigger)
  await userEvent.click(await screen.findByRole("option", { name: option }))
}

async function openStatusMenu(): Promise<string[]> {
  await userEvent.click(
    await screen.findByRole("button", { name: /Đổi trạng thái/ })
  )
  const items = await screen.findAllByRole("menuitem")
  return items.map((item) => item.textContent ?? "")
}

beforeEach(() => {
  toastSuccess.mockClear()
  toastError.mockClear()
  replace.mockClear()
  push.mockClear()
  setAccessToken("t1")
  auth = { user: consultant, permissions: CONSULTANT_PERMISSIONS }
})

describe("LeadDetail", () => {
  it("hiển thị thông tin khách", async () => {
    setup()
    renderDetail()

    expect(
      await screen.findByRole("heading", { name: "Nguyễn Văn An" })
    ).toBeInTheDocument()
    expect(screen.getAllByText("KH0001").length).toBeGreaterThan(0)
    const header = screen.getByRole("heading", { name: "Nguyễn Văn An" })
      .parentElement!.parentElement!
    expect(within(header).getByText("Đã liên hệ")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "0901234567" })).toHaveAttribute(
      "href",
      "tel:0901234567"
    )
    expect(await screen.findByText("Tân Ngãi")).toBeInTheDocument()
    expect(screen.getByText("Facebook")).toBeInTheDocument()
    expect(screen.getByText(/source: fb/)).toBeInTheDocument()
    expect(screen.getByText(/campaign: thang10/)).toBeInTheDocument()
  })

  it("404 → Không tìm thấy khách hàng", async () => {
    setup(lead(), {
      "GET /leads/l1": () =>
        jsonResponse(404, {
          error: { code: "NOT_FOUND", message: "Không tìm thấy khách hàng" },
        }),
    })
    renderDetail()
    expect(
      await screen.findByText("Không tìm thấy khách hàng")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /Về danh sách khách hàng/ })
    ).toHaveAttribute("href", "/admin/khach-hang")
  })

  it("đổi trạng thái: menu đúng luật, Không thành công bắt nhập lý do", async () => {
    const { calls } = setup(lead(), {
      "PATCH /leads/l1/status": () =>
        jsonResponse(200, {
          data: lead({ status: "lost", lostReason: "Khách đổi ý" }),
        }),
    })
    renderDetail()

    expect(await openStatusMenu()).toEqual([
      "Đã tư vấn",
      "Đặt cọc",
      "Hoàn tất hồ sơ",
      "Không thành công",
    ])
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Không thành công" })
    )
    const dialog = await screen.findByRole("alertdialog")
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Xác nhận" })
    )
    expect(
      within(dialog).getByText("Nhập lý do từ 3 đến 300 ký tự")
    ).toBeInTheDocument()
    expect(calls.some((call) => call.key === "PATCH /leads/l1/status")).toBe(
      false
    )

    await userEvent.type(within(dialog).getByLabelText(/Lý do/), "Khách đổi ý")
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Xác nhận" })
    )
    await waitFor(() =>
      expect(bodyOf(calls, "PATCH /leads/l1/status")).toEqual({
        status: "lost",
        lostReason: "Khách đổi ý",
      })
    )
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled())
  })

  it("khách Không thành công chỉ chuyển được về Đã liên hệ", async () => {
    setup(lead({ status: "lost", lostReason: "Khách đổi ý" }))
    renderDetail()
    expect(await openStatusMenu()).toEqual(["Đã liên hệ"])
  })

  it("nút Chuyển thành học viên theo trạng thái và quyền", async () => {
    setup()
    const first = renderDetail()
    await screen.findByRole("heading", { name: "Nguyễn Văn An" })
    expect(
      screen.queryByRole("button", { name: /Chuyển thành học viên/ })
    ).not.toBeInTheDocument()
    first.unmount()

    setup(lead({ status: "deposited" }))
    const second = renderDetail()
    expect(
      await screen.findByRole("button", { name: /Chuyển thành học viên/ })
    ).toBeInTheDocument()
    second.unmount()

    auth = {
      user: consultant,
      permissions: ["lead.read", "lead.update", "appointment.*"],
    }
    setup(lead({ status: "deposited" }))
    renderDetail()
    await screen.findByRole("heading", { name: "Nguyễn Văn An" })
    expect(
      screen.queryByRole("button", { name: /Chuyển thành học viên/ })
    ).not.toBeInTheDocument()
  })

  it("chuyển thành học viên: chọn lớp, gửi đúng body, toast mã học viên", async () => {
    auth = {
      user: { ...consultant, role: "branch_manager" },
      permissions: MANAGER_PERMISSIONS,
    }
    const { fn, calls } = setup(lead({ status: "deposited" }), {
      "GET /classes": () =>
        jsonResponse(200, {
          data: [
            { id: "k1", code: "B-K12", status: "enrolling" },
            { id: "k2", code: "B-K01", status: "finished" },
          ],
          meta: { page: 1, limit: 100, total: 2 },
        }),
      "POST /leads/l1/convert": () =>
        jsonResponse(201, {
          data: {
            lead: lead({ status: "enrolled", studentId: "s1" }),
            student: { id: "s1", code: "HV0007" },
          },
        }),
    })
    renderDetail()
    await userEvent.click(
      await screen.findByRole("button", { name: /Chuyển thành học viên/ })
    )
    const dialog = await screen.findByRole("dialog")

    const classTrigger = within(dialog).getByRole("combobox", { name: "Lớp" })
    await waitFor(() => expect(urlsOf(fn, "/classes")).toHaveLength(1))
    expect(Object.fromEntries(urlsOf(fn, "/classes")[0].searchParams)).toEqual({
      branchId: "b1",
      courseId: "c1",
      limit: "100",
    })
    await userEvent.click(classTrigger)
    expect(
      await screen.findByRole("option", { name: "B-K12" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("option", { name: "B-K01" })
    ).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("option", { name: "B-K12" }))

    await userEvent.type(within(dialog).getByLabelText(/CCCD/), "012345678901")
    fireEvent.change(within(dialog).getByLabelText("Ngày sinh"), {
      target: { value: "2000-01-02" },
    })
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Chuyển thành học viên" })
    )

    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Đã tạo học viên HV0007")
    )
    expect(bodyOf(calls, "POST /leads/l1/convert")).toEqual({
      courseId: "c1",
      classId: "k1",
      email: "an@example.com",
      idNumber: "012345678901",
      dob: "2000-01-02",
      enrolledAt: todayVn(),
    })
  })

  it("ghi hoạt động rồi tải lại lịch sử", async () => {
    const { fn, calls } = setup(lead(), {
      "POST /leads/l1/activities": () =>
        jsonResponse(201, {
          data: activity({
            id: "a2",
            type: "call",
            fromStatus: null,
            toStatus: null,
            content: "Gọi lần 1",
            byUserId: "u1",
          }),
        }),
    })
    renderDetail()
    await screen.findByRole("heading", { name: "Nguyễn Văn An" })
    await waitFor(() =>
      expect(urlsOf(fn, "/leads/l1/activities")).toHaveLength(1)
    )

    const form = screen.getByRole("form", { name: "Ghi hoạt động" })
    await choose(
      within(form).getByRole("combobox", { name: "Loại" }),
      "Cuộc gọi"
    )
    await userEvent.type(within(form).getByLabelText(/Nội dung/), "Gọi lần 1")
    fireEvent.change(within(form).getByLabelText("Hẹn gọi lại"), {
      target: { value: "2026-10-22T09:00" },
    })
    await userEvent.click(
      within(form).getByRole("button", { name: "Lưu hoạt động" })
    )

    await waitFor(() =>
      expect(bodyOf(calls, "POST /leads/l1/activities")).toEqual({
        type: "call",
        content: "Gọi lần 1",
        nextFollowUpAt: "2026-10-22T09:00:00+07:00",
      })
    )
    await waitFor(() =>
      expect(urlsOf(fn, "/leads/l1/activities").length).toBeGreaterThan(1)
    )
  })

  it("ghi hoạt động: thiếu nội dung không gửi", async () => {
    const { calls } = setup()
    renderDetail()
    const form = await screen.findByRole("form", { name: "Ghi hoạt động" })
    await userEvent.click(
      within(form).getByRole("button", { name: "Lưu hoạt động" })
    )
    expect(within(form).getByText("Nhập nội dung")).toBeInTheDocument()
    expect(calls.some((call) => call.key === "POST /leads/l1/activities")).toBe(
      false
    )
  })

  it("lịch sử: nhãn đổi trạng thái, tên người làm, Xem thêm tải trang 2", async () => {
    const { fn } = setup(lead(), {
      "GET /leads/l1/activities": [
        () =>
          jsonResponse(200, {
            data: [activity()],
            meta: { page: 1, limit: 20, total: 2 },
          }),
        () =>
          jsonResponse(200, {
            data: [
              activity({
                id: "a0",
                type: "created",
                fromStatus: null,
                toStatus: "new",
                byUserId: "x9",
              }),
            ],
            meta: { page: 2, limit: 20, total: 2 },
          }),
      ],
    })
    renderDetail()

    expect(
      await screen.findByText("Đổi trạng thái: Mới → Đã liên hệ")
    ).toBeInTheDocument()
    const history = screen.getByRole("list", { name: "Lịch sử chăm sóc" })
    expect(
      await within(history).findByText(/Phạm Hoàng Long/)
    ).toBeInTheDocument()
    expect(within(history).getByText(/02\/10\/2026 10:15/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Xem thêm" }))
    expect(await within(history).findByText("Tạo mới")).toBeInTheDocument()
    expect(within(history).getByText(/Nhân viên/)).toBeInTheDocument()
    const pages = urlsOf(fn, "/leads/l1/activities").map((url) =>
      url.searchParams.get("page")
    )
    expect(pages).toEqual(["1", "2"])
    expect(
      screen.queryByRole("button", { name: "Xem thêm" })
    ).not.toBeInTheDocument()
  })

  it("lịch sử: trang sau lệch offset không hiển thị trùng hoạt động", async () => {
    setup(lead(), {
      "GET /leads/l1/activities": [
        () =>
          jsonResponse(200, {
            data: [activity()],
            meta: { page: 1, limit: 1, total: 2 },
          }),
        () =>
          jsonResponse(200, {
            data: [
              activity(),
              activity({
                id: "a0",
                type: "created",
                fromStatus: null,
                toStatus: "new",
              }),
            ],
            meta: { page: 2, limit: 1, total: 3 },
          }),
      ],
    })
    renderDetail()
    const history = await screen.findByRole("list", {
      name: "Lịch sử chăm sóc",
    })
    expect(
      await within(history).findByText("Đổi trạng thái: Mới → Đã liên hệ")
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Xem thêm" }))
    expect(await within(history).findByText("Tạo mới")).toBeInTheDocument()
    expect(
      within(history).getAllByText("Đổi trạng thái: Mới → Đã liên hệ")
    ).toHaveLength(1)
  })

  it("phân công và bỏ phân công", async () => {
    const { calls } = setup(lead(), {
      "PATCH /leads/l1/assign": [
        () => jsonResponse(200, { data: lead({ assigneeId: "u2" }) }),
        () => jsonResponse(200, { data: lead({ assigneeId: null }) }),
      ],
    })
    renderDetail()
    await screen.findByRole("heading", { name: "Nguyễn Văn An" })
    const trigger = screen.getByRole("combobox", { name: "Phân công" })
    await screen.findByText("Tân Ngãi")
    await choose(trigger, "Phạm Hoàng Long")
    await waitFor(() =>
      expect(
        calls.filter((call) => call.key === "PATCH /leads/l1/assign")
      ).toHaveLength(1)
    )
    expect(bodyOf(calls, "PATCH /leads/l1/assign")).toEqual({
      assigneeId: "u2",
    })

    await userEvent.click(
      await screen.findByRole("button", { name: "Bỏ phân công" })
    )
    await waitFor(() =>
      expect(
        calls.filter((call) => call.key === "PATCH /leads/l1/assign")
      ).toHaveLength(2)
    )
    const second = calls.filter(
      (call) => call.key === "PATCH /leads/l1/assign"
    )[1]
    expect(JSON.parse(String(second.init.body))).toEqual({ assigneeId: null })
  })

  it("tư vấn viên không thấy Xoá; quản lý xoá xong về danh sách", async () => {
    setup()
    const first = renderDetail()
    await screen.findByRole("heading", { name: "Nguyễn Văn An" })
    expect(
      screen.queryByRole("button", { name: /Xoá/ })
    ).not.toBeInTheDocument()
    first.unmount()

    auth = {
      user: { ...consultant, role: "branch_manager" },
      permissions: MANAGER_PERMISSIONS,
    }
    const { calls } = setup(lead(), {
      "DELETE /leads/l1": () => jsonResponse(204),
    })
    renderDetail()
    await userEvent.click(await screen.findByRole("button", { name: /Xoá/ }))
    const getsBefore = calls.filter(
      (call) => call.key === "GET /leads/l1"
    ).length
    const dialog = await screen.findByRole("alertdialog")
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Xoá khách" })
    )
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/khach-hang"))
    expect(calls.some((call) => call.key === "DELETE /leads/l1")).toBe(true)
    // Không gọi lại GET khách vừa xoá (sẽ 404).
    expect(calls.filter((call) => call.key === "GET /leads/l1")).toHaveLength(
      getsBefore
    )
  })
})
