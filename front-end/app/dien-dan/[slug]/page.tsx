import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CalendarDays, Clock3, Phone } from "lucide-react"

import { getPost, getRelatedPosts, getSiteContact } from "@/lib/api/public"
import { toNewsPost } from "@/lib/news"

import { PostContent } from "@/components/post-content"
import { PostViewTracker } from "@/components/post-view-tracker"
import { ScrollReveal } from "@/components/scroll-reveal"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// generateStaticParams trả mảng rỗng: build không cần gọi API, mỗi slug render lần đầu có người mở
// rồi cache ISR 5 phút (thiếu hàm này Next coi route là dynamic, không cache HTML)
export const revalidate = 300

export async function generateStaticParams() {
  return []
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) return {}
  return {
    title: `${post.title} | Tin tức Gia Thịnh`,
    description: post.excerpt,
    openGraph: post.cover ? { images: [post.cover.url] } : undefined,
  }
}

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()

  const view = toNewsPost(post)
  const [related, contact] = await Promise.all([
    getRelatedPosts(view.categorySlug, slug),
    getSiteContact(),
  ])
  const relatedPosts = related.map(toNewsPost)

  return (
    <main className="min-h-svh bg-background">
      <SiteHeader />

      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Cột trái: nội dung */}
          <article className="min-w-0">
            <ScrollReveal>
              <Link
                href="/dien-dan"
                className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary hover:underline"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                Tất cả tin tức
              </Link>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {view.category ? <Badge>{view.category}</Badge> : null}
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays aria-hidden="true" className="size-3.5" />
                  {view.date}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock3 aria-hidden="true" className="size-3.5" />
                  {view.readTime}
                </span>
                <span className="text-xs text-muted-foreground">Tác giả: {post.authorName}</span>
              </div>
              <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-navy sm:text-4xl">
                {post.title}
              </h1>
              <p className="mt-4 text-lg leading-7 text-muted-foreground sm:leading-8">{post.excerpt}</p>
            </ScrollReveal>

            {view.image ? (
              <ScrollReveal className="relative mt-8 aspect-[16/9] overflow-hidden rounded-md border border-border" delay={0.08}>
                <Image
                  src={view.image}
                  alt={view.imageAlt}
                  fill
                  unoptimized
                  sizes="(max-width: 1024px) 100vw, 800px"
                  priority
                  className="object-cover"
                />
              </ScrollReveal>
            ) : null}

            <ScrollReveal className="mt-8" delay={0.1}>
              <PostContent value={post.content} />
            </ScrollReveal>
          </article>

          {/* Cột phải: sticky */}
          <aside className="min-w-0">
            <div className="flex flex-col gap-5 lg:sticky lg:top-24">
              {relatedPosts.length > 0 ? (
                <div>
                  <p className="font-extrabold text-navy">Bài viết liên quan</p>
                  <div className="mt-4 flex flex-col gap-4">
                    {relatedPosts.map((item) => (
                      <Link key={item.slug} href={`/dien-dan/${item.slug}`} className="group flex gap-3">
                        <span className="relative block h-16 w-24 shrink-0 overflow-hidden rounded-md border border-border bg-mist">
                          {item.image ? (
                            <Image
                              src={item.image}
                              alt={item.imageAlt}
                              fill
                              unoptimized
                              sizes="96px"
                              loading="lazy"
                              className="object-cover"
                            />
                          ) : (
                            <Image src="/giathinh-logo.png" alt="" fill sizes="96px" className="object-contain p-2 opacity-60" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-bold leading-snug text-navy group-hover:text-primary line-clamp-2">
                            {item.title}
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">{item.date}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-md bg-navy p-6 text-center text-white">
                <p className="font-extrabold">Cần tư vấn khóa học?</p>
                <p className="mt-2 text-sm leading-6 text-white/70">Phản hồi trong ít phút qua Zalo / điện thoại.</p>
                <a
                  href={contact.telHref}
                  className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "mt-4 h-11 w-full rounded-full px-6")}
                >
                  <Phone data-icon="inline-start" aria-hidden="true" />
                  {contact.hotline}
                </a>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <PostViewTracker slug={post.slug} />
    </main>
  )
}
