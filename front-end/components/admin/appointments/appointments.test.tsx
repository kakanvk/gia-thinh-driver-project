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

import { AppointmentCalendar } from "@/components/admin/appointments/appointment-calendar"
import { LeadAppointments } from "@/components/admin/appointments/lead-appointments"
import { makeQueryClient } from "@/components/providers/query-provider"
import { monthOf, todayVn } from "@/lib/admin/datetime"
import type { Appointment, CalendarItem, Lead } from "@/lib/admin/types"
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

let search = ""
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => "/admin/lich-dang-ky",
  useSearchParams: () => new URLSearchParams(search),
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
const admin = {
  id: "u9",
  name: "Quản trị",
  username: "admin",
  phone: "0901234567",
  role: "super_admin",
  branchIds: [],
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
    name: "Nguyễn An",
    phone: "0901234567",
    email: null,
    courseId: null,
    courseCode: null,
    branchId: "b1",
    preferredContactTime: null,
    note: null,
    source: "facebook",
    utm: null,
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

function item(overrides: Partial<CalendarItem> = {}): CalendarItem {
  return {
    id: "a1",
    date: "2026-10-21",
    time: "08:30",
    startAt: "2026-10-21T08:30:00+07:00",
    endAt: "2026-10-21T09:00:00+07:00",
    type: "consult",
    title: null,
    status: "scheduled",
    branchId: "b1",
    lead: { id: "l1", code: "KH0001", name: "Nguyễn An", phone: "0901234567" },
    assignee: { id: "u1", name: "Trần Mỹ Duyên" },
    ...overrides,
  }
}

function appointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "a1",
    leadId: "l1",
    branchId: "b1",
    startAt: "2026-10-21T08:30:00+07:00",
    endAt: "2026-10-21T09:00:00+07:00",
    durationMinutes: 30,
    type: "consult",
    title: null,
    assigneeId: "u1",
    status: "scheduled",
    note: null,
    createdBy: "u1",
    createdAt: "2026-10-01T09:00:00+07:00",
    updatedAt: "2026-10-01T09:00:00+07:00",
    ...overrides,
  }
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
        {
          id: "u1",
          name: "Trần Mỹ Duyên",
          role: "consultant",
          branchIds: ["b1"],
        },
      ],
    }),
}

const calendar = (items: CalendarItem[] = [item()]) =>
  jsonResponse(200, { data: { month: "2026-10", items } })

function urlsOf(fn: ReturnType<typeof mockFetch>["fn"], path: string): URL[] {
  return fn.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === `/api/v1${path}`)
}

function bodyOf(
  calls: ReturnType<typeof mockFetch>["calls"],
  key: string
): unknown {
  const call = calls.find((entry) => entry.key === key)
  return call ? JSON.parse(String(call.init.body)) : undefined
}

function renderWithClient(ui: React.ReactElement) {
  const client = makeQueryClient()
  client.setDefaultOptions({ queries: { retry: false } })
  const invalidate = vi.spyOn(client, "invalidateQueries")
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
  return { client, invalidate }
}

async function choose(trigger: HTMLElement, option: string) {
  await userEvent.click(trigger)
  await userEvent.click(await screen.findByRole("option", { name: option }))
}

function invalidatedKeys(
  invalidate: ReturnType<typeof renderWithClient>["invalidate"]
) {
  return invalidate.mock.calls.map(([filters]) => filters?.queryKey?.[0])
}

beforeEach(() => {
  toastSuccess.mockClear()
  toastError.mockClear()
  replace.mockClear()
  push.mockClear()
  search = "month=2026-10"
  setAccessToken("t1")
  auth = { user: consultant, permissions: CONSULTANT_PERMISSIONS }
})

