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

import { VehicleList } from "@/components/admin/vehicles/vehicle-list"
import { makeQueryClient } from "@/components/providers/query-provider"
import type { Vehicle, VehicleAlert } from "@/lib/admin/types"
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
  usePathname: () => "/admin/xe-tap-lai",
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
const MANAGER_PERMISSIONS = ["vehicle.*", "course.read", "branch.read"]

function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: "v1",
    plate: "64A-123.45",
    model: "Toyota Vios 1.5G",
    courseCode: "B",
    transmission: "automatic",
    branchId: "b1",
    odometer: 128400,
    datKm: 1240,
    lastServiceAt: "2026-09-12T00:00:00+07:00",
    nextServiceAt: "2026-12-12T00:00:00+07:00",
    registrationExpiresAt: "2026-10-08T00:00:00+07:00",
    status: "active",
    note: null,
    createdAt: "2026-10-01T09:00:00+07:00",
    updatedAt: "2026-10-01T09:00:00+07:00",
    ...overrides,
  }
}

const vios = vehicle()
const wave = vehicle({
  id: "v2",
  plate: "64B1-234.56",
  model: "Honda Wave Alpha",
  courseCode: "A1",
  transmission: null,
  odometer: 5200,
  datKm: 0,
  lastServiceAt: null,
  nextServiceAt: "2026-10-21T00:00:00+07:00",
  registrationExpiresAt: "2026-10-21T00:00:00+07:00",
  status: "maintenance",
})
const xpander = vehicle({
  id: "v3",
  plate: "64A-555.66",
  model: "Mitsubishi Xpander",
  courseCode: "B",
  transmission: "manual",
  registrationExpiresAt: "2027-05-01T00:00:00+07:00",
  nextServiceAt: null,
})

const alerts: VehicleAlert[] = [
  {
    vehicle: vios,
    reasons: [
      {
        type: "registration",
        dueAt: "2026-10-08T00:00:00+07:00",
        daysLeft: -3,
        overdue: true,
      },
    ],
  },
  {
    vehicle: wave,
    reasons: [
      {
        type: "service",
        dueAt: "2026-10-21T00:00:00+07:00",
        daysLeft: 10,
        overdue: false,
      },
      {
        type: "registration",
        dueAt: "2026-10-21T00:00:00+07:00",
        daysLeft: 10,
        overdue: false,
      },
    ],
  },
]

const vehiclesPage = {
  data: [vios, wave, xpander],
  meta: { page: 1, limit: 20, total: 3 },
}

const lookups = {
  "GET /branches": () =>
    jsonResponse(200, {
      data: [
        { id: "b1", name: "Tân Ngãi", slug: "tan-ngai", officeName: "VP1" },
      ],
      meta: { page: 1, limit: 100, total: 1 },
    }),
  "GET /courses": () =>
    jsonResponse(200, {
      data: [
        { id: "c1", code: "A1", name: "Hạng A1" },
        { id: "c2", code: "B", name: "Hạng B" },
        { id: "c3", code: "C1", name: "Hạng C1" },
      ],
      meta: { page: 1, limit: 100, total: 3 },
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
    "GET /vehicles": () => jsonResponse(200, vehiclesPage),
    "GET /vehicles/alerts": () => jsonResponse(200, { data: alerts }),
    ...lookups,
    ...extra,
  })
}

async function openRow(plate: string) {
  const table = await screen.findByRole("table")
  await userEvent.click(await within(table).findByText(plate))
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

describe("VehicleAlerts", () => {
  it("băng cảnh báo: quá hạn màu đỏ, còn hạn kèm ngày", async () => {
    const { fn } = setup()
    renderWithClient(<VehicleList />)

    const banner = await screen.findByRole("region", {
      name: "Cảnh báo hạn xe",
    })
    const [url] = urlsOf(fn, "/vehicles/alerts")
    expect(url.searchParams.get("days")).toBe("30")

    const overdue = within(banner).getByRole("button", {
      name: /64A-123\.45 — Đăng kiểm: quá hạn 3 ngày/,
    })
    expect(overdue.className).toMatch(/text-destructive/)
    const soon = within(banner).getByRole("button", {
      name: /64B1-234\.56 — Bảo dưỡng: còn 10 ngày \(21\/10\/2026\)/,
    })
    expect(soon.className).not.toMatch(/text-destructive/)
    expect(
      within(banner).getByRole("button", {
        name: /64B1-234\.56 — Đăng kiểm: còn 10 ngày \(21\/10\/2026\)/,
      })
    ).toBeInTheDocument()
  })

  it("không có cảnh báo → không render băng", async () => {
    setup({ "GET /vehicles/alerts": () => jsonResponse(200, { data: [] }) })
    renderWithClient(<VehicleList />)
    await screen.findByText("Toyota Vios 1.5G")
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Cảnh báo hạn xe" })
      ).not.toBeInTheDocument()
    )
  })

  it("bấm dòng cảnh báo → mở sheet xe đó", async () => {
    setup()
    renderWithClient(<VehicleList />)
    const banner = await screen.findByRole("region", {
      name: "Cảnh báo hạn xe",
    })
    await userEvent.click(
      within(banner).getByRole("button", { name: /64A-123\.45/ })
    )
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByLabelText(/Biển số/)).toHaveValue("64A-123.45")
  })
})

