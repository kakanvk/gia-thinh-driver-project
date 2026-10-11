import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { StudentDetail } from "@/components/admin/students/student-detail"
import { makeQueryClient } from "@/components/providers/query-provider"
import type { Student, StudentExam, TrainingClass } from "@/lib/admin/types"
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
  usePathname: () => "/admin/hoc-vien/s1",
  useSearchParams: () => new URLSearchParams(""),
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
const MANAGER_PERMISSIONS = ["lead.*", "student.*", "class.*", "exam.*"]
const CONSULTANT_PERMISSIONS = [
  "lead.read",
  "lead.create",
  "lead.update",
  "appointment.*",
  "student.read",
  "student.create",
  "student.update",
]
const INSTRUCTOR_PERMISSIONS = ["class.read", "student.read", "exam.read"]

function student(overrides: Partial<Student> = {}): Student {
  return {
    id: "s1",
    code: "HV0001",
    name: "Nguyễn Văn An",
    phone: "0901234567",
    email: "an@example.com",
    dob: "2000-01-02T00:00:00+07:00",
    idNumber: "012345678901",
    address: "12 Lê Lợi, Vĩnh Long",
    courseId: "c1",
    courseCode: "B-SO-SAN",
    branchId: "b1",
    classId: "k1",
    leadId: "l1",
    status: "studying",
    enrolledAt: "2026-10-01T00:00:00+07:00",
    note: null,
    createdAt: "2026-10-01T09:00:00+07:00",
    updatedAt: "2026-10-01T09:00:00+07:00",
    ...overrides,
  }
}

// Tài khoản giáo viên: backend bỏ hẳn dob/idNumber/address
function instructorView(): Student {
  const { dob, idNumber, address, ...rest } = student()
  void dob
  void idNumber
  void address
  return rest as Student
}

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
    scheduleText: "T2-T4-T6",
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

const exams: StudentExam[] = [
  {
    candidateId: "x2",
    sessionId: "e2",
    sessionCode: "SH-2026-11",
    type: "official",
    date: "2026-11-20T00:00:00+07:00",
    location: "Trung tâm sát hạch Vĩnh Long",
    courseCode: "B-SO-SAN",
    result: "passed",
    score: 92,
    attempt: 1,
    note: null,
  },
  {
    candidateId: "x1",
    sessionId: "e1",
    sessionCode: "TN-2026-10",
    type: "graduation",
    date: "2026-10-30T00:00:00+07:00",
    location: null,
    courseCode: "B-SO-SAN",
    result: "absent",
    score: null,
    attempt: 1,
    note: null,
  },
]

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
  "GET /classes": () =>
    jsonResponse(200, {
      data: [
        trainingClass(),
        trainingClass({ id: "k2", code: "B-K13", seatsLeft: 0, filled: 30 }),
        trainingClass({ id: "k3", code: "B-K01", status: "finished" }),
      ],
      meta: { page: 1, limit: 100, total: 3 },
    }),
  "GET /classes/k1": () => jsonResponse(200, { data: trainingClass() }),
  "GET /students/s1/exams": () => jsonResponse(200, { data: exams }),
}

