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

import { ClassDetail } from "@/components/admin/classes/class-detail"
import { ClassList } from "@/components/admin/classes/class-list"
import { makeQueryClient } from "@/components/providers/query-provider"
import type { Instructor, Student, TrainingClass } from "@/lib/admin/types"
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
  usePathname: () => "/admin/lop-hoc",
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
const MANAGER_PERMISSIONS = [
  "lead.*",
  "student.*",
  "class.*",
  "instructor.*",
  "exam.*",
]
const INSTRUCTOR_PERMISSIONS = ["class.read", "student.read", "exam.read"]
const instructorUser = { ...manager, id: "u7", role: "instructor" }

function trainingClass(overrides: Partial<TrainingClass> = {}): TrainingClass {
  return {
    id: "k1",
    code: "B-K12",
    courseId: "c1",
    courseCode: "B-SO-SAN",
    transmission: "manual",
    branchId: "b1",
    instructorId: "i1",
    startDate: "2026-10-05T00:00:00+07:00",
    endDate: "2027-01-05T00:00:00+07:00",
    scheduleText: "T2-T4-T6 tối",
    capacity: 30,
    status: "enrolling",
    note: null,
    filled: 10,
    seatsLeft: 20,
    course: { id: "c1", code: "B-SO-SAN", name: "B số sàn" },
    instructor: { id: "i1", name: "Thầy Hùng" },
    createdAt: "2026-10-01T09:00:00+07:00",
    updatedAt: "2026-10-01T09:00:00+07:00",
    ...overrides,
  }
}

function student(overrides: Partial<Student> = {}): Student {
  return {
    id: "s1",
    code: "HV0001",
    name: "Nguyễn Văn An",
    phone: "0901234567",
    email: null,
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

function instructor(overrides: Partial<Instructor> = {}): Instructor {
  return {
    id: "i1",
    name: "Thầy Hùng",
    phone: "0909000111",
    userId: null,
    specialties: ["B"],
    branchId: "b1",
    status: "active",
    note: null,
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
      ],
      meta: { page: 1, limit: 100, total: 1 },
    }),
  "GET /courses": () =>
    jsonResponse(200, {
      data: [{ id: "c1", code: "B-SO-SAN", name: "B số sàn" }],
      meta: { page: 1, limit: 100, total: 1 },
    }),
  "GET /instructors": () =>
    jsonResponse(200, {
      data: [
        instructor(),
        instructor({ id: "i2", name: "Cô Lan", specialties: ["A1"] }),
      ],
      meta: { page: 1, limit: 100, total: 2 },
    }),
}

