import type { Metadata } from "next"

import { PostEditorForm } from "@/components/admin/posts/post-editor-form"

export const metadata: Metadata = {
  title: "Sửa bài viết",
}

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <PostEditorForm postId={id} />
}
