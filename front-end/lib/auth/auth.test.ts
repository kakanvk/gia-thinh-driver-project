import { describe, expect, it } from "vitest"

import { hasPermission } from "@/lib/auth/permissions"
import {
  canAccess,
  firstAllowedPath,
  loginUrl,
  routeFor,
  safeNext,
} from "@/lib/auth/routes"
import { initials, ROLE_LABELS } from "@/lib/auth/user"

const editor = [
  "branch.read",
  "setting.read",
  "course.read",
  "media.read",
  "media.upload",
  "gallery.manage",
  "category.manage",
  "post.manage",
]
const instructor = [
  "branch.read",
  "setting.read",
  "course.read",
  "media.read",
  "class.read",
  "student.read",
  "exam.read",
]
const consultant = [
  "branch.read",
  "setting.read",
  "course.read",
  "lead.read",
  "lead.create",
  "lead.update",
  "appointment.*",
  "student.read",
  "student.create",
  "student.update",
  "tuition.read",
  "dashboard.read",
]
const manager = [
  "branch.read",
  "lead.*",
  "tuition.*",
  "dashboard.read",
  "user.manage",
]

describe("hasPermission", () => {
  it("cùng luật với backend", () => {
    expect(hasPermission(["*"], "tuition.read")).toBe(true)
    expect(hasPermission(["lead.read"], "lead.read")).toBe(true)
    expect(hasPermission(["lead.*"], "lead.delete")).toBe(true)
    expect(hasPermission(["lead.read"], "lead.delete")).toBe(false)
    expect(hasPermission(["leads.*"], "lead.read")).toBe(false)
    expect(hasPermission([], null)).toBe(true)
  })
})

describe("routeFor", () => {
  it("khớp tiền tố dài nhất, /admin chỉ khớp đúng", () => {
    expect(routeFor("/admin")?.permission).toBe("dashboard.read")
    expect(routeFor("/admin/bai-viet/tao-moi")?.href).toBe("/admin/bai-viet")
    expect(routeFor("/admin/hoc-phi")?.permission).toBe("tuition.read")
    expect(routeFor("/admin/hoc-phi-cu")).toBeUndefined()
    expect(routeFor("/admin/khong-co")).toBeUndefined()
  })

  it("khách hàng theo lead.read, lịch hẹn theo appointment.read", () => {
    expect(routeFor("/admin/khach-hang")?.permission).toBe("lead.read")
    expect(routeFor("/admin/khach-hang/abc")?.permission).toBe("lead.read")
    expect(routeFor("/admin/lich-dang-ky")?.permission).toBe("appointment.read")
  })
})

describe("canAccess / firstAllowedPath", () => {
  it("editor chỉ vào thư viện, bài viết và trang chung", () => {
    expect(canAccess("/admin/bai-viet/tao-moi", editor)).toBe(true)
    expect(canAccess("/admin/thu-vien", editor)).toBe(true)
    expect(canAccess("/admin/hoc-phi", editor)).toBe(false)
    expect(canAccess("/admin", editor)).toBe(false)
    expect(canAccess("/admin/tai-khoan", editor)).toBe(true)
    expect(canAccess("/admin/chi-nhanh", [])).toBe(true)
    expect(firstAllowedPath(editor)).toBe("/admin/thu-vien")
  })

  it("thư viện theo gallery.manage", () => {
    expect(routeFor("/admin/thu-vien")?.permission).toBe("gallery.manage")
    expect(canAccess("/admin/thu-vien", ["post.manage"])).toBe(false)
    expect(canAccess("/admin/thu-vien", ["gallery.manage"])).toBe(true)
    expect(canAccess("/admin/thu-vien", consultant)).toBe(false)
  })

  it("học viên theo student.read, chi tiết đào tạo theo trang cha", () => {
    expect(routeFor("/admin/hoc-vien")?.permission).toBe("student.read")
    expect(routeFor("/admin/hoc-vien/abc")?.permission).toBe("student.read")
    expect(routeFor("/admin/lop-hoc/k1")?.permission).toBe("class.read")
    expect(routeFor("/admin/lich-thi/e1")?.permission).toBe("exam.read")
    expect(canAccess("/admin/hoc-vien", instructor)).toBe(true)
    expect(canAccess("/admin/hoc-vien/abc", instructor)).toBe(true)
    expect(canAccess("/admin/hoc-vien", editor)).toBe(false)
    expect(canAccess("/admin/hoc-vien", consultant)).toBe(true)
    expect(canAccess("/admin/lop-hoc", consultant)).toBe(false)
    expect(canAccess("/admin/giao-vien", consultant)).toBe(false)
  })

  it("giáo viên về học viên (mục đầu tiên có quyền), quản lý về tổng quan", () => {
    expect(firstAllowedPath(instructor)).toBe("/admin/hoc-vien")
    expect(firstAllowedPath(manager)).toBe("/admin")
    expect(firstAllowedPath(consultant)).toBe("/admin")
    expect(
      firstAllowedPath(consultant.filter((p) => p !== "dashboard.read"))
    ).toBe("/admin/khach-hang")
    expect(canAccess("/admin/khach-hang/abc", consultant)).toBe(true)
    expect(canAccess("/admin/lich-dang-ky", consultant)).toBe(true)
    expect(canAccess("/admin/lich-dang-ky", ["lead.read"])).toBe(false)
    expect(firstAllowedPath(["*"])).toBe("/admin")
    expect(firstAllowedPath([])).toBe("/admin/chi-nhanh")
  })
})

describe("safeNext", () => {
  it("chỉ nhận đường dẫn trong /admin", () => {
    expect(safeNext("/admin/hoc-phi?page=2")).toBe("/admin/hoc-phi?page=2")
    expect(safeNext("/admin")).toBe("/admin")
    expect(safeNext(null)).toBeNull()
    expect(safeNext("")).toBeNull()
    expect(safeNext("//evil.com")).toBeNull()
    expect(safeNext("/\\evil.com")).toBeNull()
    expect(safeNext("https://evil.com/admin")).toBeNull()
    expect(safeNext("/administrator")).toBeNull()
    expect(safeNext("/admin/dang-nhap")).toBeNull()
    expect(safeNext("/admin/dang-nhap?next=/admin")).toBeNull()
  })

  it("loginUrl mã hoá đường dẫn hiện tại", () => {
    expect(loginUrl("/admin/hoc-phi?page=2")).toBe(
      "/admin/dang-nhap?next=%2Fadmin%2Fhoc-phi%3Fpage%3D2"
    )
  })
})

describe("user", () => {
  it("nhãn vai trò và chữ viết tắt", () => {
    expect(ROLE_LABELS.branch_manager).toBe("Quản lý chi nhánh")
    expect(initials("Trần Mỹ Duyên")).toBe("TD")
    expect(initials("  admin ")).toBe("AD")
    expect(initials("")).toBe("?")
  })
})
