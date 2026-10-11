import type { Metadata } from "next"
import { Suspense } from "react"

import { PostList } from "@/components/admin/posts/post-list"

export const metadata: Metadata = {
  title: "Bài viết",
}

export default function PostsPage() {
  return (
    <main id="admin-content" className="p-4">
      <Suspense>
        <PostList />
      </Suspense>
    </main>
  )
}