const classesPage = {
  data: [
    trainingClass(),
    trainingClass({
      id: "k2",
      code: "B1-K03",
      courseCode: "B1",
      course: { id: "c2", code: "B1", name: "B tự động" },
      transmission: "automatic",
      instructorId: null,
      instructor: null,
      capacity: 20,
      filled: 20,
      seatsLeft: 0,
      status: "ongoing",
    }),
  ],
  meta: { page: 2, limit: 20, total: 45 },
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

beforeEach(() => {
  toastSuccess.mockClear()
  toastError.mockClear()
  replace.mockClear()
  push.mockClear()
  search = ""
  setAccessToken("t1")
  auth = { user: manager, permissions: MANAGER_PERMISSIONS }
})

describe("ClassList", () => {
  function setup(extra: Parameters<typeof mockFetch>[0] = {}) {
    return mockFetch({
      "GET /classes": () => jsonResponse(200, classesPage),
      ...lookups,
      ...extra,
    })
  }

  it("gọi /classes theo bộ lọc trên URL, hiện cột, sĩ số và dòng N lớp", async () => {
    search = "status=enrolling&instructorId=i1&page=2"
    const { fn } = setup()
    renderWithClient(<ClassList />)

    expect(await screen.findByText("B-K12")).toBeInTheDocument()
    const [url] = urlsOf(fn, "/classes")
    expect(Object.fromEntries(url.searchParams)).toEqual({
      status: "enrolling",
      instructorId: "i1",
      page: "2",
      limit: "20",
      sort: "-startDate",
    })
    expect(screen.getByText("45 lớp")).toBeInTheDocument()

    const first = screen.getByText("B-K12").closest("tr")!
    expect(within(first).getByText("B-SO-SAN · Số sàn")).toBeInTheDocument()
    await waitFor(() =>
      expect(within(first).getByText("Tân Ngãi")).toBeInTheDocument()
    )
    expect(
      within(first).getByText("05/10/2026 – 05/01/2027")
    ).toBeInTheDocument()
    expect(within(first).getByText("T2-T4-T6 tối")).toBeInTheDocument()
    expect(within(first).getByText("Thầy Hùng")).toBeInTheDocument()
    expect(within(first).getByText("10/30")).toBeInTheDocument()
    expect(
      within(first).getByRole("meter", { name: "Sĩ số B-K12" })
    ).toHaveAttribute("aria-valuenow", "10")
    expect(within(first).getByText("Đang nhận hồ sơ")).toBeInTheDocument()

    const second = screen.getByText("B1-K03").closest("tr")!
    expect(within(second).getByText("B1 · Số tự động")).toBeInTheDocument()
    expect(within(second).getByText("20/20")).toBeInTheDocument()
    expect(within(second).getByText("Chưa phân công")).toBeInTheDocument()
    expect(within(second).getByText("Đang học")).toBeInTheDocument()

    await userEvent.click(first)
    expect(push).toHaveBeenCalledWith("/admin/lop-hoc/k1")
  })

  it("lọc giáo viên ghi lên URL, bỏ page", async () => {
    search = "page=3"
    setup()
    renderWithClient(<ClassList />)
    await screen.findByText("B-K12")
    await choose(screen.getByRole("combobox", { name: "Giáo viên" }), "Cô Lan")
    expect(replace).toHaveBeenLastCalledWith("/admin/lop-hoc?instructorId=i2", {
      scroll: false,
    })
  })

  it("tài khoản giáo viên: không có Mở lớp, không lọc giáo viên, không gọi /instructors", async () => {
    auth = { user: instructorUser, permissions: INSTRUCTOR_PERMISSIONS }
    const { fn } = setup()
    renderWithClient(<ClassList />)
    await screen.findByText("B-K12")
    expect(
      screen.queryByRole("button", { name: /Mở lớp/ })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("combobox", { name: "Giáo viên" })
    ).not.toBeInTheDocument()
    expect(urlsOf(fn, "/instructors")).toHaveLength(0)
  })

  it("mở lớp: mã tự in hoa, ngày yyyy-MM-dd, sức chứa số, mở trang chi tiết", async () => {
    const { fn, calls } = setup({
      "POST /classes": () =>
        jsonResponse(201, {
          data: trainingClass({ id: "k9", code: "B-2610" }),
        }),
    })
    renderWithClient(<ClassList />)
    await userEvent.click(await screen.findByRole("button", { name: /Mở lớp/ }))
    const dialog = await screen.findByRole("dialog")

    const code = within(dialog).getByLabelText(/Mã lớp/)
    await userEvent.type(code, "b-2610")
    expect(code).toHaveValue("B-2610")
    await choose(
      within(dialog).getByRole("combobox", { name: /Gói học/ }),
      "B-SO-SAN · B số sàn"
    )
    fireEvent.change(within(dialog).getByLabelText(/Ngày khai giảng/), {
      target: { value: "2026-10-26" },
    })
    fireEvent.change(within(dialog).getByLabelText(/Ngày kết thúc/), {
      target: { value: "2027-01-26" },
    })
    await userEvent.type(within(dialog).getByLabelText(/Lịch học/), "T3-T5-T7")
    await userEvent.type(within(dialog).getByLabelText(/Sức chứa/), "30")
    await choose(
      within(dialog).getByRole("combobox", { name: "Số" }),
      "Số tự động"
    )
    await waitFor(() =>
      expect(
        urlsOf(fn, "/instructors").some(
          (url) => url.searchParams.get("branchId") === "b1"
        )
      ).toBe(true)
    )
    await choose(
      within(dialog).getByRole("combobox", { name: "Giáo viên" }),
      "Thầy Hùng"
    )
    expect(
      within(dialog).getByRole("combobox", { name: "Trạng thái" })
    ).toHaveTextContent("Đang nhận hồ sơ")
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Mở lớp" })
    )

    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/lop-hoc/k9"))
    expect(toastSuccess).toHaveBeenCalledWith("Đã mở lớp B-2610")
    expect(bodyOf(calls, "POST /classes")).toEqual({
      code: "B-2610",
      courseId: "c1",
      branchId: "b1",
      startDate: "2026-10-26",
      endDate: "2027-01-26",
      scheduleText: "T3-T5-T7",
      capacity: 30,
      transmission: "automatic",
      instructorId: "i1",
      status: "enrolling",
    })
  })

  it("mở lớp: sức chứa 0 và thiếu trường bắt buộc báo lỗi tại ô, không gọi API", async () => {
    const { calls } = setup()
    renderWithClient(<ClassList />)
    await userEvent.click(await screen.findByRole("button", { name: /Mở lớp/ }))
    const dialog = await screen.findByRole("dialog")
    await userEvent.type(within(dialog).getByLabelText(/Sức chứa/), "0")
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Mở lớp" })
    )

    const message = within(dialog).getByText("Sức chứa từ 1 đến 200")
    expect(within(dialog).getByLabelText(/Sức chứa/)).toHaveAttribute(
      "aria-describedby",
      message.id
    )
    expect(within(dialog).getByText("Nhập mã lớp")).toBeInTheDocument()
    expect(within(dialog).getByText("Chọn gói học")).toBeInTheDocument()
    expect(within(dialog).getByText("Chọn ngày khai giảng")).toBeInTheDocument()
    expect(countOf(calls, "POST /classes")).toBe(0)
  })

  it("mở lớp: lỗi 409 mã trùng hiện dưới ô Mã lớp", async () => {
    setup({
      "POST /classes": () =>
        jsonResponse(409, {
          error: {
            code: "CONFLICT",
            message: "Mã lớp đã tồn tại",
            details: [{ path: "body.code", message: "Đã tồn tại" }],
          },
        }),
    })
    renderWithClient(<ClassList />)
    await userEvent.click(await screen.findByRole("button", { name: /Mở lớp/ }))
    const dialog = await screen.findByRole("dialog")
    await userEvent.type(within(dialog).getByLabelText(/Mã lớp/), "B-K12")
    await choose(
      within(dialog).getByRole("combobox", { name: /Gói học/ }),
      "B-SO-SAN · B số sàn"
    )
    fireEvent.change(within(dialog).getByLabelText(/Ngày khai giảng/), {
      target: { value: "2026-10-26" },
    })
    fireEvent.change(within(dialog).getByLabelText(/Ngày kết thúc/), {
      target: { value: "2027-01-26" },
    })
    await userEvent.type(within(dialog).getByLabelText(/Lịch học/), "T3-T5-T7")
    await userEvent.type(within(dialog).getByLabelText(/Sức chứa/), "30")
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Mở lớp" })
    )

    expect(await within(dialog).findByText("Đã tồn tại")).toBeInTheDocument()
    expect(toastError).not.toHaveBeenCalled()
  })
})

