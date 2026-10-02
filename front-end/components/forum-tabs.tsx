"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { Bookmark, ChevronLeft, ChevronRight, MessageCircle, Search, ThumbsUp } from "lucide-react"

import type { ForumThread } from "@/lib/forum"
import { loadUserThreads, type UserThread } from "@/lib/forum-store"
import { VerifiedBadge } from "@/components/verified-badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 5

const AVATAR_COLORS = [
  "bg-orange-200 text-orange-900",
  "bg-fuchsia-200 text-fuchsia-900",
  "bg-indigo-200 text-indigo-900",
  "bg-sky-200 text-sky-900",
  "bg-violet-200 text-violet-900",
]

function avatarColor(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 997
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function ForumTabs({ threads }: { threads: ForumThread[] }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [userThreads, setUserThreads] = useState<UserThread[]>([])
  useEffect(() => {
    setUserThreads(loadUserThreads())
  }, [])

  const all = [...userThreads, ...threads] as ForumThread[]
  const categories = ["Tất cả", ...Array.from(new Set(all.map((t) => t.board)))]
  const [active, setActive] = useState("Tất cả")
  const [page, setPage] = useState(1)

  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<"new" | "liked">("new")
  const [savedOnly, setSavedOnly] = useState(false)
  const [saved, setSaved] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    let list = active === "Tất cả" ? all : all.filter((t) => t.board === active)
    if (savedOnly) list = list.filter((t) => saved.has(t.slug))
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter((t) => (t.title + t.author + t.board).toLowerCase().includes(q))
    }
    const sorted = [...list]
    if (sort === "liked") sorted.sort((a, b) => b.likes - a.likes)
    return sorted
  }, [all, active, query, sort, savedOnly, saved])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function goPage(n: number) {
    setPage(n)
    rootRef.current?.scrollIntoView({ block: "start" })
  }

  function selectCategory(cat: string) {
    setActive(cat)
    setPage(1)
  }

  return (
    <div ref={rootRef} className="scroll-mt-24">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-extrabold text-slate-900">Thảo luận</h2>
        {/* Mobile: lưới 2 cột cho dễ chạm; desktop: một hàng bên phải tiêu đề */}
        <div className="grid w-full grid-cols-2 items-center gap-2 sm:ml-auto sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
          <Select value={active} onValueChange={(v) => { if (typeof v === "string") selectCategory(v) }}>
            <SelectTrigger aria-label="Chủ đề" className="w-full min-w-0 rounded-md bg-slate-100 text-[13px] font-semibold text-slate-600 data-[size=default]:h-11 sm:w-fit sm:min-w-36 sm:data-[size=default]:h-9">
              <SelectValue placeholder="Chủ đề" />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} className="w-max min-w-(--anchor-width)">
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat === "Tất cả" ? "Mọi chủ đề" : cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => { if (v === "new" || v === "liked") { setSort(v); setPage(1) } }}>
            <SelectTrigger aria-label="Sắp xếp" className="w-full min-w-0 rounded-md bg-slate-100 text-[13px] font-semibold text-slate-600 data-[size=default]:h-11 sm:w-fit sm:min-w-32 sm:data-[size=default]:h-9">
              <span className="flex flex-1 text-left">{sort === "liked" ? "Nhiều thích nhất" : "Mới nhất"}</span>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} className="w-max min-w-(--anchor-width)">
              <SelectItem value="new">Mới nhất</SelectItem>
              <SelectItem value="liked">Nhiều thích nhất</SelectItem>
            </SelectContent>
          </Select>
          <button
            type="button"
            aria-pressed={savedOnly}
            onClick={() => { setSavedOnly((v) => !v); setPage(1) }}
            className={cn(
              "inline-flex h-11 items-center justify-center gap-1.5 rounded-md px-3 text-[13px] font-semibold sm:h-9 sm:justify-start",
              savedOnly ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:text-slate-900"
            )}
          >
            <Bookmark aria-hidden="true" className="size-3.5" />
            Đã lưu
          </button>
          <span className="relative block sm:w-auto">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1) }}
              placeholder="Tìm..."
              aria-label="Tìm kiếm"
              className="h-11 w-full rounded-md bg-slate-100 pr-3 pl-8 text-base outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/30 transition-all sm:h-9 sm:w-9 sm:pr-1 sm:text-[13px] sm:focus:w-40"
            />
          </span>
        </div>
      </div>

      <div className="mt-4 divide-y divide-slate-100">
        {paged.length === 0 ? (
          <div className="px-2 py-10 text-center">
            <p className="text-sm font-medium text-slate-700">
              {query.trim()
                ? `Không có thảo luận nào khớp với "${query.trim()}".`
                : "Chưa có thảo luận nào phù hợp."}
            </p>
            <button
              type="button"
              onClick={() => { setQuery(""); setSavedOnly(false); selectCategory("Tất cả"); }}
              className="mt-3 inline-flex h-11 items-center rounded-md border border-slate-200 px-4 text-[13px] font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 sm:h-9"
            >
              Xóa bộ lọc
            </button>
          </div>
        ) : (
          paged.map((thread) => (
            <article key={thread.slug} className="py-5 first:pt-2">
              <div className="flex items-center gap-2">
                <span className={cn("grid size-8 place-items-center rounded-full text-[13px] font-extrabold", avatarColor(thread.author))}>
                  {thread.author.charAt(0)}
                </span>
                <span className="text-[13px] font-medium text-slate-700">{thread.author}</span>
                <VerifiedBadge className="size-4" />
                {thread.pinned ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">Ghim</span>
                ) : null}
              </div>
              <Link href={`/thao-luan/${thread.slug}`} className="group mt-2 block">
                <h3 className="text-[15px] font-bold text-slate-950 group-hover:text-blue-700">{thread.title}</h3>
                <p className="mt-1 line-clamp-2 text-[13px] leading-6 text-indigo-900/70">
                  {thread.content[0]}
                </p>
              </Link>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-600"># {thread.board}</span>
                  <span className="mx-1">·</span>{thread.time}
                </span>
                <span className="ml-auto flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Lưu"
                    aria-pressed={saved.has(thread.slug)}
                    onClick={() => setSaved((prev) => { const n = new Set(prev); if (n.has(thread.slug)) n.delete(thread.slug); else n.add(thread.slug); return n })}
                    className={cn(
                      "grid size-11 place-items-center rounded-md border text-slate-400 transition-colors hover:text-blue-600 sm:size-8",
                      saved.has(thread.slug) ? "border-blue-200 bg-blue-50 text-blue-600" : "border-slate-200"
                    )}
                  >
                    <Bookmark aria-hidden="true" className="size-3.5" fill={saved.has(thread.slug) ? "currentColor" : "none"} />
                  </button>
                  <span className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2.5 text-xs font-bold text-green-600 tabular-nums">
                    <ThumbsUp aria-hidden="true" className="size-3.5" fill="currentColor" />
                    {thread.likes}
                  </span>
                  <Link
                    href={`/thao-luan/${thread.slug}`}
                    className="inline-flex h-11 items-center gap-1 rounded-md border border-blue-600 px-2.5 text-xs font-bold text-blue-700 hover:bg-blue-50 sm:h-8"
                  >
                    <MessageCircle aria-hidden="true" className="size-3.5" fill="currentColor" />
                    Trả lời
                  </Link>
                </span>
              </div>
            </article>
          ))
        )}
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            aria-label="Trang trước"
            disabled={safePage <= 1}
            onClick={() => goPage(Math.max(1, safePage - 1))}
            className="grid size-11 place-items-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40 sm:size-9"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`Trang ${n}`}
              aria-current={n === safePage ? "page" : undefined}
              onClick={() => goPage(n)}
              className={cn(
                "h-11 min-w-11 rounded-lg px-2 text-sm font-bold tabular-nums transition-colors sm:h-9 sm:min-w-9",
                n === safePage
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 text-slate-500 hover:bg-slate-50"
              )}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            aria-label="Trang sau"
            disabled={safePage >= totalPages}
            onClick={() => goPage(Math.min(totalPages, safePage + 1))}
            className="grid size-11 place-items-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40 sm:size-9"
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  )
}
