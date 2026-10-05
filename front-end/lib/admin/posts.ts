"use client"

import { useQuery } from "@tanstack/react-query"

import { apiData } from "@/lib/api/client"

// back-end/src/modules/posts/post.model.ts (toJSON; danh sách bỏ content/contentText)
export const POST_STATUSES = [
  "draft",
  "pending",
  "published",
  "archived",
] as const
export type PostStatus = (typeof POST_STATUSES)[number]

export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  draft: "Nháp",
  pending: "Chờ duyệt",
  published: "Đã xuất bản",
  archived: "Lưu trữ",
}

export type PostCover = { url: string; alt: string; mediaId?: string | null }

export type AdminPost = {
  id: string
  title: string
  slug: string
  excerpt: string
  excerptAuto?: boolean
  cover: PostCover | null
  categoryId: string
  tags: string[]
  authorName: string
  status: PostStatus
  publishedAt: string | null
  views: number
  readTimeMinutes?: number
  seo: { title?: string; description?: string } | null
  content?: unknown[]
  createdAt: string
  updatedAt: string
}

// back-end/src/modules/categories/category.model.ts
export type Category = {
  id: string
  name: string
  slug: string
  description?: string | null
  isAnnouncement: boolean
  order: number
  postCount?: number
}

// Bài đã xuất bản nhưng publishedAt ở tương lai → "Hẹn giờ"
export function postStatusLabel(
  post: Pick<AdminPost, "status" | "publishedAt">,
  now: Date = new Date()
): string {
  if (
    post.status === "published" &&
    post.publishedAt &&
    Date.parse(post.publishedAt) > now.getTime()
  ) {
    return "Hẹn giờ"
  }
  return POST_STATUS_LABELS[post.status]
}

export function useCategories(enabled = true) {
  return useQuery({
    queryKey: ["lookup", "categories"],
    queryFn: () => apiData<Category[]>("/categories"),
    staleTime: 10 * 60 * 1000,
    enabled,
  })
}

// Slug từ tiêu đề: bỏ dấu tiếng Việt, đ → d, ký tự khác → "-" (backend giới hạn 150)
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150)
    .replace(/-+$/, "")
}

export type PostFormState = {
  title: string
  slug: string
  excerpt: string
  categoryId: string
  tags: string[]
  cover: PostCover | null
  authorName: string
  seoTitle: string
  seoDescription: string
  content: unknown[]
}

export type PostBody = {
  title: string
  slug?: string
  excerpt?: string
  categoryId: string
  tags: string[]
  cover: PostCover | null
  authorName?: string
  seo: { title?: string; description?: string } | null
  content: unknown[]
}

// Thân request POST/PATCH /posts: bỏ trường tuỳ chọn để trống
export function buildPostBody(state: PostFormState): PostBody {
  const optional = (value: string) => value.trim() || undefined
  const seoTitle = optional(state.seoTitle)
  const seoDescription = optional(state.seoDescription)
  return {
    title: state.title.trim(),
    slug: optional(state.slug),
    excerpt: optional(state.excerpt),
    categoryId: state.categoryId,
    tags: state.tags,
    cover: state.cover
      ? {
          url: state.cover.url,
          alt: state.cover.alt.slice(0, 200),
          ...(state.cover.mediaId ? { mediaId: state.cover.mediaId } : {}),
        }
      : null,
    authorName: optional(state.authorName),
    seo:
      seoTitle || seoDescription
        ? { title: seoTitle, description: seoDescription }
        : null,
    content: state.content,
  }
}