describe("VehicleList", () => {
  it("gọi /vehicles theo bộ lọc trên URL, sắp theo biển số", async () => {
    search = "status=active&q=vios&courseCode=B&page=2"
    const { fn } = setup()
    renderWithClient(<VehicleList />)

    expect(await screen.findByText("Toyota Vios 1.5G")).toBeInTheDocument()
    const [url] = urlsOf(fn, "/vehicles")
    expect(Object.fromEntries(url.searchParams)).toEqual({
      status: "active",
      q: "vios",
      courseCode: "B",
      page: "2",
      limit: "20",
      sort: "plate",
    })
    expect(screen.getByText("3 xe")).toBeInTheDocument()
  })

  it("hiện cột hạng + số, km, km DAT, ngày bảo dưỡng và badge đăng kiểm", async () => {
    setup()
    renderWithClient(<VehicleList />)
    const table = await screen.findByRole("table")

    const row = (await within(table).findByText("64A-123.45")).closest("tr")!
    expect(row).toHaveTextContent("B · Số tự động")
    expect(row).toHaveTextContent("Tân Ngãi")
    expect(row).toHaveTextContent("128.400 km")
    expect(row).toHaveTextContent("1.240 km")
    expect(row).toHaveTextContent("12/09/2026")
    expect(row).toHaveTextContent("12/12/2026")
    expect(row).toHaveTextContent("08/10/2026")
    expect(await within(row).findByText("Quá hạn")).toBeInTheDocument()
    expect(within(row).getByText("Đang chạy")).toBeInTheDocument()

    const motor = within(table).getByText("64B1-234.56").closest("tr")!
    expect(motor).toHaveTextContent("A1")
    expect(motor).not.toHaveTextContent("Số")
    expect(within(motor).getAllByText("—").length).toBeGreaterThanOrEqual(2)
    expect(within(motor).getByText("Sắp đến hạn")).toBeInTheDocument()
    expect(within(motor).getByText("Bảo dưỡng")).toBeInTheDocument()

    const other = within(table).getByText("64A-555.66").closest("tr")!
    expect(other).toHaveTextContent("B · Số sàn")
    expect(within(other).queryByText("Quá hạn")).not.toBeInTheDocument()
    expect(within(other).queryByText("Sắp đến hạn")).not.toBeInTheDocument()
  })

  it("lọc hạng ghi courseCode lên URL và về trang 1", async () => {
    search = "page=3"
    setup()
    renderWithClient(<VehicleList />)
    await screen.findByText("Toyota Vios 1.5G")

    await choose(screen.getByRole("combobox", { name: /Hạng/ }), "C1")
    expect(replace).toHaveBeenCalledWith("/admin/xe-tap-lai?courseCode=C1", {
      scroll: false,
    })
  })

  it("thêm xe: biển số sai định dạng → lỗi tại ô, không gọi API", async () => {
    const { calls } = setup()
    renderWithClient(<VehicleList />)
    await screen.findByText("Toyota Vios 1.5G")
    await userEvent.click(screen.getByRole("button", { name: "Thêm xe" }))
    const dialog = await screen.findByRole("dialog")

    expect(within(dialog).getByText(/64A-123\.45/)).toBeInTheDocument()
    const plate = within(dialog).getByLabelText(/Biển số/)
    await userEvent.type(plate, "64-12345")
    await userEvent.type(within(dialog).getByLabelText(/Dòng xe/), "Vios")
    await userEvent.type(within(dialog).getByLabelText(/^Số km/), "12.5")
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Thêm xe" })
    )

    const error = within(dialog).getByText(
      "Biển số không hợp lệ (vd 64A-123.45)"
    )
    expect(plate).toHaveAttribute("aria-describedby", error.id)
    expect(within(dialog).getByText("Chọn hạng bằng")).toBeInTheDocument()
    expect(
      within(dialog).getByText("Số km là số nguyên từ 0")
    ).toBeInTheDocument()
    expect(countOf(calls, "POST /vehicles")).toBe(0)
  })

  it("thêm xe → POST /vehicles với biển số chuẩn hoá, ngày yyyy-MM-dd, số km nguyên", async () => {
    const { calls } = setup({
      "POST /vehicles": () =>
        jsonResponse(201, {
          data: vehicle({ id: "v9", plate: "64A-999.99" }),
        }),
    })
    renderWithClient(<VehicleList />)
    await screen.findByText("Toyota Vios 1.5G")
    await userEvent.click(screen.getByRole("button", { name: "Thêm xe" }))
    const dialog = await screen.findByRole("dialog")

    await userEvent.type(
      within(dialog).getByLabelText(/Biển số/),
      " 64a-999.99 "
    )
    await userEvent.type(
      within(dialog).getByLabelText(/Dòng xe/),
      "Toyota Vios"
    )
    await choose(within(dialog).getByRole("combobox", { name: /Hạng/ }), "B")
    await choose(
      within(dialog).getByRole("combobox", { name: /^Số$/ }),
      "Số sàn"
    )
    await userEvent.type(within(dialog).getByLabelText(/^Số km/), "1500")
    await userEvent.type(within(dialog).getByLabelText(/Km DAT/), "0")
    fireEvent.change(within(dialog).getByLabelText(/Hạn đăng kiểm/), {
      target: { value: "2027-03-15" },
    })
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Thêm xe" })
    )

    await waitFor(() =>
      expect(bodyOf(calls, "POST /vehicles")).toEqual({
        plate: "64A-999.99",
        model: "Toyota Vios",
        courseCode: "B",
        branchId: "b1",
        transmission: "manual",
        odometer: 1500,
        datKm: 0,
        registrationExpiresAt: "2027-03-15",
        status: "active",
      })
    )
    expect(toastSuccess).toHaveBeenCalledWith("Đã thêm xe 64A-999.99")
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
  })

  it("sửa xe → PATCH chỉ trường đổi, xoá ngày gửi null", async () => {
    const { calls } = setup({
      "PATCH /vehicles/v1": () =>
        jsonResponse(200, { data: vehicle({ odometer: 130000 }) }),
    })
    renderWithClient(<VehicleList />)
    const dialog = await openRow("64A-123.45")

    expect(within(dialog).getByLabelText(/BD gần nhất/)).toHaveValue(
      "2026-09-12"
    )
    const odometer = within(dialog).getByLabelText(/^Số km/)
    await userEvent.clear(odometer)
    await userEvent.type(odometer, "130000")
    fireEvent.change(within(dialog).getByLabelText(/BD kế tiếp/), {
      target: { value: "" },
    })
    await choose(
      within(dialog).getByRole("combobox", { name: /Trạng thái/ }),
      "Bảo dưỡng"
    )
    await userEvent.click(within(dialog).getByRole("button", { name: "Lưu" }))

    await waitFor(() =>
      expect(bodyOf(calls, "PATCH /vehicles/v1")).toEqual({
        odometer: 130000,
        nextServiceAt: null,
        status: "maintenance",
      })
    )
    expect(toastSuccess).toHaveBeenCalledWith("Đã lưu xe 64A-123.45")
  })

  it("biển số trùng (409) → lỗi dưới ô Biển số, sheet vẫn mở", async () => {
    setup({
      "PATCH /vehicles/v1": () =>
        jsonResponse(409, {
          error: {
            code: "CONFLICT",
            message: "Biển số đã tồn tại",
            details: [{ path: "body.plate", message: "Đã tồn tại" }],
          },
        }),
    })
    renderWithClient(<VehicleList />)
    const dialog = await openRow("64A-123.45")
    const plate = within(dialog).getByLabelText(/Biển số/)
    await userEvent.clear(plate)
    await userEvent.type(plate, "64A-555.66")
    await userEvent.click(within(dialog).getByRole("button", { name: "Lưu" }))

    expect(await within(dialog).findByText("Đã tồn tại")).toBeInTheDocument()
    expect(toastError).not.toHaveBeenCalled()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("xoá xe → DELETE, đóng sheet", async () => {
    const { calls } = setup({ "DELETE /vehicles/v1": () => jsonResponse(204) })
    renderWithClient(<VehicleList />)
    const dialog = await openRow("64A-123.45")
    await userEvent.click(within(dialog).getByRole("button", { name: "Xoá" }))
    const confirm = await screen.findByRole("alertdialog")
    await userEvent.click(
      within(confirm).getByRole("button", { name: "Xoá xe" })
    )

    await waitFor(() => expect(countOf(calls, "DELETE /vehicles/v1")).toBe(1))
    expect(toastSuccess).toHaveBeenCalledWith("Đã xoá xe 64A-123.45")
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
  })

  it("chỉ có vehicle.read: không nút thêm/lưu/xoá", async () => {
    auth = { user: manager, permissions: ["vehicle.read"] }
    setup()
    renderWithClient(<VehicleList />)
    await screen.findByText("Toyota Vios 1.5G")
    expect(
      screen.queryByRole("button", { name: "Thêm xe" })
    ).not.toBeInTheDocument()

    const dialog = await openRow("64A-123.45")
    expect(within(dialog).getByText("Toyota Vios 1.5G")).toBeInTheDocument()
    expect(
      within(dialog).queryByRole("button", { name: "Lưu" })
    ).not.toBeInTheDocument()
    expect(
      within(dialog).queryByRole("button", { name: "Xoá" })
    ).not.toBeInTheDocument()
  })

  it("giáo viên không có vehicle.read → trang bị chặn", () => {
    const instructor = ["class.read", "student.read", "exam.read"]
    expect(canAccess("/admin/xe-tap-lai", instructor)).toBe(false)
    expect(canAccess("/admin/xe-tap-lai", ["vehicle.read"])).toBe(true)
  })
})
