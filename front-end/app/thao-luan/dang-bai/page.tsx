import type { Metadata } from "next"

import { NewPostHeader } from "@/components/new-post-header"
import { PlatePostEditor } from "@/components/plate-post-editor"
import { ScrollReveal } from "@/components/scroll-reveal"
import { SiteHeader } from "@/components/site-header"

export const metadata: Metadata = {
  title: "Đăng bài viết | Diễn đàn Gia Thịnh",
  description: "Chia sẻ kinh nghiệm học và thi lái xe cùng cộng đồng học viên Gia Thịnh.",
}

export default function NewPostPage() {
  return (
    <main className="min-h-svh bg-background">
      <SiteHeader />
      <NewPostHeader />
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        <ScrollReveal delay={0.08}>
          <PlatePostEditor />
        </ScrollReveal>
      </div>
    </main>
  )
}
