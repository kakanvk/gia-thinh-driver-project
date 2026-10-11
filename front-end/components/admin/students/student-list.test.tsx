import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { StudentList } from "@/components/admin/students/student-list"
import { makeQueryClient } from "@/components/providers/query-provider"
import { todayVn } from "@/lib/admin/datetime"
import type { Student, TrainingClass } from "@/lib/admin/types"
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
  usePathname: () => "/admin/hoc-vien",
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
const CONSULTANT_PERMISSIONS = [
  "lead.read",
  "lead.create",
  "lead.update",
  "appointment.*",
  "student.read",
  "student.create",
  "student.update",
]
const MANAGER_PERMISSIONS = ["lead.*", "student.*", "class.*", "exam.*"]
const INSTRUCTOR_PERMISSIONS = ["class.read", "student.read", "exam.read"]

function student(overrides: Partial<Student> = {}): Student {
  return {
    id: "s1",
    code: "HV0001",
    name: "Nguyễn Văn An",
    phone: "0901234567",
    email: null,
    dob: null,
    idNumber: null,
    address: null,
    courseId: "c1",
    courseCode: "B-SO-SAN",
    branchId: "b1",
    classId: "k1",
    leadId: null,
    status: "studying",
    enrolledAt: "2026-10-01T00:00:00+07:00",
    note: null,
    createdAt: "2026-10-01T09:00:00+07:00",
    updatedAt: "2026-10-01T09:00:00+07:00",
    ...overrides,
  }
}

function trainingClass(overrides: Partial<TrainingClass> = {}): TrainingClass {
  return {
    id: "k1",
    code: "B-K12",
    courseId: "c1",
    courseCode: "B-SO-SAN",
    transmission: "manual",
    branchId: "b1",
    instructorId: null,
    startDate: "2026-10-05T00:00:00+07:00",
    endDate: "2027-01-05T00:00:00+07:00",
    scheduleText: "T2-T4-T6",
    capacity: 30,
    status: "enrolling",
    note: null,
    filled: 10,
    seatsLeft: 20,
    course: { id: "c1", code: "B-SO-SAN", name: "B số sàn" },
    instructor: null,
    createdAt: "2026-10-01T09:00:00+07:00",
    updatedAt: "2026-10-01T09:00:00+07:00",
    ...overrides,
  }
}

