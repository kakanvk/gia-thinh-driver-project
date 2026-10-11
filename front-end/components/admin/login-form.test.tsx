import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { LoginForm } from "@/components/admin/login-form"
import { ApiError } from "@/lib/api/errors"

const replace = vi.fn()
let search = ""
let auth: Record<string, unknown>

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}))
vi.mock("@/components/admin/auth-provider", () => ({ useAuth: () => auth }))

beforeEach(() => {
  replace.mockClear()
  search = ""
  auth = { status: "anonymous", permissions: [], login: vi.fn() }
})

async function fillAndSubmit(identifier: string, password: string) {
  if (identifier) await userEvent.type(screen.getByLabelText("Số điện thoại hoặc tên đăng nhập"), identifier)
  if (password) await userEvent.type(screen.getByLabelText("Mật khẩu"), password)
  await userEvent.click(screen.getByRole("button", { name: "Đăng nhập" }))
}

describe("LoginForm", () => {
  it("gọi login với identifier đã bỏ khoảng trắng", async () => {
    const login = vi.fn().mockResolvedValue(undefined)
    auth = { ...auth, login }
    render(<LoginForm />)
    await fillAndSubmit("  admin  ", "Admin@123#")
    expect(login).toHaveBeenCalledWith("admin", "Admin@123#")
  })

  it("bỏ trống → báo lỗi tại ô, không gọi API", async () => {
    const login = vi.fn()
    auth = { ...auth, login }
    render(<LoginForm />)
    await fillAndSubmit("", "")
    expect(screen.getByText("Vui lòng nhập số điện thoại hoặc tên đăng nhập")).toBeInTheDocument()
    expect(screen.getByText("Vui lòng nhập mật khẩu")).toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
  })

  it("sai mật khẩu → hiện thông báo của backend trên form", async () => {
    auth = {
      ...auth,
      login: vi.fn().mockRejectedValue(
        new ApiError(401, "UNAUTHORIZED", "Tài khoản hoặc mật khẩu không đúng")
      ),
    }
    render(<LoginForm />)
    await fillAndSubmit("admin", "sai")
    expect(await screen.findByRole("alert")).toHaveTextContent("Tài khoản hoặc mật khẩu không đúng")
  })

  it("bị giới hạn → báo thời gian chờ", async () => {
    auth = {
      ...auth,
      login: vi.fn().mockRejectedValue(new ApiError(429, "RATE_LIMITED", "x", [], 875)),
    }
    render(<LoginForm />)
    await fillAndSubmit("admin", "sai")
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Thao tác quá nhiều lần, thử lại sau 15 phút"
    )
  })

  it("nút hiện/ẩn mật khẩu", async () => {
    render(<LoginForm />)
    const input = screen.getByLabelText("Mật khẩu")
    expect(input).toHaveAttribute("type", "password")
    await userEvent.click(screen.getByRole("button", { name: "Hiện mật khẩu" }))
    expect(input).toHaveAttribute("type", "text")
  })

  it("đã đăng nhập → chuyển tới next hợp lệ", () => {
    search = "next=%2Fadmin%2Fhoc-phi%3Fpage%3D2"
    auth = { ...auth, status: "authenticated", permissions: ["*"] }
    render(<LoginForm />)
    expect(replace).toHaveBeenCalledWith("/admin/hoc-phi?page=2")
  })

  it("next không hợp lệ → về trang đầu tiên được phép", () => {
    search = "next=%2F%2Fevil.com"
    auth = { ...auth, status: "authenticated", permissions: ["post.manage"] }
    render(<LoginForm />)
    expect(replace).toHaveBeenCalledWith("/admin/bai-viet")
  })
})
