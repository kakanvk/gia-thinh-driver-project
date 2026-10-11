import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AdminGuard } from "@/components/admin/admin-guard"

const replace = vi.fn()
const push = vi.fn()
let pathname = "/admin/hoc-phi"
let auth: Record<string, unknown>

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => pathname,
}))
vi.mock("@/components/admin/auth-provider", () => ({ useAuth: () => auth }))

const editor = {
  status: "authenticated",
  signedOut: false,
  user: {
    id: "u2",
    name: "Lê Biên Tập",
    username: "bt",
    phone: "0900000000",
    role: "editor",
    branchIds: [],
    status: "active",
  },
  permissions: ["branch.read", "post.manage"],
  logout: vi.fn(),
  retry: vi.fn(),
}

beforeEach(() => {
  replace.mockClear()
  push.mockClear()
  editor.logout.mockClear()
  pathname = "/admin/hoc-phi"
  window.history.replaceState(null, "", "/admin/hoc-phi?page=2")
})

describe("AdminGuard", () => {
  it("chưa đăng nhập → về trang đăng nhập kèm next (gồm query)", () => {
    auth = { ...editor, status: "anonymous", user: null, permissions: [] }
    render(
      <AdminGuard>
        <p>nội dung</p>
      </AdminGuard>
    )
    expect(replace).toHaveBeenCalledWith(
      "/admin/dang-nhap?next=%2Fadmin%2Fhoc-phi%3Fpage%3D2"
    )
    expect(screen.queryByText("nội dung")).not.toBeInTheDocument()
  })

  it("vừa bấm đăng xuất → về trang đăng nhập không kèm next", () => {
    auth = {
      ...editor,
      status: "anonymous",
      signedOut: true,
      user: null,
      permissions: [],
    }
    render(
      <AdminGuard>
        <p>nội dung</p>
      </AdminGuard>
    )
    expect(replace).toHaveBeenCalledWith("/admin/dang-nhap")
  })

  it("đang tải → không render nội dung", () => {
    auth = { ...editor, status: "loading", user: null, permissions: [] }
    render(
      <AdminGuard>
        <p>nội dung</p>
      </AdminGuard>
    )
    expect(screen.getByText("Đang tải…")).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true")
    expect(screen.queryByText("nội dung")).not.toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it("mất kết nối → nút Thử lại gọi retry", async () => {
    const retry = vi.fn()
    auth = { ...editor, status: "offline", user: null, permissions: [], retry }
    render(
      <AdminGuard>
        <p>nội dung</p>
      </AdminGuard>
    )
    expect(screen.getByText("Không kết nối được máy chủ")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }))
    expect(retry).toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })

  it("thiếu quyền → màn không có quyền, menu chỉ hiện mục được phép, header là người thật", () => {
    auth = editor
    render(
      <AdminGuard>
        <p>nội dung</p>
      </AdminGuard>
    )
    expect(screen.getByText("Không có quyền truy cập")).toBeInTheDocument()
    expect(screen.queryByText("nội dung")).not.toBeInTheDocument()
    expect(
      screen.getAllByRole("link", { name: "Bài viết" }).length
    ).toBeGreaterThan(0)
    expect(
      screen.queryByRole("link", { name: "Học phí" })
    ).not.toBeInTheDocument()
    expect(screen.queryByText("Tài chính")).not.toBeInTheDocument()
    expect(screen.getByText("Lê Biên Tập")).toBeInTheDocument()
    expect(screen.getByText("Biên tập viên")).toBeInTheDocument()
    expect(screen.getAllByText("LT").length).toBeGreaterThan(0)
  })

  it("có quyền → render nội dung trong khung admin", () => {
    auth = editor
    pathname = "/admin/bai-viet/tao-moi"
    render(
      <AdminGuard>
        <p>nội dung</p>
      </AdminGuard>
    )
    expect(screen.getByText("nội dung")).toBeInTheDocument()
  })

  it("/admin mà không có dashboard.read → chuyển tới mục đầu tiên được phép", () => {
    auth = editor
    pathname = "/admin"
    render(
      <AdminGuard>
        <p>tổng quan</p>
      </AdminGuard>
    )
    expect(replace).toHaveBeenCalledWith("/admin/bai-viet")
    expect(screen.queryByText("tổng quan")).not.toBeInTheDocument()
    expect(
      screen.queryByText("Không có quyền truy cập")
    ).not.toBeInTheDocument()
  })

  it("menu tài khoản: Tài khoản → /admin/tai-khoan", async () => {
    auth = editor
    pathname = "/admin/bai-viet"
    render(
      <AdminGuard>
        <p>nội dung</p>
      </AdminGuard>
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Mở menu tài khoản" })
    )
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Tài khoản" })
    )
    expect(push).toHaveBeenCalledWith("/admin/tai-khoan")
  })

  it("menu tài khoản: Đăng xuất gọi logout", async () => {
    auth = editor
    pathname = "/admin/bai-viet"
    render(
      <AdminGuard>
        <p>nội dung</p>
      </AdminGuard>
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Mở menu tài khoản" })
    )
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Đăng xuất" })
    )
    expect(editor.logout).toHaveBeenCalledTimes(1)
  })
})