describe("AppointmentCalendar", () => {
  it("tải lịch theo tháng trên URL, đổi tháng và về hôm nay", async () => {
    const { fn } = mockFetch({
      "GET /appointments/calendar": () => calendar(),
      ...lookups,
    })
    renderWithClient(<AppointmentCalendar />)

    expect(await screen.findByText("08:30 · Nguyễn An")).toBeInTheDocument()
    const [url] = urlsOf(fn, "/appointments/calendar")
    expect(url.search).toBe("?month=2026-10")
    expect(screen.getByText("Tháng 10, 2026")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Tháng sau" }))
    expect(replace).toHaveBeenLastCalledWith(
      "/admin/lich-dang-ky?month=2026-11",
      { scroll: false }
    )

    await userEvent.click(screen.getByRole("button", { name: "Hôm nay" }))
    expect(replace).toHaveBeenLastCalledWith(
      `/admin/lich-dang-ky?month=${monthOf(todayVn())}`,
      { scroll: false }
    )
  })

  it("bố trí ô theo thứ: 01/10/2026 là thứ Năm", async () => {
    mockFetch({ "GET /appointments/calendar": () => calendar([]), ...lookups })
    renderWithClient(<AppointmentCalendar />)

    const cells = await screen.findAllByTestId("calendar-cell")
    // T2 28/09, T3 29/09, T4 30/09 thuộc tháng trước → ngày 1 ở ô thứ 4
    expect(cells[3]).toHaveAttribute("data-date", "2026-10-01")
    expect(cells[0]).toHaveAttribute("data-date", "2026-09-28")
    expect(cells.length % 7).toBe(0)
  })

  it("bấm ngày → cột bên liệt kê lịch hẹn của ngày đó", async () => {
    mockFetch({
      "GET /appointments/calendar": () =>
        calendar([item(), item({ id: "a2", date: "2026-10-22" })]),
      ...lookups,
    })
    renderWithClient(<AppointmentCalendar />)

    await userEvent.click(
      await screen.findByRole("button", { name: /^Ngày 21\/10\/2026/ })
    )
    const day = screen.getByRole("region", { name: /21\/10\/2026/ })
    expect(within(day).getByText("1 lịch hẹn")).toBeInTheDocument()
    expect(
      within(day).getByRole("link", { name: "Nguyễn An" })
    ).toHaveAttribute("href", "/admin/khach-hang/l1")
    expect(within(day).getByText("Đã lên lịch")).toBeInTheDocument()
  })

  it("ô ngày hiện tối đa 3 lịch và +N", async () => {
    mockFetch({
      "GET /appointments/calendar": () =>
        calendar(
          ["a1", "a2", "a3", "a4", "a5"].map((id) =>
            item({ id, title: `Hẹn ${id}` })
          )
        ),
      ...lookups,
    })
    renderWithClient(<AppointmentCalendar />)

    expect(await screen.findByText("08:30 · Hẹn a3")).toBeInTheDocument()
    expect(screen.queryByText("08:30 · Hẹn a4")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "+2" })).toBeInTheDocument()
  })

  it("tạo lịch hẹn: tìm khách, chọn, gửi đúng body", async () => {
    const { fn, calls } = mockFetch({
      "GET /appointments/calendar": () => calendar([]),
      "GET /leads": () =>
        jsonResponse(200, {
          data: [lead()],
          meta: { page: 1, limit: 8, total: 1 },
        }),
      "POST /appointments": () =>
        jsonResponse(201, { data: appointment({ type: "docs" }) }),
      ...lookups,
    })
    const { invalidate } = renderWithClient(<AppointmentCalendar />)

    await userEvent.click(
      await screen.findByRole("button", { name: /Tạo lịch hẹn/ })
    )
    const dialog = await screen.findByRole("dialog")
    await userEvent.type(within(dialog).getByLabelText(/Khách hàng/), "an")
    await userEvent.click(
      await within(dialog).findByRole("button", { name: /Nguyễn An/ })
    )
    const [leadsUrl] = urlsOf(fn, "/leads")
    expect(leadsUrl.search).toBe("?q=an&limit=8")
    expect(
      within(dialog).getByRole("button", { name: "Bỏ chọn" })
    ).toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText(/Ngày giờ/), {
      target: { value: "2026-10-21T08:30" },
    })
    const duration = within(dialog).getByLabelText(/Thời lượng/)
    await userEvent.clear(duration)
    await userEvent.type(duration, "45")
    await choose(
      within(dialog).getByRole("combobox", { name: "Loại" }),
      "Làm hồ sơ"
    )
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Tạo lịch hẹn" })
    )

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled())
    expect(bodyOf(calls, "POST /appointments")).toEqual({
      leadId: "l1",
      startAt: "2026-10-21T08:30:00+07:00",
      durationMinutes: 45,
      type: "docs",
    })
    expect(invalidatedKeys(invalidate)).toContain("calendar")
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
  })

  it("quản trị viên không chọn khách và chi nhánh → lỗi tại ô, không gửi", async () => {
    auth = { user: admin, permissions: ["*"] }
    const { calls } = mockFetch({
      "GET /appointments/calendar": () => calendar([]),
      ...lookups,
    })
    renderWithClient(<AppointmentCalendar />)

    await userEvent.click(
      await screen.findByRole("button", { name: /Tạo lịch hẹn/ })
    )
    const dialog = await screen.findByRole("dialog")
    fireEvent.change(within(dialog).getByLabelText(/Ngày giờ/), {
      target: { value: "2026-10-21T08:30" },
    })
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Tạo lịch hẹn" })
    )

    expect(
      await within(dialog).findByText("Chọn khách hàng hoặc chi nhánh")
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole("combobox", { name: "Chi nhánh" })
    ).toHaveAttribute("aria-invalid", "true")
    expect(calls.some((call) => call.key === "POST /appointments")).toBe(false)
  })

  it("409 trùng giờ → thông báo trên form, sheet vẫn mở", async () => {
    mockFetch({
      "GET /appointments/calendar": () => calendar([]),
      "POST /appointments": () =>
        jsonResponse(409, {
          error: {
            code: "CONFLICT",
            message: "Người phụ trách đã có lịch trùng giờ",
          },
        }),
      ...lookups,
    })
    renderWithClient(<AppointmentCalendar />)

    await userEvent.click(
      await screen.findByRole("button", { name: /Tạo lịch hẹn/ })
    )
    const dialog = await screen.findByRole("dialog")
    fireEvent.change(within(dialog).getByLabelText(/Ngày giờ/), {
      target: { value: "2026-10-21T08:30" },
    })
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Tạo lịch hẹn" })
    )

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Người phụ trách đã có lịch trùng giờ"
    )
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(toastError).not.toHaveBeenCalled()
  })

  it("sheet chi tiết: đổi trạng thái và xoá", async () => {
    const { calls } = mockFetch({
      "GET /appointments/calendar": () => calendar(),
      "GET /appointments/a1": () => jsonResponse(200, { data: appointment() }),
      "GET /leads/l1": () => jsonResponse(200, { data: lead() }),
      "PATCH /appointments/a1/status": () =>
        jsonResponse(200, { data: appointment({ status: "no_show" }) }),
      "DELETE /appointments/a1": () => jsonResponse(204),
      ...lookups,
    })
    const { invalidate } = renderWithClient(<AppointmentCalendar />)

    await userEvent.click(await screen.findByText("08:30 · Nguyễn An"))
    const dialog = await screen.findByRole("dialog")
    expect(
      await within(dialog).findByText("21/10/2026 08:30")
    ).toBeInTheDocument()
    expect(
      await within(dialog).findByRole("link", { name: /Nguyễn An/ })
    ).toHaveAttribute("href", "/admin/khach-hang/l1")

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Khách không đến" })
    )
    await waitFor(() =>
      expect(bodyOf(calls, "PATCH /appointments/a1/status")).toEqual({
        status: "no_show",
      })
    )
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled())
    expect(invalidatedKeys(invalidate)).toContain("calendar")

    invalidate.mockClear()
    await userEvent.click(within(dialog).getByRole("button", { name: /^Xoá$/ }))
    const confirm = await screen.findByRole("alertdialog")
    await userEvent.click(
      within(confirm).getByRole("button", { name: "Xoá lịch hẹn" })
    )
    await waitFor(() =>
      expect(calls.some((call) => call.key === "DELETE /appointments/a1")).toBe(
        true
      )
    )
    await waitFor(() =>
      expect(invalidatedKeys(invalidate)).toContain("calendar")
    )
  })

  it("không có appointment.delete → không thấy nút Xoá", async () => {
    auth = {
      user: consultant,
      permissions: ["lead.read", "appointment.read", "appointment.update"],
    }
    mockFetch({
      "GET /appointments/calendar": () => calendar(),
      "GET /appointments/a1": () => jsonResponse(200, { data: appointment() }),
      "GET /leads/l1": () => jsonResponse(200, { data: lead() }),
      ...lookups,
    })
    renderWithClient(<AppointmentCalendar />)

    await userEvent.click(await screen.findByText("08:30 · Nguyễn An"))
    const dialog = await screen.findByRole("dialog")
    await within(dialog).findByText("21/10/2026 08:30")
    expect(within(dialog).queryByRole("button", { name: /^Xoá$/ })).toBeNull()
    expect(screen.queryByRole("button", { name: /Tạo lịch hẹn/ })).toBeNull()
  })
})

