import { hasPermission } from "@/lib/auth/permissions"

export type AdminRoute = { href: string; permission: string | null }

export const LOGIN_PATH = "/admin/dang-nhap"

// Thứ tự = thứ tự menu; dùng chung cho menu, chặn trang và trang mặc định sau đăng nhập.
// permission null: mọi nhân viên đã đăng nhập.
export const ADMIN_ROUTES: AdminRoute[] = [
  { href: "/admin", permission: "dashboard.read" },
  { href: "/admin/lich-dang-ky", permission: "lead.read" },
  { href: "/admin/lop-hoc", permission: "class.read" },
  { href: "/admin/lich-thi", permission: "exam.read" },
  { href: "/admin/nguoi-dung", permission: "user.manage" },
  { href: "/admin/chi-nhanh", permission: null },
  { href: "/admin/giao-vien", permission: "instructor.read" },
  { href: "/admin/xe-tap-lai", permission: "vehicle.read" },
  { href: "/admin/hoc-phi", permission: "tuition.read" },
  { href: "/admin/bai-viet", permission: "post.manage" },
  { href: "/admin/cai-dat", permission: null },
  { href: "/admin/tro-giup", permission: null },
  { href: "/admin/tai-khoan", permission: null },
]

function matches(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function routeFor(pathname: string): AdminRoute | undefined {
  return ADMIN_ROUTES.filter((route) => matches(pathname, route.href)).sort(
    (a, b) => b.href.length - a.href.length
  )[0]
}

// Đường dẫn không có trong bảng (vd. trang 404) để Next.js tự xử lý
export function canAccess(
  pathname: string,
  permissions: readonly string[]
): boolean {
  const route = routeFor(pathname)
  return route ? hasPermission(permissions, route.permission) : true
}

// Ưu tiên mục đầu tiên (theo thứ tự menu) gắn với quyền riêng của vai trò,
// không có thì về mục chung đầu tiên (vd. editor → bài viết, không phải chi nhánh)
export function firstAllowedPath(permissions: readonly string[]): string {
  const own = ADMIN_ROUTES.find(
    (route) =>
      route.permission !== null && hasPermission(permissions, route.permission)
  )
  const shared = ADMIN_ROUTES.find((route) => route.permission === null)
  return own?.href ?? shared?.href ?? "/admin/tai-khoan"
}

export function safeNext(next: string | null | undefined): string | null {
  if (!next || next.startsWith("//") || next.startsWith("/\\")) return null
  const path = next.split(/[?#]/)[0]
  if (path !== "/admin" && !path.startsWith("/admin/")) return null
  if (path === LOGIN_PATH || path.startsWith(`${LOGIN_PATH}/`)) return null
  return next
}

export function loginUrl(currentPath: string): string {
  return `${LOGIN_PATH}?next=${encodeURIComponent(currentPath)}`
}
