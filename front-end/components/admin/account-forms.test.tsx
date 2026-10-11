import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PasswordForm, ProfileForm } from "@/components/admin/account-forms"
import { makeQueryClient } from "@/components/providers/query-provider"
import { ApiError } from "@/lib/api/errors"
import { setAccessToken } from "@/lib/api/session"
import { jsonResponse, mockFetch } from "@/test/fetch-mock"

// vi.mock được đưa lên đầu file: biến dùng trong factory phải tạo bằng vi.hoisted
const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: vi.fn() } }))

const user = {
  id: "u1",
  name: "Trần Mỹ Duyên",
  username: "duyen",
  phone: "0779666664",
  role: "consultant",
  branchIds: [],
  status: "active",
}
let auth: Record<string, unknown>
vi.mock("@/components/admin/auth-provider", () => ({ useAuth: () => auth }))

function renderWithQuery(ui: React.ReactNode) {
  return render(<QueryClientProvider client={makeQueryClient()}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  toastSuccess.mockClear()
  setAccessToken("t1")
  auth = { user, setUser: vi.fn(), changePassword: vi.fn() }
})

describe("ProfileForm", () => {
  it("lưu tên và SĐT qua PATCH /auth/me rồi cập nhật người dùng", async () => {
    const updated = { ...user, name: "Trần Duyên" }
    mockFetch({
      "PATCH /auth/me": (init) => {
        expect(JSON.parse(String(init.body))).toEqual({ name: "Trần Duyên", phone: "0779666664" })
        return jsonResponse(200, { data: { user: updated, permissions: [] } })
      },
    })
    renderWithQuery(<ProfileForm />)
    expect(screen.getByLabelText("Tên đăng nhập")).toHaveValue("duyen")
    expect(screen.getByLabelText("Tên đăng nhập")).toHaveAttribute("readonly")
    const name = screen.getByLabelText("Họ và tên")
    await userEvent.clear(name)
    await userEvent.type(name, "Trần Duyên")
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }))
    await vi.waitFor(() => expect(auth.setUser).toHaveBeenCalledWith(updated))
    expect(toastSuccess).toHaveBeenCalledWith("Đã lưu hồ sơ")
  })

  it("lỗi trường từ backend hiện dưới ô", async () => {
    mockFetch({
      "PATCH /auth/me": () =>
        jsonResponse(400, {
          error: {
            code: "VALIDATION_ERROR",
            message: "Dữ liệu không hợp lệ",
            details: [{ path: "body.phone", message: "Số điện thoại phải có 10 chữ số, bắt đầu bằng 0" }],
          },
        }),
    })
    renderWithQuery(<ProfileForm />)
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }))
    expect(
      await screen.findByText("Số điện thoại phải có 10 chữ số, bắt đầu bằng 0")
    ).toBeInTheDocument()
  })
})

describe("PasswordForm", () => {
  async function fill(current: string, next: string, confirm: string) {
    await userEvent.type(screen.getByLabelText("Mật khẩu hiện tại"), current)
    await userEvent.type(screen.getByLabelText("Mật khẩu mới"), next)
    await userEvent.type(screen.getByLabelText("Nhập lại mật khẩu mới"), confirm)
    await userEvent.click(screen.getByRole("button", { name: "Đổi mật khẩu" }))
  }

  it("nhập lại không khớp → báo lỗi, không gọi API", async () => {
    renderWithQuery(<PasswordForm />)
    await fill("Matkhau123", "Moimatkhau1", "Moimatkhau2")
    expect(screen.getByText("Mật khẩu nhập lại không khớp")).toBeInTheDocument()
    expect(auth.changePassword).not.toHaveBeenCalled()
  })

  it("mật khẩu mới quá ngắn → báo lỗi", async () => {
    renderWithQuery(<PasswordForm />)
    await fill("Matkhau123", "abc1", "abc1")
    expect(screen.getByText("Mật khẩu tối thiểu 8 ký tự")).toBeInTheDocument()
    expect(auth.changePassword).not.toHaveBeenCalled()
  })

  it("thành công → gọi changePassword, xoá các ô, báo thành công", async () => {
    const changePassword = vi.fn().mockResolvedValue(undefined)
    auth = { ...auth, changePassword }
    renderWithQuery(<PasswordForm />)
    await fill("Matkhau123", "Moimatkhau1", "Moimatkhau1")
    await vi.waitFor(() => expect(changePassword).toHaveBeenCalledWith("Matkhau123", "Moimatkhau1"))
    await vi.waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Đã đổi mật khẩu"))
    expect(screen.getByLabelText("Mật khẩu hiện tại")).toHaveValue("")
  })

  it("sai mật khẩu hiện tại → lỗi dưới ô", async () => {
    auth = {
      ...auth,
      changePassword: vi.fn().mockRejectedValue(
        new ApiError(400, "VALIDATION_ERROR", "Mật khẩu hiện tại không đúng", [
          { path: "body.currentPassword", message: "Không đúng" },
        ])
      ),
    }
    renderWithQuery(<PasswordForm />)
    await fill("Saimatkhau1", "Moimatkhau1", "Moimatkhau1")
    expect(await screen.findByText("Không đúng")).toBeInTheDocument()
  })
})
