import type { Metadata } from "next"

import { newsPosts } from "@/lib/news"
import { NewsExplorer } from "@/components/news-explorer"
import { StickyHeader } from "@/components/sticky-header"

export const metadata: Metadata = {
  title: "Tin tức | Trường lái Gia Thịnh",
  description:
    "Kinh nghiệm thi, tư vấn chọn bằng, học phí minh bạch và thông báo khai giảng từ Gia Thịnh.",
}

export default function NewsPage() {
  return (
    <main className="min-h-svh bg-background">
      <StickyHeader />
      <NewsExplorer posts={newsPosts} />
    </main>
  )
}
