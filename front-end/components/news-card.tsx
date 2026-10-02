import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import type { NewsPost } from "@/lib/news"
import { HighlightMatch } from "@/components/highlight-match"
import { Badge } from "@/components/ui/badge"

export function NewsCard({ post, query }: { post: NewsPost; query?: string }) {
  return (
    <Link
      href={`/dien-dan/${post.slug}`}
      className="flex h-full flex-col overflow-hidden rounded-md border border-border bg-card"
    >
      <span className="relative block aspect-[16/10] overflow-hidden bg-mist">
        <Image
          src={post.image}
          alt={post.imageAlt}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          loading="lazy"
          className="object-cover"
        />
      </span>
      <span className="flex flex-1 flex-col p-4">
        <span className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{post.category}</Badge>
          <span className="text-xs text-muted-foreground">{post.date}</span>
        </span>
        <span
          className="mt-3 line-clamp-2 block min-h-0 text-lg leading-snug font-extrabold text-navy"
          style={{
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
            overflow: "hidden",
          }}
        >
          <HighlightMatch text={post.title} query={query} />
        </span>
        <span
          className="mt-2 line-clamp-2 block min-h-0 flex-1 text-sm leading-6 text-muted-foreground"
          style={{
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
            overflow: "hidden",
          }}
        >
          <HighlightMatch text={post.excerpt} query={query} />
        </span>
        <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-primary">
          Đọc bài viết
          <ArrowRight aria-hidden="true" className="size-4" />
        </span>
      </span>
    </Link>
  )
}
