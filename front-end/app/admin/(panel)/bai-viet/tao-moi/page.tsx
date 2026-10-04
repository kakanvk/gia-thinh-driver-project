import type { Metadata } from "next"

import { PostCreateForm } from "@/components/admin/post-create-form"

export const metadata: Metadata = {
  title: "Tạo bài viết",
}

export default function CreatePostPage() {
  return <PostCreateForm />
}
