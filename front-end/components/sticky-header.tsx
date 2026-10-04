"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, Phone, X } from "lucide-react"
import { useMotionValueEvent, useScroll } from "motion/react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const navItems = [
  { label: "Giới thiệu", href: "/#gioi-thieu", sectionId: "gioi-thieu" },
  { label: "Khóa học", href: "/#khoa-hoc", sectionId: "khoa-hoc" },
  { label: "Lịch khai giảng", href: "/#lich-khai-giang", sectionId: "lich-khai-giang" },
  { label: "Sân tập 3D", href: "/san-tap" },
  { label: "Thư viện", href: "/thu-vien" },
  { label: "Diễn đàn", href: "/dien-dan" },
]

// Hash trên URL là nguồn ngoài React: đọc qua useSyncExternalStore (server trả "")
// để không lệch hydration và không phải setState đồng bộ trong effect.
function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange)
  return () => window.removeEventListener("hashchange", onChange)
}
const getHash = () => window.location.hash.slice(1)
const getServerHash = () => ""

export function StickyHeader() {
  const [compact, setCompact] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  const hash = useSyncExternalStore(subscribeHash, getHash, getServerHash)
  const { scrollY } = useScroll()

  useMotionValueEvent(scrollY, "change", (latest) => {
    const nextCompact = latest > 48
    setCompact((current) => (current === nextCompact ? current : nextCompact))
  })

  // Theo dõi section đang hiển thị trên trang chủ để active nav tương ứng
  useEffect(() => {
    // Ngoài trang chủ isActive() đã trả false; state được reset khi rời "/" (cleanup bên dưới)
    if (pathname !== "/") return
    const ids = navItems
      .map((item) => item.sectionId)
      .filter((id): id is string => Boolean(id))
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible?.target.id) setActiveSection(visible.target.id)
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: [0, 0.25, 0.5] }
    )
    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => {
      observer.disconnect()
      setActiveSection(null)
    }
  }, [pathname])

  // Đóng sidebar khi bấm Escape, khóa cuộn nền khi mở
  useEffect(() => {
    if (!menuOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false)
    }
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = ""
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [menuOpen])

  function isActive(item: (typeof navItems)[number]) {
    // Route riêng: active khi pathname trùng hoặc là trang con
    if (!item.sectionId) {
      return pathname === item.href || pathname.startsWith(`${item.href}/`)
    }
    // Section trang chủ: active khi đang ở "/" và section đang hiển thị
    // Chưa có section nào được observer báo thì dùng hash sẵn trên URL (vd: /#khoa-hoc)
    if (pathname !== "/") return false
    return (activeSection ?? (hash || null)) === item.sectionId
  }

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 h-[64px] border-b backdrop-blur-xl",
          compact
            ? "border-border/80 bg-background/92 shadow-[0_10px_35px_-24px_rgba(9,57,102,0.55)]"
            : "border-border/60 bg-background/96"
        )}
      >
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Trường lái Gia Thịnh - Trang chủ">
            <span className="block">
              <Image
                src="/giathinh-logo.png"
                alt="Logo Gia Thịnh đào tạo lái xe"
                width={160}
                height={48}
                priority
                className="h-10 w-auto"
              />
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Trung tâm đào tạo lái xe
              </span>
              <strong className="mt-1 text-[18px] leading-none font-extrabold tracking-tight text-logo-red">
                GIA THỊNH
              </strong>
            </span>
          </Link>

          <nav aria-label="Điều hướng chính" className="hidden h-full items-stretch gap-7 self-stretch lg:flex">
            {navItems.map((item) => {
              const active = isActive(item)
              return (
                <a
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex items-center text-sm font-semibold transition-colors hover:text-primary",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {item.label}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-x-0 bottom-0 h-[2.5px] rounded-full bg-primary transition-transform duration-200",
                      active ? "scale-x-100" : "scale-x-0"
                    )}
                  />
                </a>
              )
            })}
          </nav>

          <a
            href="tel:0779666664"
            className={cn(buttonVariants({ size: "lg" }), "hidden rounded-full sm:inline-flex")}
          >
            <Phone data-icon="inline-start" aria-hidden="true" />
            <span className="hidden sm:inline">0779 666 664</span>
            <span className="sm:hidden">Gọi ngay</span>
          </a>

          <button
            type="button"
            aria-label="Mở menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className="grid size-11 place-items-center rounded-md text-navy hover:bg-primary/10 lg:hidden"
          >
            <Menu aria-hidden="true" className="size-6" />
          </button>
        </div>
      </header>

      {menuOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu điều hướng"
          className="fixed inset-0 z-[60] lg:hidden"
        >
          <div
            aria-hidden="true"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-navy/50"
          />
          <div className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col bg-background shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <span className="text-base font-extrabold text-logo-red">GIA THỊNH</span>
              <button
                type="button"
                aria-label="Đóng menu"
                onClick={() => setMenuOpen(false)}
                className="grid size-10 place-items-center rounded-md text-navy hover:bg-primary/10"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            <nav aria-label="Điều hướng di động" className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
              {navItems.map((item) => {
                const active = isActive(item)
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "rounded-md px-4 py-3 text-sm font-bold transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-navy hover:bg-primary/5"
                    )}
                  >
                    {item.label}
                  </a>
                )
              })}
            </nav>
            <div className="border-t border-border p-4">
              <a
                href="tel:0779666664"
                className={cn(buttonVariants({ size: "lg" }), "h-11 w-full rounded-md")}
              >
                <Phone data-icon="inline-start" aria-hidden="true" />
                0779 666 664
              </a>
            </div>
          </div>
        </div>
      ) : null}

      <a
        href="tel:0779666664"
        aria-label="Gọi ngay 0779 666 664"
        className="group fixed right-5 bottom-5 z-40 grid size-14 place-items-center rounded-full bg-logo-red text-white shadow-[0_10px_30px_-8px_color-mix(in_oklch,var(--logo-red)_70%,transparent)] transition-transform hover:scale-105 active:scale-95 sm:right-6 sm:bottom-6"
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-logo-red/35 motion-safe:animate-ping animation-duration-[2s]"
        />
        <Phone aria-hidden="true" className="relative size-6" />
      </a>
    </>
  )
}
