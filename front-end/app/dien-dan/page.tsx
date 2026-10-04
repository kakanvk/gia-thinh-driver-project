import type { Metadata } from "next"

import { getSiteContact } from "@/lib/api/public"
import { newsPosts } from "@/lib/news"
import { NewsExplorer } from "@/components/news-explorer"
import { SiteHeader } from "@/components/site-header"

export const metadata: Metadata = {
  title: "Tin tức | Trường lái Gia Thịnh",
  description:
    "Kinh nghiệm thi, tư vấn chọn bằng, học phí minh bạch và thông báo khai giảng từ Gia Thịnh.",
}

export default async function NewsPage() {
  const contact = await getSiteContact()
  return (
    <main className="min-h-svh bg-background">
      <SiteHeader />
      <NewsExplorer posts={newsPosts} contact={contact} />
    </main>
  )
}
