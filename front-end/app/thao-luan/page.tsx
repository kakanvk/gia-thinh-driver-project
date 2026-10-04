import type { Metadata } from "next"
import Link from "next/link"
import { Phone, PlusCircle, ThumbsUp } from "lucide-react"

import { threads } from "@/lib/forum"
import { ForumTabs } from "@/components/forum-tabs"
import { VerifiedBadge } from "@/components/verified-badge"
import { SiteHeader } from "@/components/site-header"
import { getSiteContact } from "@/lib/api/public"

export const metadata: Metadata = {
  title: "Diễn đàn học viên | Trường lái Gia Thịnh",
  description:
    "Nơi học viên Gia Thịnh chia sẻ kinh nghiệm học, thi sát hạch và hỏi đáp cùng cộng đồng.",
}

const TOP_USERS = [
  { name: "Thầy Đức", likes: "232", color: "bg-orange-200 text-orange-900" },
  { name: "Minh T.", likes: "178", color: "bg-fuchsia-200 text-fuchsia-900" },
  { name: "Hoài An", likes: "132", color: "bg-indigo-200 text-indigo-900" },
  { name: "Quốc B.", likes: "98", color: "bg-sky-200 text-sky-900" },
  { name: "Tư vấn viên", likes: "86", color: "bg-violet-200 text-violet-900" },
]

const TOPIC_COUNTS = [
  { name: "# xe-may", count: 24 },
  { name: "# o-to", count: 22 },
  { name: "# ho-so", count: 20 },
  { name: "# hoi-dap", count: 18 },
  { name: "# meo-thi", count: 10 },
  { name: "# lich-thi", count: 10 },
]

export default async function ForumPage() {
  const contact = await getSiteContact()
  return (
    <main className="min-h-svh bg-[#eef0f2]">
      <SiteHeader />

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <Link
            href="/thao-luan/dang-bai"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary text-sm font-bold text-white hover:bg-primary/90 lg:hidden"
          >
            <PlusCircle aria-hidden="true" className="size-5" />
            Đăng bài mới
          </Link>

          {/* cột chính */}
          <section className="min-w-0 rounded-md bg-white p-4 sm:p-6">
            <ForumTabs threads={threads} />
          </section>

          {/* sidebar */}
          <aside className="flex min-w-0 flex-col gap-4">
            <Link
              href="/thao-luan/dang-bai"
              className="hidden h-11 items-center justify-center gap-2 rounded-md bg-primary text-sm font-bold text-white hover:bg-primary/90 lg:inline-flex"
            >
              <PlusCircle aria-hidden="true" className="size-5" />
              Đăng bài mới
            </Link>

            <div className="rounded-md border border-border bg-card p-4">
              <p className="text-[15px] font-bold text-slate-900">Thành viên tích cực</p>
              <ul className="mt-3 flex flex-col">
                {TOP_USERS.map((u) => (
                  <li key={u.name} className="flex items-center gap-2 border-b border-slate-100 py-2.5 last:border-0">
                    <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-extrabold ${u.color}`}>
                      {u.name.charAt(0)}
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-1 truncate text-[13px] font-medium text-slate-700">
                      <span className="truncate">{u.name}</span>
                      <VerifiedBadge className="size-4" />
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600 tabular-nums">
                      <ThumbsUp aria-hidden="true" className="size-3" fill="currentColor" />
                      {u.likes}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-md border border-border bg-card p-4">
              <p className="text-[15px] font-bold text-slate-900">Chủ đề nổi bật</p>
              <ul className="mt-2 flex flex-col">
                {TOPIC_COUNTS.map((t) => (
                  <li key={t.name} className="flex items-center justify-between gap-2 border-b border-slate-100 py-2.5 text-[13px] last:border-0">
                    <span className="truncate font-medium text-slate-700">{t.name}</span>
                    <span className="shrink-0 text-xs text-slate-500 tabular-nums">{t.count} bài viết</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-md bg-navy p-5 text-center text-white">
              <p className="text-sm font-extrabold">Muốn hỏi nhanh, đáp gọn?</p>
              <p className="mt-1 text-xs leading-5 text-white/70">
                Vào nhóm Zalo lớp để được thầy cô hỗ trợ trực tiếp.
              </p>
              <a
                href={contact.telHref}
                className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-navy hover:bg-white/90"
              >
                <Phone aria-hidden="true" className="size-4" />
                {contact.hotline}
              </a>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
