import type { Metadata } from "next"
import { readdirSync } from "node:fs"
import { join } from "node:path"

import { MediaGallery, type MediaItem } from "@/components/media-gallery"
import { ScrollReveal } from "@/components/scroll-reveal"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"

export const metadata: Metadata = {
  title: "Thư viện ảnh & video | Trường lái Gia Thịnh",
  description:
    "Hình ảnh và video hoạt động đào tạo, sân tập và kỳ thi sát hạch tại trung tâm Gia Thịnh.",
}

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"])
const VIDEO_EXTS = new Set([".mp4", ".webm"])

function getMediaItems(): MediaItem[] {
  const dir = join(process.cwd(), "public", "media")
  let files: string[] = []
  try {
    files = readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
  } catch {
    return []
  }

  return files
    .map((name) => {
      const dot = name.lastIndexOf(".")
      const ext = dot >= 0 ? name.slice(dot).toLowerCase() : ""
      if (IMAGE_EXTS.has(ext)) return { src: `/media/${name}`, kind: "image" as const }
      if (VIDEO_EXTS.has(ext)) return { src: `/media/${name}`, kind: "video" as const }
      return null
    })
    .filter((item): item is MediaItem => item !== null)
    .sort((a, b) => a.src.localeCompare(b.src))
}

export default function MediaPage() {
  const items = getMediaItems()

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
          <MediaGallery items={items} />
        </div>
      </section>
    </main>
  )
}