describe("ClassDetail", () => {
  const classStudents = [
    student(),
    student({
      id: "s7",
      code: "HV0007",
      name: "Trần Thị Bích",
      phone: "0907000777",
      status: "paused",
    }),
  ]

  function setup(extra: Parameters<typeof mockFetch>[0] = {}) {
    return mockFetch({
      "GET /classes/k1": () => jsonResponse(200, { data: trainingClass() }),
      "GET /classes/k1/students": () =>
        jsonResponse(200, { data: classStudents }),
      ...lookups,
      ...extra,
    })
  }

  it("404 → Không tìm thấy lớp học + link danh sách", async () => {
    setup({
      "GET /classes/k1": () =>
        jsonResponse(404, {
          error: { code: "NOT_FOUND", message: "Không tìm thấy lớp học" },
        }),
    })
    renderWithClient(<ClassDetail id="k1" />)
    expect(
      await screen.findByText("Không tìm thấy lớp học")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /Về danh sách lớp/ })
    ).toHaveAttribute("href", "/admin/lop-hoc")
  })

  it("thông tin lớp và bảng học viên từ /classes/k1/students", async () => {
    setup()
    renderWithClient(<ClassDetail id="k1" />)
    expect(
      await screen.findByRole("heading", { name: "B-K12" })
    ).toBeInTheDocument()
    expect(screen.getByText("B-SO-SAN · Số sàn")).toBeInTheDocument()
    expect(screen.getByText("05/10/2026 – 05/01/2027")).toBeInTheDocument()
    expect(screen.getByText("Thầy Hùng")).toBeInTheDocument()
    expect(screen.getByText("10/30 · còn 20 chỗ")).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByText("Tân Ngãi")).toBeInTheDocument()
    )

    const link = await screen.findByRole("link", { name: "Nguyễn Văn An" })
    expect(link).toHaveAttribute("href", "/admin/hoc-vien/s1")
    const row = link.closest("tr")!
    expect(within(row).getByText("HV0001")).toBeInTheDocument()
    expect(within(row).getByText("0901234567")).toBeInTheDocument()
    expect(within(row).getByText("Đang học")).toBeInTheDocument()
    const paused = screen
      .getByRole("link", { name: "Trần Thị Bích" })
      .closest("tr")!
    expect(within(paused).getByText("Tạm dừng")).toBeInTheDocument()

    for (const name of [/Sửa/, /Xếp học viên/, /Xoá lớp/]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument()
    }
  })

  it("Bỏ khỏi lớp: xác nhận → PATCH /students/s1/class { classId: null }, làm mới lớp", async () => {
    const { calls } = setup({
      "PATCH /students/s1/class": () =>
        jsonResponse(200, { data: student({ classId: null }) }),
    })
    renderWithClient(<ClassDetail id="k1" />)
    const row = (
      await screen.findByRole("link", { name: "Nguyễn Văn An" })
    ).closest("tr")!
    const before = countOf(calls, "GET /classes/k1/students")
    await userEvent.click(
      within(row).getByRole("button", { name: /Bỏ khỏi lớp/ })
    )
    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText(/Nguyễn Văn An/)).toBeInTheDocument()
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Bỏ khỏi lớp" })
    )
    await waitFor(() =>
      expect(bodyOf(calls, "PATCH /students/s1/class")).toEqual({
        classId: null,
      })
    )
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Đã bỏ Nguyễn Văn An khỏi lớp")
    )
    await waitFor(() =>
      expect(countOf(calls, "GET /classes/k1/students")).toBeGreaterThan(before)
    )
  })

  it("Xếp học viên: tìm theo chi nhánh + gói + Đang học, ẩn người đã có lớp, báo lỗi từng học viên", async () => {
    const candidates = [
      student({ id: "s2", code: "HV0002", name: "Lê Văn Anh", classId: null }),
      student({ id: "s3", code: "HV0003", name: "Phạm Thị Ân", classId: null }),
      student({ id: "s4", code: "HV0004", name: "Võ Thanh An", classId: null }),
      student({ id: "s5", code: "HV0005", name: "Đỗ An Khang", classId: "k8" }),
    ]
    const { fn, calls } = setup({
      "GET /students": () =>
        jsonResponse(200, {
          data: candidates,
          meta: { page: 1, limit: 20, total: 4 },
        }),
      "PATCH /students/s2/class": () =>
        jsonResponse(200, { data: student({ id: "s2" }) }),
      "PATCH /students/s3/class": () =>
        jsonResponse(200, { data: student({ id: "s3" }) }),
      "PATCH /students/s4/class": () =>
        jsonResponse(409, {
          error: { code: "CONFLICT", message: "Lớp B-K12 đã đủ 30 học viên" },
        }),
    })
    renderWithClient(<ClassDetail id="k1" />)
    await userEvent.click(
      await screen.findByRole("button", { name: /Xếp học viên/ })
    )
    const dialog = await screen.findByRole("dialog")
    await userEvent.type(
      within(dialog).getByRole("searchbox", { name: /Tìm học viên/ }),
      "an"
    )
    await waitFor(() =>
      expect(
        urlsOf(fn, "/students").some(
          (url) => url.searchParams.get("q") === "an"
        )
      ).toBe(true)
    )
    const url = urlsOf(fn, "/students").find(
      (item) => item.searchParams.get("q") === "an"
    )!
    expect(Object.fromEntries(url.searchParams)).toEqual({
      branchId: "b1",
      courseId: "c1",
      status: "studying",
      q: "an",
      limit: "20",
    })

    expect(
      await within(dialog).findByRole("checkbox", { name: /Lê Văn Anh/ })
    ).toBeInTheDocument()
    expect(within(dialog).queryByText(/Đỗ An Khang/)).not.toBeInTheDocument()

    for (const name of [/Lê Văn Anh/, /Phạm Thị Ân/, /Võ Thanh An/]) {
      await userEvent.click(within(dialog).getByRole("checkbox", { name }))
    }
    const classGets = countOf(calls, "GET /classes/k1")
    const studentGets = countOf(calls, "GET /classes/k1/students")
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Xếp 3 học viên" })
    )

    expect(
      await within(dialog).findByText("Đã xếp 2 học viên")
    ).toBeInTheDocument()
    const failures = within(dialog).getAllByRole("listitem")
    expect(failures).toHaveLength(1)
    expect(failures[0]).toHaveTextContent(
      "Võ Thanh An (HV0004): Lớp B-K12 đã đủ 30 học viên"
    )
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(
      calls
        .filter((call) => /^PATCH \/students\/s\d\/class$/.test(call.key))
        .map((call) => call.key)
    ).toEqual([
      "PATCH /students/s2/class",
      "PATCH /students/s3/class",
      "PATCH /students/s4/class",
    ])
    expect(bodyOf(calls, "PATCH /students/s2/class")).toEqual({
      classId: "k1",
    })
    await waitFor(() =>
      expect(countOf(calls, "GET /classes/k1")).toBeGreaterThan(classGets)
    )
    await waitFor(() =>
      expect(countOf(calls, "GET /classes/k1/students")).toBeGreaterThan(
        studentGets
      )
    )
    expect(toastError).not.toHaveBeenCalled()
  })

  it("Xếp học viên: tất cả thành công → toast, đóng sheet", async () => {
    setup({
      "GET /students": () =>
        jsonResponse(200, {
          data: [student({ id: "s2", name: "Lê Văn Anh", classId: null })],
          meta: { page: 1, limit: 20, total: 1 },
        }),
      "PATCH /students/s2/class": () =>
        jsonResponse(200, { data: student({ id: "s2" }) }),
    })
    renderWithClient(<ClassDetail id="k1" />)
    await userEvent.click(
      await screen.findByRole("button", { name: /Xếp học viên/ })
    )
    const dialog = await screen.findByRole("dialog")
    await userEvent.click(
      await within(dialog).findByRole("checkbox", { name: /Lê Văn Anh/ })
    )
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Xếp 1 học viên" })
    )
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Đã xếp 1 học viên vào lớp")
    )
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
  })

  it("sửa lớp: chỉ gửi trường đổi, lỗi sức chứa từ backend hiện dưới ô", async () => {
    const { calls } = setup({
      "PATCH /classes/k1": () =>
        jsonResponse(409, {
          error: {
            code: "CONFLICT",
            message:
              "Lớp đang có 10 học viên, không thể giảm sĩ số tối đa xuống 8",
          },
        }),
    })
    renderWithClient(<ClassDetail id="k1" />)
    await userEvent.click(await screen.findByRole("button", { name: /Sửa/ }))
    const dialog = await screen.findByRole("dialog")
    const capacity = within(dialog).getByLabelText(/Sức chứa/)
    expect(capacity).toHaveValue(30)
    expect(within(dialog).getByLabelText(/Mã lớp/)).toHaveValue("B-K12")
    await userEvent.clear(capacity)
    await userEvent.type(capacity, "8")
    await userEvent.click(within(dialog).getByRole("button", { name: "Lưu" }))

    await waitFor(() =>
      expect(bodyOf(calls, "PATCH /classes/k1")).toEqual({ capacity: 8 })
    )
    const message = await within(dialog).findByText(
      "Lớp đang có 10 học viên, không thể giảm sĩ số tối đa xuống 8"
    )
    expect(capacity).toHaveAttribute("aria-describedby", message.id)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(toastError).not.toHaveBeenCalled()
  })

  it("sửa lớp: bỏ giáo viên gửi instructorId null", async () => {
    const { calls } = setup({
      "PATCH /classes/k1": () =>
        jsonResponse(200, {
          data: trainingClass({ instructorId: null, instructor: null }),
        }),
    })
    renderWithClient(<ClassDetail id="k1" />)
    await userEvent.click(await screen.findByRole("button", { name: /Sửa/ }))
    const dialog = await screen.findByRole("dialog")
    await choose(
      within(dialog).getByRole("combobox", { name: "Giáo viên" }),
      "Chưa phân công"
    )
    await userEvent.click(within(dialog).getByRole("button", { name: "Lưu" }))
    await waitFor(() =>
      expect(bodyOf(calls, "PATCH /classes/k1")).toEqual({
        instructorId: null,
      })
    )
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Đã lưu lớp B-K12")
    )
  })

  it("xoá lớp còn học viên (409) → thông báo, không rời trang", async () => {
    setup({
      "DELETE /classes/k1": () =>
        jsonResponse(409, {
          error: {
            code: "CONFLICT",
            message:
              "Lớp còn học viên, hãy chuyển học viên sang lớp khác trước",
          },
        }),
    })
    renderWithClient(<ClassDetail id="k1" />)
    await userEvent.click(
      await screen.findByRole("button", { name: /Xoá lớp/ })
    )
    const dialog = await screen.findByRole("alertdialog")
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Xoá lớp" })
    )
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Lớp còn học viên, hãy chuyển học viên sang lớp khác trước"
      )
    )
    expect(toastError).toHaveBeenCalledTimes(1)
    expect(push).not.toHaveBeenCalled()
  })

  it("xoá lớp thành công → về danh sách", async () => {
    const { calls } = setup({
      "DELETE /classes/k1": () => jsonResponse(204),
    })
    renderWithClient(<ClassDetail id="k1" />)
    await userEvent.click(
      await screen.findByRole("button", { name: /Xoá lớp/ })
    )
    const dialog = await screen.findByRole("alertdialog")
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Xoá lớp" })
    )
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/lop-hoc"))
    expect(countOf(calls, "DELETE /classes/k1")).toBe(1)
    expect(toastSuccess).toHaveBeenCalledWith("Đã xoá lớp B-K12")
  })

  it("tài khoản giáo viên chỉ xem: không có Sửa/Xoá/Xếp/Bỏ khỏi lớp", async () => {
    auth = { user: instructorUser, permissions: INSTRUCTOR_PERMISSIONS }
    const { fn } = setup()
    renderWithClient(<ClassDetail id="k1" />)
    expect(
      await screen.findByRole("link", { name: "Nguyễn Văn An" })
    ).toBeInTheDocument()
    for (const name of [/Sửa/, /Xếp học viên/, /Xoá lớp/, /Bỏ khỏi lớp/]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument()
    }
    expect(urlsOf(fn, "/instructors")).toHaveLength(0)
  })
})