const studentsPage = {
  data: [
    student(),
    student({
      id: "s2",
      code: "HV0002",
      name: "Lê Thị Bình",
      phone: "0907654321",
      classId: null,
      status: "paused",
      enrolledAt: "2026-09-15T00:00:00+07:00",
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
  "GET /courses": () =>
    jsonResponse(200, {
      data: [{ id: "c1", code: "B-SO-SAN", name: "B số sàn" }],
      meta: { page: 1, limit: 100, total: 1 },
    }),
  "GET /classes": () =>
    jsonResponse(200, {
      data: [
        trainingClass(),
        trainingClass({ id: "k2", code: "B-K13", seatsLeft: 0, filled: 30 }),
        trainingClass({ id: "k3", code: "B-K01", status: "finished" }),
      ],
      meta: { page: 1, limit: 100, total: 3 },
    }),
}

function setup(extra: Parameters<typeof mockFetch>[0] = {}) {
  return mockFetch({
    "GET /students": () => jsonResponse(200, studentsPage),
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

function renderList() {
  const client = makeQueryClient()
  client.setDefaultOptions({ queries: { retry: false } })
  return render(
    <QueryClientProvider client={client}>
      <StudentList />
    </QueryClientProvider>
  )
}

async function choose(trigger: HTMLElement, option: string) {
  await userEvent.click(trigger)
  await userEvent.click(await screen.findByRole("option", { name: option }))
}

async function openAddSheet() {
  await userEvent.click(
    await screen.findByRole("button", { name: /Thêm học viên/ })
  )
  return screen.findByRole("dialog")
}

async function fillRequired(dialog: HTMLElement) {
  await userEvent.type(within(dialog).getByLabelText(/Họ và tên/), "Võ Minh Khang")
  await userEvent.type(within(dialog).getByLabelText(/Số điện thoại/), "0911222333")
  await choose(
    within(dialog).getByRole("combobox", { name: /Gói học/ }),
    "B-SO-SAN · B số sàn"
  )
}

beforeEach(() => {
  toastSuccess.mockClear()
  toastError.mockClear()
  replace.mockClear()
  push.mockClear()
  search = ""
  setAccessToken("t1")
  auth = { user: consultant, permissions: CONSULTANT_PERMISSIONS }
})

describe("StudentList", () => {
  it("gọi /students theo bộ lọc trên URL và hiển thị các cột", async () => {
    search = "status=studying&page=2"
    auth = {
      user: { ...consultant, role: "branch_manager" },
      permissions: MANAGER_PERMISSIONS,
    }
    const { fn } = setup()
    renderList()

    expect(await screen.findByText("Nguyễn Văn An")).toBeInTheDocument()
    const [url] = urlsOf(fn, "/students")
    expect(Object.fromEntries(url.searchParams)).toEqual({
      status: "studying",
      page: "2",
      limit: "20",
      sort: "-createdAt",
    })

    const first = screen.getByText("Nguyễn Văn An").closest("tr")!
    await waitFor(() =>
      expect(within(first).getByText("Tân Ngãi")).toBeInTheDocument()
    )
    await waitFor(() =>
      expect(within(first).getByText("B-K12")).toBeInTheDocument()
    )
    expect(within(first).getByText("HV0001")).toBeInTheDocument()
    expect(within(first).getByText("0901234567")).toBeInTheDocument()
    expect(within(first).getByText("B-SO-SAN")).toBeInTheDocument()
    expect(within(first).getByText("Đang học")).toBeInTheDocument()
    expect(within(first).getByText("01/10/2026")).toBeInTheDocument()

    const second = screen.getByText("Lê Thị Bình").closest("tr")!
    expect(within(second).getByText("Chưa xếp lớp")).toBeInTheDocument()
    expect(within(second).getByText("Tạm dừng")).toBeInTheDocument()
    expect(within(second).getByText("15/09/2026")).toBeInTheDocument()
    expect(screen.getByText("Trang 2/3 · 45 bản ghi")).toBeInTheDocument()

    await userEvent.click(first)
    expect(push).toHaveBeenCalledWith("/admin/hoc-vien/s1")
  })

  it("lọc trạng thái ghi lên URL, bỏ page", async () => {
    search = "page=3"
    setup()
    renderList()
    await screen.findByText("Nguyễn Văn An")
    await choose(
      screen.getByRole("combobox", { name: "Trạng thái" }),
      "Thôi học"
    )
    expect(replace).toHaveBeenLastCalledWith("/admin/hoc-vien?status=dropped", {
      scroll: false,
    })
  })

  it("tư vấn viên thấy Thêm học viên, không gọi /classes (không có class.read)", async () => {
    const { fn } = setup()
    renderList()
    await screen.findByText("Nguyễn Văn An")
    expect(
      screen.getByRole("button", { name: /Thêm học viên/ })
    ).toBeInTheDocument()
    expect(urlsOf(fn, "/classes")).toHaveLength(0)
  })

  it("tài khoản giáo viên không thấy Thêm học viên", async () => {
    auth = {
      user: { ...consultant, id: "u7", role: "instructor" },
      permissions: INSTRUCTOR_PERMISSIONS,
    }
    setup()
    renderList()
    await screen.findByText("Nguyễn Văn An")
    expect(
      screen.queryByRole("button", { name: /Thêm học viên/ })
    ).not.toBeInTheDocument()
  })

  it("thêm học viên: gửi đúng body, toast có mã và mở trang chi tiết", async () => {
    const { calls } = setup({
      "POST /students": () =>
        jsonResponse(201, {
          data: student({ id: "s9", code: "HV0009", name: "Võ Minh Khang" }),
        }),
    })
    renderList()
    const dialog = await openAddSheet()
    expect(
      within(dialog).queryByRole("combobox", { name: /Chi nhánh/ })
    ).not.toBeInTheDocument()
    // Tư vấn viên không có class.read: không có ô Lớp
    expect(
      within(dialog).queryByRole("combobox", { name: "Lớp" })
    ).not.toBeInTheDocument()
    expect(
      within(dialog).getByText("Sổ học phí được tạo tự động.")
    ).toBeInTheDocument()
    expect(within(dialog).getByLabelText("Ngày nhập học")).toHaveValue(
      todayVn()
    )

    await fillRequired(dialog)
    fireEvent.change(within(dialog).getByLabelText("Ngày sinh"), {
      target: { value: "2000-01-02" },
    })
    await userEvent.type(within(dialog).getByLabelText(/CCCD/), "012345678901")
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Thêm học viên" })
    )

    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/hoc-vien/s9"))
    expect(toastSuccess).toHaveBeenCalledWith("Đã thêm học viên HV0009")
    expect(bodyOf(calls, "POST /students")).toEqual({
      name: "Võ Minh Khang",
      phone: "0911222333",
      courseId: "c1",
      branchId: "b1",
      dob: "2000-01-02",
      idNumber: "012345678901",
      enrolledAt: todayVn(),
    })
    expect(calls.filter((call) => call.key === "POST /students")).toHaveLength(1)
  })

  it("thêm học viên (quản lý): chọn lớp theo chi nhánh + gói, ẩn lớp đã kết thúc, lớp hết chỗ bị vô hiệu", async () => {
    auth = {
      user: { ...consultant, role: "branch_manager" },
      permissions: MANAGER_PERMISSIONS,
    }
    const { fn, calls } = setup({
      "POST /students": () =>
        jsonResponse(201, { data: student({ id: "s9", code: "HV0009" }) }),
    })
    renderList()
    const dialog = await openAddSheet()
    await fillRequired(dialog)

    await waitFor(() =>
      expect(
        urlsOf(fn, "/classes").some(
          (url) =>
            url.searchParams.get("branchId") === "b1" &&
            url.searchParams.get("courseId") === "c1" &&
            url.searchParams.get("limit") === "100"
        )
      ).toBe(true)
    )
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Lớp" }))
    expect(
      await screen.findByRole("option", { name: /B-K12/ })
    ).toBeInTheDocument()
    expect(screen.getByRole("option", { name: /B-K13/ })).toHaveAttribute(
      "aria-disabled",
      "true"
    )
    expect(
      screen.queryByRole("option", { name: /B-K01/ })
    ).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("option", { name: /B-K12/ }))
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Thêm học viên" })
    )

    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/hoc-vien/s9"))
    expect(bodyOf(calls, "POST /students")).toMatchObject({
      courseId: "c1",
      branchId: "b1",
      classId: "k1",
    })
  })

  it("thêm học viên: CCCD 11 số báo lỗi tại ô, không gọi API", async () => {
    const { calls } = setup()
    renderList()
    const dialog = await openAddSheet()
    await fillRequired(dialog)
    await userEvent.type(within(dialog).getByLabelText(/CCCD/), "01234567890")
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Thêm học viên" })
    )
    const message = within(dialog).getByText("CCCD gồm 12 chữ số")
    expect(within(dialog).getByLabelText(/CCCD/)).toHaveAttribute(
      "aria-describedby",
      message.id
    )
    expect(calls.some((call) => call.key === "POST /students")).toBe(false)
  })

  it("thêm học viên: thiếu tên/SĐT/gói báo lỗi tại ô", async () => {
    const { calls } = setup()
    renderList()
    const dialog = await openAddSheet()
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Thêm học viên" })
    )
    expect(within(dialog).getByText("Nhập họ và tên")).toBeInTheDocument()
    expect(within(dialog).getByText("Nhập số điện thoại")).toBeInTheDocument()
    expect(within(dialog).getByText("Chọn gói học")).toBeInTheDocument()
    expect(calls.some((call) => call.key === "POST /students")).toBe(false)
  })

  it("thêm học viên: lỗi 400 body.phone hiện dưới ô, sheet vẫn mở", async () => {
    setup({
      "POST /students": () =>
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
    const dialog = await openAddSheet()
    await fillRequired(dialog)
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Thêm học viên" })
    )

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
})