describe("LeadAppointments", () => {
  it("liệt kê lịch hẹn của khách và đặt lịch với khách đã khoá", async () => {
    const { fn, calls } = mockFetch({
      "GET /appointments": () =>
        jsonResponse(200, {
          data: [appointment({ type: "docs", status: "done" })],
          meta: { page: 1, limit: 20, total: 1 },
        }),
      "POST /appointments": () => jsonResponse(201, { data: appointment() }),
      ...lookups,
    })
    const { invalidate } = renderWithClient(<LeadAppointments lead={lead()} />)

    expect(await screen.findByText("21/10/2026 08:30")).toBeInTheDocument()
    expect(screen.getByText("Làm hồ sơ")).toBeInTheDocument()
    expect(screen.getByText("Hoàn thành")).toBeInTheDocument()
    const [url] = urlsOf(fn, "/appointments")
    expect(url.searchParams.get("leadId")).toBe("l1")
    expect(url.searchParams.get("sort")).toBe("-startAt")

    await userEvent.click(screen.getByRole("button", { name: /Đặt lịch hẹn/ }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText(/Nguyễn An/)).toBeInTheDocument()
    expect(within(dialog).queryByRole("button", { name: "Bỏ chọn" })).toBeNull()
    expect(within(dialog).queryByRole("searchbox")).toBeNull()

    fireEvent.change(within(dialog).getByLabelText(/Ngày giờ/), {
      target: { value: "2026-10-25T14:00" },
    })
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Tạo lịch hẹn" })
    )
    await waitFor(() =>
      expect(bodyOf(calls, "POST /appointments")).toEqual({
        leadId: "l1",
        startAt: "2026-10-25T14:00:00+07:00",
        durationMinutes: 30,
        type: "consult",
      })
    )
    await waitFor(() =>
      expect(invalidatedKeys(invalidate)).toContain("lead-activities")
    )
    expect(
      invalidate.mock.calls.map(([filters]) => filters?.queryKey)
    ).toContainEqual(["lead", "l1"])
  })
})
