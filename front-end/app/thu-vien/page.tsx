import type { Metadata } from "next"

import { MediaGallery, type MediaItem } from "@/components/media-gallery"
import { ScrollReveal } from "@/components/scroll-reveal"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { getGallery } from "@/lib/api/public"
import type { PublicGalleryItem } from "@/lib/public/types"

export const metadata: Metadata = {
  title: "Thư viện ảnh & video | Trường lái Gia Thịnh",
  description:
    "Hình ảnh và video hoạt động đào tạo, sân tập và kỳ thi sát hạch tại trung tâm Gia Thịnh.",
}

export const revalidate = 300

function toMediaItem(item: PublicGalleryItem): MediaItem {
  return {
    src: item.url,
    kind: item.kind,
    alt: item.alt,
    caption: item.caption ?? undefined,
    poster: item.posterUrl ?? undefined,
    width: item.width ?? undefined,
    height: item.height ?? undefined,
  }
}

export default async function MediaPage() {
  const gallery = await getGallery()
  const items = gallery?.map(toMediaItem) ?? []

  return (
    <main className="min-h-svh bg-background">
      <SiteHeader />

      <section className="border-b border-border/60 bg-mist">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
          <ScrollReveal className="max-w-4xl">
            <Badge variant="outline" className="mb-5">
              Thư viện
            </Badge>
            <h1 className="text-3xl font-extrabold tracking-tight text-navy sm:whitespace-nowrap sm:text-4xl">
              Ảnh & video hoạt động của Gia Thịnh
            </h1>
            <p className="mt-4 leading-7 text-muted-foreground lg:whitespace-nowrap">
              Sân tập, buổi học thực hành và kỳ thi sát hạch — cập nhật từ tư liệu thực tế của trung tâm.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          {gallery === null ? (
            <p role="status" className="rounded-md border border-border bg-mist px-5 py-10 text-center text-muted-foreground">
              Thư viện đang được cập nhật, vui lòng quay lại sau.
            </p>
          ) : items.length === 0 ? (
            <p className="rounded-md border border-border bg-mist px-5 py-10 text-center text-muted-foreground">
              Chưa có ảnh hoặc video.
            </p>
          ) : (
            <MediaGallery items={items} />
          )}
        </div>
      </section>
    </main>
  )
}
