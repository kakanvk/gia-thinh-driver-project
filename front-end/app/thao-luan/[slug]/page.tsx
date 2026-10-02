import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowLeft,
  MessagesSquare,
  Phone,
  ThumbsUp,
} from "lucide-react"

import { getThread, threads } from "@/lib/forum"
import { ForumThreadClient } from "@/components/forum-thread-client"
import { StickyHeader } from "@/components/sticky-header"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function generateStaticParams() {
  return threads.map((thread) => ({ slug: thread.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const thread = getThread(slug)
  if (!thread) return {}
  return {
    title: `${thread.title} | Diễn đàn Gia Thịnh`,
    description: thread.content[0],
  }
}

export default async function ThreadDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const thread = getThread(slug)
  if (!thread) notFound()

  const related = threads.filter((item) => item.slug !== slug).slice(0, 4)

  return (
    <main className="min-h-svh bg-background">
      <StickyHeader />

      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Cột trái: nội dung */}
          <article className="min-w-0">
            <div>
              <Link
                href="/thao-luan"
                className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary hover:underline"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                Tất cả thảo luận
              </Link>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {thread.pinned ? (
                  <Badge variant="secondary">Ghim</Badge>
                ) : (
                  <Badge variant="outline">{thread.board}</Badge>
                )}
              </div>
              <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-navy sm:text-4xl">
                {thread.title}
              </h1>
            </div>

            <div className="mt-8 rounded-md border border-border bg-card p-5 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-sm font-extrabold text-primary">
                  {thread.author.charAt(0)}
                </span>
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-extrabold text-navy">
                    {thread.author}
                  </p>
                  <p className="text-xs text-muted-foreground">Người đăng · {thread.time}</p>
                </div>
                <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                  <ThumbsUp aria-hidden="true" className="size-3.5" />
                  {thread.likes}
                </span>
              </div>
              <div className="mt-5 flex flex-col gap-4">
                {thread.content.map((paragraph, index) => (
                  <p key={index} className="leading-7 text-foreground/85">
                    {paragraph}
                  </p>
                ))}
              </div>
              {thread.images && thread.images.length > 0 ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {thread.images.map((src, i) => (
                    <span
                      key={i}
                      className="relative block aspect-[4/3] overflow-hidden rounded-md border border-border"
                    >
                      <Image
                        src={src}
                        alt={`Ảnh đính kèm ${i + 1} của bài viết`}
                        fill
                        sizes="(max-width: 1024px) 100vw, 480px"
                        loading="lazy"
                        className="object-cover"
                      />
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-8 flex items-center gap-2">
              <MessagesSquare aria-hidden="true" className="size-5 text-primary" />
              <h2 className="text-xl font-extrabold text-navy">
                {thread.replies.length} trả lời
              </h2>
            </div>

            <ForumThreadClient initialReplies={thread.replies} />
          </article>

          {/* Cột phải: sticky */}
          <aside aria-label="Thảo luận liên quan" className="min-w-0">
            <div className="flex flex-col gap-5 lg:sticky lg:top-24">
              <div>
                <p className="font-extrabold text-navy">Thảo luận liên quan</p>
                <div className="mt-4 flex flex-col gap-3">
                  {related.map((item) => (
                    <Link
                      key={item.slug}
                      href={`/thao-luan/${item.slug}`}
                      className="group rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/40"
                    >
                      <Badge variant="outline" className="text-[11px]">{item.board}</Badge>
                      <span className="mt-2 block text-sm font-bold leading-snug text-navy group-hover:text-primary">
                        {item.title}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground tabular-nums">
                        {item.replies.length} trả lời · {item.likes} thích
                      </span>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="rounded-md bg-navy p-6 text-center text-white">
                <p className="font-extrabold">Muốn tham gia thảo luận?</p>
                <p className="mt-2 text-sm leading-6 text-white/70">
                  Vào nhóm Zalo lớp để hỏi đáp trực tiếp cùng thầy cô và học viên các khóa.
                </p>
                <a
                  href="tel:0779666664"
                  className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "mt-4 h-11 w-full rounded-full px-6")}
                >
                  <Phone data-icon="inline-start" aria-hidden="true" />
                  0779 666 664
                </a>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
