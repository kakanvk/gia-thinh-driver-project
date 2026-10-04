import { formatDate, readTimeLabel } from "@/lib/public/format"
import type { PostSummary, PublicCategory } from "@/lib/public/types"

export type NewsCategory = PublicCategory

export type NewsPost = {
  slug: string
  title: string
  excerpt: string
  category: string | null
  categorySlug: string | null
  isAnnouncement: boolean
  date: string
  publishedAt: string
  readTime: string
  image: string | null
  imageAlt: string
}

export function toNewsPost(post: PostSummary): NewsPost {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    category: post.category?.name ?? null,
    categorySlug: post.category?.slug ?? null,
    isAnnouncement: post.category?.isAnnouncement ?? false,
    date: formatDate(post.publishedAt),
    publishedAt: post.publishedAt,
    readTime: readTimeLabel(post.readTimeMinutes),
    image: post.cover?.url ?? null,
    imageAlt: post.cover?.alt || post.title,
  }
}

const COMBINING_MARKS = /[\u0300-\u036f]/g

/**
 * Chuẩn hoá văn bản để tìm kiếm không phân biệt dấu: "hoc phi" khớp "Học phí".
 * Chuẩn hoá theo từng điểm mã (code point) nên độ dài không đổi, nhờ đó vị trí
 * khớp trong chuỗi đã chuẩn hoá vẫn ánh xạ đúng sang văn bản gốc khi tô sáng.
 */
export function normalizeForSearch(value: string): string {
  return Array.from(value)
    .map(
      (char) =>
        char.normalize("NFD").replace(COMBINING_MARKS, "").replace(/đ/gi, "d").toLowerCase() ||
        char,
    )
    .join("")
}

export function newsMatchesQuery(post: NewsPost, query: string): boolean {
  const needle = normalizeForSearch(query.trim())
  if (!needle) return true
  const haystack = [post.title, post.excerpt, post.category ?? ""]
  return haystack.some((field) => normalizeForSearch(field).includes(needle))
}

export type TextSegment = { text: string; match: boolean }

/** Cắt văn bản thành các đoạn khớp / không khớp từ khoá để tô sáng kết quả. */
export function splitByQuery(text: string, query: string): TextSegment[] {
  const needle = normalizeForSearch(query.trim())
  if (!needle) return [{ text, match: false }]

  const chars = Array.from(text)
  const normalized = Array.from(normalizeForSearch(text)).join("")
  const needleLength = Array.from(needle).length
  const segments: TextSegment[] = []

  let cursor = 0
  let index = normalized.indexOf(needle)
  while (index !== -1 && cursor < chars.length) {
    if (index > cursor) {
      segments.push({ text: chars.slice(cursor, index).join(""), match: false })
    }
    segments.push({
      text: chars.slice(index, index + needleLength).join(""),
      match: true,
    })
    cursor = index + needleLength
    index = normalized.indexOf(needle, cursor)
  }

  if (cursor < chars.length) {
    segments.push({ text: chars.slice(cursor).join(""), match: false })
  }
  return segments
}

export type NewsSortKey = "newest" | "oldest" | "title"

export function sortNewsPosts(posts: NewsPost[], sort: NewsSortKey): NewsPost[] {
  const list = [...posts]
  if (sort === "title") {
    return list.sort((a, b) => a.title.localeCompare(b.title, "vi"))
  }
  return list.sort((a, b) =>
    sort === "oldest"
      ? Date.parse(a.publishedAt) - Date.parse(b.publishedAt)
      : Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  )
}

// Bài không có chuyên mục không tính vào chuyên mục nào
export function countPostsByCategory(posts: NewsPost[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const post of posts) {
    if (post.categorySlug === null) continue
    counts[post.categorySlug] = (counts[post.categorySlug] ?? 0) + 1
  }
  return counts
}
