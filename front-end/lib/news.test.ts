import { describe, expect, it } from "vitest"

import { countPostsByCategory, newsMatchesQuery, sortNewsPosts, toNewsPost } from "@/lib/news"
import type { PostSummary } from "@/lib/public/types"

const summary = (over: Partial<PostSummary>): PostSummary => ({
  slug: "meo-thi",
  title: "Mẹo thi sa hình",
  excerpt: "Vòng số 8",
  cover: { url: "https://cdn/a.webp", alt: "" },
  tags: [],
  authorName: "Gia Thịnh",
  publishedAt: "2026-10-01T08:00:00+07:00",
  readTimeMinutes: 4,
  views: 0,
  category: { name: "Kinh nghiệm thi", slug: "kinh-nghiem-thi", isAnnouncement: false },
  ...over,
})

describe("toNewsPost", () => {
  it("chuyển dữ liệu API sang dạng hiển thị", () => {
    expect(toNewsPost(summary({}))).toEqual({
      slug: "meo-thi",
      title: "Mẹo thi sa hình",
      excerpt: "Vòng số 8",
      category: "Kinh nghiệm thi",
      categorySlug: "kinh-nghiem-thi",
      isAnnouncement: false,
      date: "01/10/2026",
      publishedAt: "2026-10-01T08:00:00+07:00",
      readTime: "4 phút đọc",
      image: "https://cdn/a.webp",
      imageAlt: "Mẹo thi sa hình",
    })
    expect(toNewsPost(summary({ cover: null, category: null }))).toMatchObject({
      image: null,
      category: null,
      categorySlug: null,
      isAnnouncement: false,
    })
  })
})

describe("tìm kiếm, sắp xếp, đếm", () => {
  const a = toNewsPost(summary({ slug: "a", title: "Ôn lý thuyết", publishedAt: "2026-09-01T08:00:00+07:00" }))
  const b = toNewsPost(summary({ slug: "b", title: "Bằng lái B", publishedAt: "2026-10-05T08:00:00+07:00", category: null }))

  it("tìm không dấu", () => {
    expect(newsMatchesQuery(a, "on ly thuyet")).toBe(true)
    expect(newsMatchesQuery(b, "kinh nghiem")).toBe(false)
  })

  it("sắp xếp theo publishedAt", () => {
    expect(sortNewsPosts([a, b], "newest").map((p) => p.slug)).toEqual(["b", "a"])
    expect(sortNewsPosts([b, a], "oldest").map((p) => p.slug)).toEqual(["a", "b"])
  })

  it("đếm theo chuyên mục, bỏ bài không có chuyên mục", () => {
    expect(countPostsByCategory([a, b])).toEqual({ "kinh-nghiem-thi": 1 })
  })
})
