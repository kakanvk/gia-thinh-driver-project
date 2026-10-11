import type { Metadata } from "next"

import { getAllPosts, getCategories, getSiteContact } from "@/lib/api/public"
import { toNewsPost } from "@/lib/news"
import { NewsExplorer } from "@/components/news-explorer"
import { SiteHeader } from "@/components/site-header"

export const metadata: Metadata = {
  title: "Tin tức | Trường lái Gia Thịnh",
  description:
    "Kinh nghiệm thi, tư vấn chọn bằng, học phí minh bạch và thông báo khai giảng từ Gia Thịnh.",
}

export const revalidate = 300

export default async function NewsPage() {
  const [posts, categories, contact] = await Promise.all([getAllPosts(), getCategories(), getSiteContact()])
  return (
    <main className="min-h-svh bg-background">
      <SiteHeader />
      <NewsExplorer
        posts={posts ? posts.map(toNewsPost) : null}
        categories={categories ?? []}
        contact={{
          hotline: contact.hotline,
          telHref: contact.telHref,
          zaloHref: contact.zaloHref,
        }}
      />
    </main>
  )
}
