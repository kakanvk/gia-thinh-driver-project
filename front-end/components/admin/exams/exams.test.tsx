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

import { ExamDetail } from "@/components/admin/exams/exam-detail"
import { ExamList } from "@/components/admin/exams/exam-list"
import { makeQueryClient } from "@/components/providers/query-provider"
import type { ExamCandidate, ExamSession, Student } from "@/lib/admin/types"
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
  usePathname: () => "/admin/lich-thi",
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
const MANAGER_PERMISSIONS = ["student.*", "class.*", "exam.*"]
const INSTRUCTOR_PERMISSIONS = ["class.read", "student.read", "exam.read"]
const instructorUser = { ...manager, id: "u7", role: "instructor" }

function session(overrides: Partial<ExamSession> = {}): ExamSession {
  return {
    id: "e1",
    code: "SH-2611-01",
    type: "official",
    courseId: "c1",
    courseCode: "B-SO-SAN",
    branchId: "b1",
    date: "2026-11-02T00:00:00+07:00",
    location: "Sở GTVT Vĩnh Long",
    status: "scheduled",
    note: null,
    stats: { candidates: 10, passed: 6, failed: 2, absent: 1, pending: 1 },
    createdAt: "2026-10-01T09:00:00+07:00",
    updatedAt: "2026-10-01T09:00:00+07:00",
    ...overrides,
  }
}

function candidate(overrides: Partial<ExamCandidate> = {}): ExamCandidate {
  return {
    id: "c1",
    sessionId: "e1",
    studentId: "s1",
    result: "pending",
    score: null,
    attempt: 1,
    note: null,
    student: {
      id: "s1",
      code: "HV0001",
      name: "Nguyễn Văn An",
      phone: "0901234567",
    },
    createdAt: "2026-10-01T09:00:00+07:00",
    updatedAt: "2026-10-01T09:00:00+07:00",
    ...overrides,
  }
}

