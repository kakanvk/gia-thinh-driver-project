import type { Metadata } from "next"

import { PostEditorForm } from "@/components/admin/posts/post-editor-form"

export const metadata: Metadata = {
  title: "Viết bài mới",
}

export default function CreatePostPage() {
  return <PostEditorForm />
}
