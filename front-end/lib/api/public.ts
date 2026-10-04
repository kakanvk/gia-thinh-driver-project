import { toSiteContact, type SiteContact } from "@/lib/public/contact"
import type {
  BranchPricing,
  PageMeta,
  PostDetail,
  PostSummary,
  PublicBranch,
  PublicCategory,
  PublicSettings,
  UpcomingClass,
  UpcomingExam,
} from "@/lib/public/types"

// Dữ liệu công khai đọc phía server (Server Component), cache ISR 5 phút.
export const PUBLIC_REVALIDATE = 300

export class PublicApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = "PublicApiError"
  }
}

type Query = Record<string, string | number | undefined>

function publicUrl(path: string, query?: Query): string {
  const origin = process.env.API_ORIGIN?.replace(/\/+$/, "")
  if (!origin) throw new PublicApiError(0, "Thiếu API_ORIGIN")
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") params.append(key, String(value))
  }
  const search = params.toString()
  return `${origin}/api/v1/public${path}${search ? `?${search}` : ""}`
}

export async function publicFetch<T>(path: string, query?: Query): Promise<T> {
  const url = publicUrl(path, query)
  let res: Response
  try {
    res = await fetch(url, { next: { revalidate: PUBLIC_REVALIDATE } })
  } catch {
    throw new PublicApiError(0, `Không kết nối được API (${path})`)
  }
  if (!res.ok) throw new PublicApiError(res.status, `API ${path} trả ${res.status}`)
  return (await res.json()) as T
}

export async function publicGet<T>(path: string, query?: Query): Promise<T> {
  return (await publicFetch<{ data: T }>(path, query)).data
}

// Khối có dự phòng trên trang: lỗi API không làm hỏng trang
export async function publicGetOrNull<T>(path: string, query?: Query): Promise<T | null> {
  try {
    return await publicGet<T>(path, query)
  } catch (error) {
    console.error(`[public-api] ${path}`, error)
    return null
  }
}

export const getSettings = () => publicGetOrNull<PublicSettings>("/settings")
export const getBranches = () => publicGetOrNull<PublicBranch[]>("/branches")
export const getPricing = () => publicGetOrNull<BranchPricing[]>("/pricing")
export const getUpcomingClasses = () => publicGetOrNull<UpcomingClass[]>("/classes/upcoming")
export const getUpcomingExams = () => publicGetOrNull<UpcomingExam[]>("/exams/upcoming")
export const getCategories = () => publicGetOrNull<PublicCategory[]>("/categories")

export async function getSiteContact(): Promise<SiteContact> {
  return toSiteContact(await getSettings())
}

export function getLatestPosts(limit: number) {
  return publicGetOrNull<PostSummary[]>("/posts", { limit })
}

export async function getAllPosts(maxPages = 10): Promise<PostSummary[] | null> {
  const posts: PostSummary[] = []
  for (let page = 1; page <= maxPages; page += 1) {
    let body: { data: PostSummary[]; meta: PageMeta }
    try {
      body = await publicFetch<{ data: PostSummary[]; meta: PageMeta }>("/posts", { page, limit: 50 })
    } catch (error) {
      console.error("[public-api] /posts", error)
      return page === 1 ? null : posts
    }
    posts.push(...body.data)
    if (body.data.length === 0 || posts.length >= body.meta.total) break
  }
  return posts
}

// 404 → null (trang gọi notFound); lỗi khác ném ra để ISR giữ bản đã cache
export async function getPost(slug: string): Promise<PostDetail | null> {
  try {
    return await publicGet<PostDetail>(`/posts/${encodeURIComponent(slug)}`)
  } catch (error) {
    if (error instanceof PublicApiError && error.status === 404) return null
    throw error
  }
}

export async function getRelatedPosts(
  categorySlug: string | null,
  excludeSlug: string
): Promise<PostSummary[]> {
  const list = await publicGetOrNull<PostSummary[]>(
    "/posts",
    categorySlug ? { category: categorySlug, limit: 5 } : { limit: 5 }
  )
  return (list ?? []).filter((post) => post.slug !== excludeSlug).slice(0, 4)
}
