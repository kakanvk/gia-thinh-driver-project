import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CalendarDays, Clock3, Phone } from "lucide-react"

import { getSiteContact } from "@/lib/api/public"
import { getPost, newsPosts } from "@/lib/news"

import { ScrollReveal } from "@/components/scroll-reveal"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function generateStaticParams() {
  return newsPosts.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) return {}
  return {
    title: `${post.title} | Tin tức Gia Thịnh`,
    description: post.excerpt,
  }
}

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) notFound()

  const contact = await getSiteContact()
  const related = newsPosts.filter((item) => item.slug !== slug).slice(0, 4)

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
                <Badge>{post.category}</Badge>
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays aria-hidden="true" className="size-3.5" />
                  {post.date}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock3 aria-hidden="true" className="size-3.5" />
                  {post.readTime}
                </span>
              </div>
              <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-navy sm:text-4xl">
                {post.title}
              </h1>
              <p className="mt-4 text-lg leading-7 text-muted-foreground sm:leading-8">{post.excerpt}</p>
            </ScrollReveal>

            <ScrollReveal className="relative mt-8 aspect-[16/9] overflow-hidden rounded-md border border-border" delay={0.08}>
              <Image
                src={post.image}
                alt={post.imageAlt}
                fill
                sizes="(max-width: 1024px) 100vw, 800px"
                priority
                className="object-cover"
              />
            </ScrollReveal>

            <ScrollReveal className="mt-8 flex flex-col gap-5" delay={0.1}>
              {post.content.map((paragraph, index) => (
                <p key={index} className="leading-7 text-foreground/85 sm:leading-8">
                  {paragraph}
                </p>
              ))}
            </ScrollReveal>
          </article>

          {/* Cột phải: sticky */}
          <aside className="min-w-0">
            <div className="flex flex-col gap-5 lg:sticky lg:top-24">
              <div>
                <p className="font-extrabold text-navy">Bài viết liên quan</p>
                <div className="mt-4 flex flex-col gap-4">
                  {related.map((item) => (
                    <Link key={item.slug} href={`/dien-dan/${item.slug}`} className="group flex gap-3">
                      <span className="relative block h-16 w-24 shrink-0 overflow-hidden rounded-md border border-border">
                        <Image
                          src={item.image}
                          alt={item.imageAlt}
                          fill
                          sizes="96px"
                          loading="lazy"
                          className="object-cover"
                        />
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

    </main>
  )
}
