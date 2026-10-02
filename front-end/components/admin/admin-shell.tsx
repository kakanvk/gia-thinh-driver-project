"use client"

import type { LucideIcon } from "lucide-react"
import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Bell,
  Building2,
  CalendarDays,
  Car,
  ChevronDown,
  ClipboardCheck,
  ExternalLink,
  FileText,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
  UserCog,
  Users,
  Wallet,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type NavItem = {
  label: string
  href: string
  icon: LucideIcon
}

type NavGroup = {
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: "Vận hành",
    items: [
      { label: "Tổng quan", href: "/admin", icon: LayoutDashboard },
      {
        label: "Lịch đăng ký",
        href: "/admin/lich-dang-ky",
        icon: CalendarDays,
      },
      { label: "Lớp học", href: "/admin/lop-hoc", icon: GraduationCap },
      { label: "Lịch thi", href: "/admin/lich-thi", icon: ClipboardCheck },
      { label: "Người dùng", href: "/admin/nguoi-dung", icon: Users },
      { label: "Chi nhánh", href: "/admin/chi-nhanh", icon: Building2 },
    ],
  },
  {
    label: "Đào tạo",
    items: [
      { label: "Giáo viên", href: "/admin/giao-vien", icon: UserCog },
      { label: "Xe tập lái", href: "/admin/xe-tap-lai", icon: Car },
    ],
  },
  {
    label: "Tài chính",
    items: [{ label: "Học phí", href: "/admin/hoc-phi", icon: Wallet }],
  },
  {
    label: "Nội dung",
    items: [{ label: "Bài viết", href: "/admin/bai-viet", icon: FileText }],
  },
  {
    label: "Hệ thống",
    items: [
      { label: "Cài đặt", href: "/admin/cai-dat", icon: Settings },
      { label: "Trợ giúp", href: "/admin/tro-giup", icon: HelpCircle },
    ],
  },
]

const navItems: NavItem[] = navGroups.flatMap((group) => group.items)

function isActiveRoute(pathname: string, href: string) {
  if (href === "/admin") return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActiveRoute(pathname, item.href)
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-10 items-center gap-3 rounded-md px-3 text-[13px] font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {active ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-1.5 -left-4 w-1 rounded-r-sm bg-primary"
        />
      ) : null}
      <Icon aria-hidden="true" className="size-[18px]" />
      <span>{item.label}</span>
    </Link>
  )
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)

  function logOut() {
    router.push("/")
  }

  return (
    <div data-admin-shell className="min-h-svh bg-muted/60 text-[13px]">
      <a
        href="#admin-content"
        className="fixed top-3 left-3 z-50 -translate-y-20 rounded-md bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground focus:translate-y-0"
      >
        Bỏ qua điều hướng
      </a>

      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border/70 bg-background px-4 py-5 lg:flex">
        <Link
          href="/admin"
          className="flex min-h-12 items-center gap-3 px-2"
          aria-label="Quản trị Gia Thịnh - Tổng quan"
        >
          <Image
            src="/giathinh-logo.png"
            alt=""
            width={48}
            height={48}
            className="size-10 object-contain"
          />
          <span className="min-w-0">
            <span className="block text-sm font-bold tracking-tight text-navy">
              GIA THỊNH
            </span>
            <span className="block text-[9px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Trung tâm quản trị
            </span>
          </span>
        </Link>

        <div className="admin-nav-scroll mt-6 -ml-4 flex flex-1 flex-col gap-5 overflow-y-auto pl-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 text-[10px] font-semibold text-muted-foreground uppercase">
                {group.label}
              </p>
              <nav
                aria-label={`Điều hướng ${group.label.toLowerCase()}`}
                className="mt-2 flex flex-col gap-1"
              >
                {group.items.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} />
                ))}
              </nav>
            </div>
          ))}
        </div>
      </aside>

      <div className="min-h-svh lg:pl-64">
        <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur-xl">
          <div className="flex min-h-16 items-center gap-3 px-4">
            <Link
              href="/admin"
              className="flex shrink-0 items-center gap-2 lg:hidden"
              aria-label="Quản trị Gia Thịnh - Tổng quan"
            >
              <Image
                src="/giathinh-logo.png"
                alt=""
                width={36}
                height={36}
                className="size-9 object-contain"
              />
              <strong className="hidden text-sm text-navy sm:block">
                GIA THỊNH
              </strong>
            </Link>

            <label className="relative hidden max-w-md flex-1 sm:block">
              <span className="sr-only">Tìm kiếm trong trang quản trị</span>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="search"
                placeholder="Tìm học viên, hồ sơ, bài viết..."
                className="h-9 w-full rounded-md border border-border bg-muted/50 pr-4 pl-10 text-[13px] transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              />
            </label>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                aria-label="Thông báo, có 3 thông báo mới"
                className="relative grid size-9 place-items-center rounded-md bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Bell aria-hidden="true" className="size-[18px]" />
                <span className="absolute top-2 right-2 size-1.5 rounded-full bg-logo-red" />
              </button>
              <DropdownMenu
                open={accountMenuOpen}
                onOpenChange={setAccountMenuOpen}
              >
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Mở menu tài khoản quản trị viên"
                      className="flex min-h-9 items-center gap-2 rounded-md bg-background pr-2 pl-1 hover:bg-muted data-popup-open:bg-muted"
                    />
                  }
                >
                  <span className="grid size-7 place-items-center rounded-md bg-navy text-xs font-semibold text-white">
                    AD
                  </span>
                  <span className="hidden text-left xl:block">
                    <span className="block text-xs leading-4 font-semibold">
                      Quản trị viên
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      Gia Thịnh
                    </span>
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      "hidden size-4 text-muted-foreground transition-transform duration-150 xl:block",
                      accountMenuOpen && "rotate-180"
                    )}
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={8}
                  className="w-64"
                >
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="flex items-center gap-3 p-2">
                      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-navy text-xs font-semibold text-white">
                        AD
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold text-foreground">
                          Quản trị viên
                        </span>
                        <span className="block truncate text-[11px] font-normal text-muted-foreground">
                          Trung tâm Gia Thịnh
                        </span>
                      </span>
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => router.push("/admin")}
                    className="min-h-9 gap-2 px-2 text-[13px] focus:bg-muted focus:text-foreground"
                  >
                    <LayoutDashboard aria-hidden="true" className="size-4" />
                    Tổng quan quản trị
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => router.push("/")}
                    className="min-h-9 gap-2 px-2 text-[13px] focus:bg-muted focus:text-foreground"
                  >
                    <ExternalLink aria-hidden="true" className="size-4" />
                    Xem trang web
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      void navigator.clipboard?.writeText("support@giathinh.vn")
                    }}
                    className="min-h-9 gap-2 px-2 text-[13px] focus:bg-muted focus:text-foreground"
                  >
                    <HelpCircle aria-hidden="true" className="size-4" />
                    Sao chép email hỗ trợ
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={logOut}
                    className="min-h-9 gap-2 px-2 text-[13px]"
                  >
                    <LogOut aria-hidden="true" className="size-4" />
                    Đăng xuất
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <nav
            aria-label="Điều hướng quản trị trên thiết bị nhỏ"
            className="flex gap-1 overflow-x-auto px-4 pb-3 lg:hidden"
          >
            {navItems.map((item) => {
              const active = isActiveRoute(pathname, item.href)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-9 shrink-0 items-center gap-2 rounded-md px-3 text-xs font-medium",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </header>

        {children}
      </div>
    </div>
  )
}
