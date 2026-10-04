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
})

describe("canAccess / firstAllowedPath", () => {
  it("editor chỉ vào bài viết và trang chung", () => {
    expect(canAccess("/admin/bai-viet/tao-moi", editor)).toBe(true)
    expect(canAccess("/admin/hoc-phi", editor)).toBe(false)
    expect(canAccess("/admin", editor)).toBe(false)
    expect(canAccess("/admin/tai-khoan", editor)).toBe(true)
    expect(canAccess("/admin/chi-nhanh", [])).toBe(true)
    expect(firstAllowedPath(editor)).toBe("/admin/bai-viet")
  })

  it("giáo viên về lớp học, quản lý về tổng quan", () => {
    expect(firstAllowedPath(instructor)).toBe("/admin/lop-hoc")
    expect(firstAllowedPath(manager)).toBe("/admin")
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