function student(overrides: Partial<Student> = {}): Student {
  return {
    id: "s2",
    code: "HV0002",
    name: "Lê Văn Anh",
    phone: "0902000222",
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
}

const examsPage = {
  data: [
    session(),
    session({
      id: "e2",
      code: "TN-2610-03",
      type: "graduation",
      location: null,
      status: "done",
      stats: { candidates: 4, passed: 0, failed: 0, absent: 4, pending: 0 },
    }),
  ],
  meta: { page: 1, limit: 20, total: 2 },
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

describe("ExamList", () => {
  function setup(extra: Parameters<typeof mockFetch>[0] = {}) {
    return mockFetch({
      "GET /exams": () => jsonResponse(200, examsPage),
      ...lookups,
      ...extra,
    })
  }

  it("gọi /exams theo bộ lọc trên URL, hiện cột và tỷ lệ đậu", async () => {
    search = "type=official&from=2026-11-01&to=2026-11-30&page=2"
    const { fn } = setup()
    renderWithClient(<ExamList />)

    expect(await screen.findByText("SH-2611-01")).toBeInTheDocument()
    const [url] = urlsOf(fn, "/exams")
    expect(Object.fromEntries(url.searchParams)).toEqual({
      type: "official",
      from: "2026-11-01",
      to: "2026-11-30",
      page: "2",
      limit: "20",
      sort: "-date",
    })
    expect(screen.getByLabelText("Từ ngày")).toHaveValue("2026-11-01")
    expect(screen.getByLabelText("Đến ngày")).toHaveValue("2026-11-30")

    const first = screen.getByText("SH-2611-01").closest("tr")!
    expect(within(first).getByText("Sát hạch")).toBeInTheDocument()
    expect(within(first).getByText("B-SO-SAN")).toBeInTheDocument()
    await waitFor(() =>
      expect(within(first).getByText("Tân Ngãi")).toBeInTheDocument()
    )
    expect(within(first).getByText("02/11/2026")).toBeInTheDocument()
    expect(within(first).getByText("Sở GTVT Vĩnh Long")).toBeInTheDocument()
    expect(within(first).getByText("10")).toBeInTheDocument()
    expect(within(first).getByText("6 / 2 / 1")).toBeInTheDocument()
    // 6 / (10 − 1 − 1) = 75%
    expect(within(first).getByText("75%")).toBeInTheDocument()
    expect(within(first).getByText("Đã lên lịch")).toBeInTheDocument()

    // Toàn vắng → mẫu 0 → "—"
    const second = screen.getByText("TN-2610-03").closest("tr")!
    expect(within(second).getByText("Tốt nghiệp")).toBeInTheDocument()
    expect(within(second).getByText("0 / 0 / 4")).toBeInTheDocument()
    expect(within(second).getAllByText("—").length).toBeGreaterThanOrEqual(2)
    expect(within(second).queryByText(/%/)).not.toBeInTheDocument()
    expect(within(second).getByText("Đã có kết quả")).toBeInTheDocument()

    await userEvent.click(first)
    expect(push).toHaveBeenCalledWith("/admin/lich-thi/e1")
  })

  it("đổi ô ngày ghi from/to lên URL, bỏ page", async () => {
    search = "page=3"
    setup()
    renderWithClient(<ExamList />)
    await screen.findByText("SH-2611-01")
    fireEvent.change(screen.getByLabelText("Từ ngày"), {
      target: { value: "2026-11-01" },
    })
    expect(replace).toHaveBeenLastCalledWith(
      "/admin/lich-thi?from=2026-11-01",
      { scroll: false }
    )
    fireEvent.change(screen.getByLabelText("Đến ngày"), {
      target: { value: "2026-11-30" },
    })
    expect(replace).toHaveBeenLastCalledWith("/admin/lich-thi?to=2026-11-30", {
      scroll: false,
    })
  })

  it("xếp ca thi: mã in hoa, ngày thi yyyy-MM-dd, mở trang chi tiết", async () => {
    const { calls } = setup({
      "POST /exams": () =>
        jsonResponse(201, {
          data: session({ id: "e9", code: "SH-2611-02" }),
        }),
    })
    renderWithClient(<ExamList />)
    await userEvent.click(
      await screen.findByRole("button", { name: /Xếp ca thi/ })
    )
    const dialog = await screen.findByRole("dialog")
    const code = within(dialog).getByLabelText(/Mã ca thi/)
    await userEvent.type(code, "sh-2611-02")
    expect(code).toHaveValue("SH-2611-02")
    await choose(
      within(dialog).getByRole("combobox", { name: /Loại/ }),
      "Sát hạch"
    )
    await choose(
      within(dialog).getByRole("combobox", { name: /Gói học/ }),
      "B-SO-SAN · B số sàn"
    )
    fireEvent.change(within(dialog).getByLabelText(/Ngày thi/), {
      target: { value: "2026-11-02" },
    })
    await userEvent.type(
      within(dialog).getByLabelText(/Địa điểm/),
      "Sở GTVT Vĩnh Long"
    )
    expect(
      within(dialog).getByRole("combobox", { name: "Trạng thái" })
    ).toHaveTextContent("Đã lên lịch")
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Xếp ca thi" })
    )

    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/lich-thi/e9"))
    expect(toastSuccess).toHaveBeenCalledWith("Đã xếp ca thi SH-2611-02")
    expect(bodyOf(calls, "POST /exams")).toEqual({
      code: "SH-2611-02",
      type: "official",
      courseId: "c1",
      branchId: "b1",
      date: "2026-11-02",
      location: "Sở GTVT Vĩnh Long",
      status: "scheduled",
    })
  })

  it("xếp ca thi: thiếu trường bắt buộc báo lỗi tại ô, không gọi API", async () => {
    const { calls } = setup()
    renderWithClient(<ExamList />)
    await userEvent.click(
      await screen.findByRole("button", { name: /Xếp ca thi/ })
    )
    const dialog = await screen.findByRole("dialog")
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Xếp ca thi" })
    )
    expect(within(dialog).getByText("Nhập mã ca thi")).toBeInTheDocument()
    expect(within(dialog).getByText("Chọn loại thi")).toBeInTheDocument()
    expect(within(dialog).getByText("Chọn gói học")).toBeInTheDocument()
    expect(within(dialog).getByText("Chọn ngày thi")).toBeInTheDocument()
    expect(countOf(calls, "POST /exams")).toBe(0)
  })

  it("tài khoản giáo viên: không có nút Xếp ca thi", async () => {
    auth = { user: instructorUser, permissions: INSTRUCTOR_PERMISSIONS }
    setup()
    renderWithClient(<ExamList />)
    await screen.findByText("SH-2611-01")
    expect(
      screen.queryByRole("button", { name: /Xếp ca thi/ })
    ).not.toBeInTheDocument()
  })
})