function setup(
  current: Student = student(),
  extra: Parameters<typeof mockFetch>[0] = {}
) {
  return mockFetch({
    "GET /students/s1": () => jsonResponse(200, { data: current }),
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
      <StudentDetail id="s1" />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  toastSuccess.mockClear()
  toastError.mockClear()
  replace.mockClear()
  push.mockClear()
  setAccessToken("t1")
  auth = { user: manager, permissions: MANAGER_PERMISSIONS }
})

describe("StudentDetail", () => {
  it("404 → Không tìm thấy học viên + link về danh sách", async () => {
    setup(student(), {
      "GET /students/s1": () =>
        jsonResponse(404, {
          error: { code: "NOT_FOUND", message: "Không tìm thấy học viên" },
        }),
    })
    renderDetail()
    expect(
      await screen.findByText("Không tìm thấy học viên")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /Về danh sách học viên/ })
    ).toHaveAttribute("href", "/admin/hoc-vien")
  })

  it("quản lý: hồ sơ đầy đủ, link khách hàng gốc, lớp hiện tại, các lần thi", async () => {
    const { fn } = setup()
    renderDetail()

    expect(
      await screen.findByRole("heading", { name: "Nguyễn Văn An" })
    ).toBeInTheDocument()
    expect(screen.getByText("HV0001")).toBeInTheDocument()
    expect(screen.getAllByText("Đang học").length).toBeGreaterThan(0)
    expect(screen.getByText("012345678901")).toBeInTheDocument()
    expect(screen.getByText("02/01/2000")).toBeInTheDocument()
    expect(screen.getByText("12 Lê Lợi, Vĩnh Long")).toBeInTheDocument()
    expect(screen.getByText("01/10/2026")).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByText("Tân Ngãi")).toBeInTheDocument()
    )
    expect(
      screen.getByRole("link", { name: /Khách hàng gốc/ })
    ).toHaveAttribute("href", "/admin/khach-hang/l1")
    expect(await screen.findByRole("link", { name: "B-K12" })).toHaveAttribute(
      "href",
      "/admin/lop-hoc/k1"
    )
    expect(screen.getByText("Thầy Hùng")).toBeInTheDocument()

    for (const name of [/Sửa/, /Đổi trạng thái/, /Đổi lớp/, /Xoá/]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument()
    }

    const exam = await screen.findByRole("link", { name: "SH-2026-11" })
    expect(exam).toHaveAttribute("href", "/admin/lich-thi/e2")
    const row = exam.closest("tr")!
    expect(within(row).getByText("Sát hạch")).toBeInTheDocument()
    expect(within(row).getByText("20/11/2026")).toBeInTheDocument()
    expect(within(row).getByText("Đậu")).toBeInTheDocument()
    expect(within(row).getByText("92")).toBeInTheDocument()
    const absent = screen
      .getByRole("link", { name: "TN-2026-10" })
      .closest("tr")!
    expect(within(absent).getByText("Tốt nghiệp")).toBeInTheDocument()
    expect(within(absent).getByText("30/10/2026")).toBeInTheDocument()
    expect(within(absent).getByText("Vắng")).toBeInTheDocument()
    expect(urlsOf(fn, "/students/s1/exams")).toHaveLength(1)
  })

  it("tài khoản giáo viên: ẩn CCCD/ngày sinh/địa chỉ, không có nút thao tác, vẫn xem lần thi", async () => {
    auth = {
      user: { ...manager, id: "u7", role: "instructor" },
      permissions: INSTRUCTOR_PERMISSIONS,
    }
    const { fn } = setup(instructorView())
    renderDetail()

    await screen.findByRole("heading", { name: "Nguyễn Văn An" })
    expect(screen.queryByText("CCCD")).not.toBeInTheDocument()
    expect(screen.queryByText("Ngày sinh")).not.toBeInTheDocument()
    expect(screen.queryByText("Địa chỉ")).not.toBeInTheDocument()
    // Không có lead.read: không có link khách hàng gốc
    expect(
      screen.queryByRole("link", { name: /Khách hàng gốc/ })
    ).not.toBeInTheDocument()
    expect(
      await screen.findByRole("link", { name: "SH-2026-11" })
    ).toBeInTheDocument()
    expect(urlsOf(fn, "/students/s1/exams")).toHaveLength(1)
    for (const name of [/Sửa/, /Đổi trạng thái/, /Xếp lớp/, /Đổi lớp/, /Xoá/]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument()
    }
  })

  it("tư vấn viên (không có exam.read): không gọi các lần thi, không có Xoá", async () => {
    auth = {
      user: { ...manager, id: "u1", role: "consultant" },
      permissions: CONSULTANT_PERMISSIONS,
    }
    const { fn } = setup()
    renderDetail()
    await screen.findByRole("heading", { name: "Nguyễn Văn An" })
    expect(
      screen.getByRole("link", { name: /Khách hàng gốc/ })
    ).toBeInTheDocument()
    expect(screen.queryByText("Các lần thi")).not.toBeInTheDocument()
    expect(urlsOf(fn, "/students/s1/exams")).toHaveLength(0)
    expect(urlsOf(fn, "/classes/k1")).toHaveLength(0)
    expect(
      screen.queryByRole("button", { name: /Xoá/ })
    ).not.toBeInTheDocument()
  })

  it("đổi trạng thái sang Tạm dừng → PATCH /students/s1 { status }", async () => {
    const { calls } = setup(student(), {
      "PATCH /students/s1": () =>
        jsonResponse(200, { data: student({ status: "paused" }) }),
    })
    renderDetail()
    await userEvent.click(
      await screen.findByRole("button", { name: /Đổi trạng thái/ })
    )
    const items = await screen.findAllByRole("menuitem")
    expect(items.map((item) => item.textContent)).toEqual([
      "Đang học",
      "Tạm dừng",
      "Hoàn thành",
      "Thôi học",
    ])
    await userEvent.click(screen.getByRole("menuitem", { name: "Tạm dừng" }))

    await waitFor(() =>
      expect(bodyOf(calls, "PATCH /students/s1")).toEqual({ status: "paused" })
    )
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Đã chuyển sang Tạm dừng")
    )
  })

  it("xếp lớp: lớp theo chi nhánh + gói, ẩn lớp kết thúc, lớp hết chỗ bị vô hiệu", async () => {
    const { fn, calls } = setup(student({ classId: null }), {
      "PATCH /students/s1/class": () =>
        jsonResponse(200, { data: student({ classId: "k1" }) }),
    })
    renderDetail()
    expect(await screen.findByText("Chưa xếp lớp")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /Xếp lớp/ }))
    const dialog = await screen.findByRole("dialog")

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
    // Chưa có lớp: không có nút Bỏ lớp
    expect(
      within(dialog).queryByRole("button", { name: "Bỏ lớp" })
    ).not.toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Lớp" }))
    expect(
      await screen.findByRole("option", { name: /B-K12/ })
    ).toBeInTheDocument()
    const full = screen.getByRole("option", { name: /B-K13/ })
    expect(full).toHaveTextContent("Hết chỗ")
    expect(full).toHaveAttribute("aria-disabled", "true")
    expect(
      screen.queryByRole("option", { name: /B-K01/ })
    ).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("option", { name: /B-K12/ }))
    await userEvent.click(within(dialog).getByRole("button", { name: "Lưu" }))

    await waitFor(() =>
      expect(bodyOf(calls, "PATCH /students/s1/class")).toEqual({
        classId: "k1",
      })
    )
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Đã xếp vào lớp B-K12")
    )
  })

  it("đổi lớp: Bỏ lớp gửi classId null", async () => {
    const { calls } = setup(student(), {
      "PATCH /students/s1/class": () =>
        jsonResponse(200, { data: student({ classId: null }) }),
    })
    renderDetail()
    await userEvent.click(
      await screen.findByRole("button", { name: /Đổi lớp/ })
    )
    const dialog = await screen.findByRole("dialog")
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Bỏ lớp" })
    )
    await waitFor(() =>
      expect(bodyOf(calls, "PATCH /students/s1/class")).toEqual({
        classId: null,
      })
    )
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Đã bỏ học viên khỏi lớp")
    )
  })

  it("xếp lớp: lỗi từ backend hiện trong sheet, sheet không đóng, không toast", async () => {
    setup(student({ classId: null }), {
      "PATCH /students/s1/class": () =>
        jsonResponse(409, {
          error: { code: "CONFLICT", message: "Lớp B-K12 đã đủ 30 học viên" },
        }),
    })
    renderDetail()
    await userEvent.click(
      await screen.findByRole("button", { name: /Xếp lớp/ })
    )
    const dialog = await screen.findByRole("dialog")
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Lớp" }))
    await userEvent.click(await screen.findByRole("option", { name: /B-K12/ }))
    await userEvent.click(within(dialog).getByRole("button", { name: "Lưu" }))

    expect(
      await within(dialog).findByText("Lớp B-K12 đã đủ 30 học viên")
    ).toBeInTheDocument()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(toastError).not.toHaveBeenCalled()
  })

  it("xếp lớp: chưa chọn lớp báo lỗi tại ô, không gọi API", async () => {
    const { calls } = setup(student({ classId: null }))
    renderDetail()
    await userEvent.click(
      await screen.findByRole("button", { name: /Xếp lớp/ })
    )
    const dialog = await screen.findByRole("dialog")
    await userEvent.click(within(dialog).getByRole("button", { name: "Lưu" }))
    expect(within(dialog).getByText("Chọn lớp cần xếp")).toBeInTheDocument()
    expect(calls.some((call) => call.key === "PATCH /students/s1/class")).toBe(
      false
    )
  })

  it("xoá: cảnh báo khách hàng gốc, DELETE rồi về danh sách", async () => {
    const { calls } = setup(student(), {
      "DELETE /students/s1": () => jsonResponse(204),
    })
    renderDetail()
    await userEvent.click(await screen.findByRole("button", { name: /Xoá/ }))
    const dialog = await screen.findByRole("alertdialog")
    expect(
      within(dialog).getByText(
        /Khách hàng gốc sẽ trở về trạng thái Hoàn tất hồ sơ/
      )
    ).toBeInTheDocument()
    const getsBefore = calls.filter(
      (call) => call.key === "GET /students/s1"
    ).length
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Xoá học viên" })
    )
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/hoc-vien"))
    expect(calls.some((call) => call.key === "DELETE /students/s1")).toBe(true)
    expect(toastSuccess).toHaveBeenCalledWith("Đã xoá học viên")
    expect(
      calls.filter((call) => call.key === "GET /students/s1")
    ).toHaveLength(getsBefore)
  })

  it("xoá học viên không có khách hàng gốc: không có câu cảnh báo", async () => {
    setup(student({ leadId: null }))
    renderDetail()
    await userEvent.click(await screen.findByRole("button", { name: /Xoá/ }))
    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).queryByText(/Khách hàng gốc/)).not.toBeInTheDocument()
  })

  it("sửa hồ sơ: mở sheet điền sẵn, chỉ gửi trường đổi", async () => {
    const { calls } = setup(student(), {
      "PATCH /students/s1": () =>
        jsonResponse(200, { data: student({ address: null }) }),
    })
    renderDetail()
    await userEvent.click(await screen.findByRole("button", { name: /Sửa/ }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByLabelText(/Họ và tên/)).toHaveValue(
      "Nguyễn Văn An"
    )
    await userEvent.clear(within(dialog).getByLabelText("Địa chỉ"))
    await userEvent.click(within(dialog).getByRole("button", { name: "Lưu" }))
    await waitFor(() =>
      expect(bodyOf(calls, "PATCH /students/s1")).toEqual({ address: null })
    )
  })
})