describe("ExamDetail", () => {
  const candidates = [
    candidate(),
    candidate({
      id: "c2",
      studentId: "s7",
      result: "passed",
      score: 95,
      attempt: 2,
      student: {
        id: "s7",
        code: "HV0007",
        name: "Trần Thị Bích",
        phone: "0907000777",
      },
    }),
  ]

  function setup(extra: Parameters<typeof mockFetch>[0] = {}) {
    return mockFetch({
      "GET /exams/e1": () => jsonResponse(200, { data: session() }),
      "GET /exams/e1/candidates": () => jsonResponse(200, { data: candidates }),
      ...lookups,
      ...extra,
    })
  }

  function rowOf(name: string) {
    return screen.getByRole("link", { name }).closest("tr")!
  }

  it("404 → Không tìm thấy ca thi + link danh sách", async () => {
    setup({
      "GET /exams/e1": () =>
        jsonResponse(404, {
          error: { code: "NOT_FOUND", message: "Không tìm thấy ca thi" },
        }),
    })
    renderWithClient(<ExamDetail id="e1" />)
    expect(await screen.findByText("Không tìm thấy ca thi")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /Về danh sách ca thi/ })
    ).toHaveAttribute("href", "/admin/lich-thi")
  })

  it("thông tin ca và bảng thí sinh", async () => {
    setup()
    renderWithClient(<ExamDetail id="e1" />)
    expect(
      await screen.findByRole("heading", { name: "SH-2611-01" })
    ).toBeInTheDocument()
    expect(screen.getByText("02/11/2026")).toBeInTheDocument()
    expect(screen.getByText("Sở GTVT Vĩnh Long")).toBeInTheDocument()
    expect(screen.getByText("75%")).toBeInTheDocument()

    const link = await screen.findByRole("link", { name: "Nguyễn Văn An" })
    expect(link).toHaveAttribute("href", "/admin/hoc-vien/s1")
    const row = rowOf("Nguyễn Văn An")
    expect(within(row).getByText("HV0001")).toBeInTheDocument()
    expect(within(row).getByText("0901234567")).toBeInTheDocument()
    expect(
      within(row).getByRole("combobox", { name: /Kết quả/ })
    ).toHaveTextContent("Chờ kết quả")

    const passed = rowOf("Trần Thị Bích")
    expect(
      within(passed).getByRole("combobox", { name: /Kết quả/ })
    ).toHaveTextContent("Đậu")
    expect(
      within(passed).getByRole("spinbutton", { name: /Điểm/ })
    ).toHaveValue(95)
    // Thí sinh đã có kết quả không xoá được
    expect(
      within(passed).queryByRole("button", { name: /Xoá thí sinh/ })
    ).not.toBeInTheDocument()
    expect(
      within(row).getByRole("button", { name: /Xoá thí sinh/ })
    ).toBeInTheDocument()

    for (const name of [/Sửa/, /Thêm thí sinh/, /Xoá ca thi/]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument()
    }
  })

  it("nhập kết quả từng dòng: Đậu, điểm 92 → PATCH { result, score }, làm mới", async () => {
    const { calls } = setup({
      "PATCH /exams/e1/candidates/c1": () =>
        jsonResponse(200, { data: candidate({ result: "passed", score: 92 }) }),
    })
    renderWithClient(<ExamDetail id="e1" />)
    await screen.findByRole("link", { name: "Nguyễn Văn An" })
    const row = rowOf("Nguyễn Văn An")
    await choose(within(row).getByRole("combobox", { name: /Kết quả/ }), "Đậu")
    await userEvent.type(
      within(row).getByRole("spinbutton", { name: /Điểm/ }),
      "92"
    )
    const examGets = countOf(calls, "GET /exams/e1")
    await userEvent.click(within(row).getByRole("button", { name: /Lưu/ }))

    await waitFor(() =>
      expect(bodyOf(calls, "PATCH /exams/e1/candidates/c1")).toEqual({
        result: "passed",
        score: 92,
      })
    )
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Đã lưu kết quả Nguyễn Văn An")
    )
    await waitFor(() =>
      expect(countOf(calls, "GET /exams/e1")).toBeGreaterThan(examGets)
    )
  })

  it("nhập kết quả: ghi chú chỉ gửi khi có", async () => {
    const { calls } = setup({
      "PATCH /exams/e1/candidates/c1": () =>
        jsonResponse(200, { data: candidate({ result: "absent" }) }),
    })
    renderWithClient(<ExamDetail id="e1" />)
    await screen.findByRole("link", { name: "Nguyễn Văn An" })
    const row = rowOf("Nguyễn Văn An")
    await choose(within(row).getByRole("combobox", { name: /Kết quả/ }), "Vắng")
    await userEvent.type(
      within(row).getByRole("textbox", { name: /Ghi chú/ }),
      "Ốm"
    )
    await userEvent.click(within(row).getByRole("button", { name: /Lưu/ }))
    await waitFor(() =>
      expect(bodyOf(calls, "PATCH /exams/e1/candidates/c1")).toEqual({
        result: "absent",
        score: null,
        note: "Ốm",
      })
    )
  })

  it("điểm 1200 → lỗi tại ô, không gọi API", async () => {
    const { calls } = setup()
    renderWithClient(<ExamDetail id="e1" />)
    await screen.findByRole("link", { name: "Nguyễn Văn An" })
    const row = rowOf("Nguyễn Văn An")
    const score = within(row).getByRole("spinbutton", { name: /Điểm/ })
    await userEvent.type(score, "1200")
    await userEvent.click(within(row).getByRole("button", { name: /Lưu/ }))
    const message = within(row).getByText("Điểm từ 0 đến 1000")
    expect(score).toHaveAttribute("aria-describedby", message.id)
    expect(score).toHaveAttribute("aria-invalid", "true")
    expect(countOf(calls, "PATCH /exams/e1/candidates/c1")).toBe(0)
  })

  it("xoá thí sinh chờ → DELETE /exams/e1/candidates/c1", async () => {
    const { calls } = setup({
      "DELETE /exams/e1/candidates/c1": () => jsonResponse(204),
    })
    renderWithClient(<ExamDetail id="e1" />)
    await screen.findByRole("link", { name: "Nguyễn Văn An" })
    await userEvent.click(
      within(rowOf("Nguyễn Văn An")).getByRole("button", {
        name: /Xoá thí sinh/,
      })
    )
    const dialog = await screen.findByRole("alertdialog")
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Xoá thí sinh" })
    )
    await waitFor(() =>
      expect(countOf(calls, "DELETE /exams/e1/candidates/c1")).toBe(1)
    )
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        "Đã xoá Nguyễn Văn An khỏi ca thi"
      )
    )
  })

  it("Thêm thí sinh: tìm cùng chi nhánh + gói, Đang học, bỏ người đã có; skipped hiện tên + lý do", async () => {
    const { fn, calls } = setup({
      "GET /students": () =>
        jsonResponse(200, {
          data: [
            student(),
            student({ id: "s3", code: "HV0003", name: "Phạm Thị Ân" }),
            student({ id: "s1", code: "HV0001", name: "Nguyễn Văn An" }),
          ],
          meta: { page: 1, limit: 20, total: 3 },
        }),
      "POST /exams/e1/candidates": () =>
        jsonResponse(201, { data: { added: 1, skipped: ["s3"] } }),
    })
    renderWithClient(<ExamDetail id="e1" />)
    await userEvent.click(
      await screen.findByRole("button", { name: /Thêm thí sinh/ })
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
    // s1 đã có trong ca
    expect(
      within(dialog).queryByRole("checkbox", { name: /Nguyễn Văn An/ })
    ).not.toBeInTheDocument()

    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: /Lê Văn Anh/ })
    )
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: /Phạm Thị Ân/ })
    )
    const candidateGets = countOf(calls, "GET /exams/e1/candidates")
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Thêm 2 thí sinh" })
    )

    await waitFor(() =>
      expect(bodyOf(calls, "POST /exams/e1/candidates")).toEqual({
        studentIds: ["s2", "s3"],
      })
    )
    const status = await within(dialog).findByRole("status")
    expect(status).toHaveTextContent("Đã thêm 1 thí sinh")
    const items = within(status).getAllByRole("listitem")
    expect(items).toHaveLength(1)
    expect(items[0]).toHaveTextContent("Phạm Thị Ân (HV0003)")
    expect(items[0]).toHaveTextContent("Đã có trong ca thi")
    // Không báo thành công trọn vẹn, sheet vẫn mở
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(toastSuccess).not.toHaveBeenCalledWith("Đã thêm 2 thí sinh")
    await waitFor(() =>
      expect(countOf(calls, "GET /exams/e1/candidates")).toBeGreaterThan(
        candidateGets
      )
    )
  })

  it("Thêm thí sinh: tất cả thành công → toast, đóng sheet", async () => {
    setup({
      "GET /students": () =>
        jsonResponse(200, {
          data: [student()],
          meta: { page: 1, limit: 20, total: 1 },
        }),
      "POST /exams/e1/candidates": () =>
        jsonResponse(201, { data: { added: 1, skipped: [] } }),
    })
    renderWithClient(<ExamDetail id="e1" />)
    await userEvent.click(
      await screen.findByRole("button", { name: /Thêm thí sinh/ })
    )
    const dialog = await screen.findByRole("dialog")
    await userEvent.click(
      await within(dialog).findByRole("checkbox", { name: /Lê Văn Anh/ })
    )
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Thêm 1 thí sinh" })
    )
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Đã thêm 1 thí sinh")
    )
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
  })

  it("Thêm thí sinh: 400 học viên không hợp lệ → hiện trong sheet kèm tên", async () => {
    setup({
      "GET /students": () =>
        jsonResponse(200, {
          data: [student()],
          meta: { page: 1, limit: 20, total: 1 },
        }),
      "POST /exams/e1/candidates": () =>
        jsonResponse(400, {
          error: {
            code: "BAD_REQUEST",
            message:
              "Có học viên không hợp lệ cho ca thi này (khác chi nhánh, khác gói học hoặc không còn đang học)",
            details: [{ path: "body.studentIds", message: "s2" }],
          },
        }),
    })
    renderWithClient(<ExamDetail id="e1" />)
    await userEvent.click(
      await screen.findByRole("button", { name: /Thêm thí sinh/ })
    )
    const dialog = await screen.findByRole("dialog")
    await userEvent.click(
      await within(dialog).findByRole("checkbox", { name: /Lê Văn Anh/ })
    )
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Thêm 1 thí sinh" })
    )
    const alert = await within(dialog).findByRole("alert")
    expect(alert).toHaveTextContent("Có học viên không hợp lệ")
    expect(alert).toHaveTextContent("Lê Văn Anh (HV0002)")
    expect(toastError).not.toHaveBeenCalled()
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it("ca không ở trạng thái Đã lên lịch: ẩn Thêm thí sinh", async () => {
    setup({
      "GET /exams/e1": () =>
        jsonResponse(200, { data: session({ status: "done" }) }),
    })
    renderWithClient(<ExamDetail id="e1" />)
    await screen.findByRole("link", { name: "Nguyễn Văn An" })
    expect(
      screen.queryByRole("button", { name: /Thêm thí sinh/ })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Sửa/ })).toBeInTheDocument()
  })

  it("sửa ca: chỉ gửi trường đổi", async () => {
    const { calls } = setup({
      "PATCH /exams/e1": () =>
        jsonResponse(200, { data: session({ location: null }) }),
    })
    renderWithClient(<ExamDetail id="e1" />)
    await userEvent.click(await screen.findByRole("button", { name: /Sửa/ }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByLabelText(/Mã ca thi/)).toHaveValue("SH-2611-01")
    expect(within(dialog).getByLabelText(/Ngày thi/)).toHaveValue("2026-11-02")
    expect(
      within(dialog).queryByRole("combobox", { name: /Gói học/ })
    ).not.toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText(/Ngày thi/), {
      target: { value: "2026-11-03" },
    })
    await userEvent.clear(within(dialog).getByLabelText(/Địa điểm/))
    await userEvent.click(within(dialog).getByRole("button", { name: "Lưu" }))
    await waitFor(() =>
      expect(bodyOf(calls, "PATCH /exams/e1")).toEqual({
        date: "2026-11-03",
        location: null,
      })
    )
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Đã lưu ca thi SH-2611-01")
    )
  })

  it("xoá ca đã có kết quả (409) → thông báo, không rời trang", async () => {
    setup({
      "DELETE /exams/e1": () =>
        jsonResponse(409, {
          error: {
            code: "CONFLICT",
            message:
              'Ca thi đã có kết quả, không thể xóa (có thể chuyển sang "đã hủy")',
          },
        }),
    })
    renderWithClient(<ExamDetail id="e1" />)
    await userEvent.click(
      await screen.findByRole("button", { name: /Xoá ca thi/ })
    )
    const dialog = await screen.findByRole("alertdialog")
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Xoá ca thi" })
    )
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        'Ca thi đã có kết quả, không thể xóa (có thể chuyển sang "đã hủy")'
      )
    )
    expect(toastError).toHaveBeenCalledTimes(1)
    expect(push).not.toHaveBeenCalled()
  })

  it("xoá ca thành công → về danh sách", async () => {
    setup({ "DELETE /exams/e1": () => jsonResponse(204) })
    renderWithClient(<ExamDetail id="e1" />)
    await userEvent.click(
      await screen.findByRole("button", { name: /Xoá ca thi/ })
    )
    const dialog = await screen.findByRole("alertdialog")
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Xoá ca thi" })
    )
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/lich-thi"))
    expect(toastSuccess).toHaveBeenCalledWith("Đã xoá ca thi SH-2611-01")
  })

  it("tài khoản giáo viên chỉ xem: không có Sửa/Xoá/Thêm/Lưu, kết quả là nhãn", async () => {
    auth = { user: instructorUser, permissions: INSTRUCTOR_PERMISSIONS }
    setup({
      "GET /exams/e1/candidates": () =>
        jsonResponse(200, {
          data: candidates.map((item) => ({
            ...item,
            student: item.student && {
              id: item.student.id,
              code: item.student.code,
              name: item.student.name,
            },
          })),
        }),
    })
    renderWithClient(<ExamDetail id="e1" />)
    await screen.findByRole("link", { name: "Nguyễn Văn An" })
    for (const name of [
      /Sửa/,
      /Thêm thí sinh/,
      /Xoá ca thi/,
      /Lưu/,
      /Xoá thí sinh/,
    ]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument()
    }
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument()
    const row = rowOf("Trần Thị Bích")
    expect(within(row).getByText("Đậu")).toBeInTheDocument()
    expect(within(row).getByText("95")).toBeInTheDocument()
  })
})
