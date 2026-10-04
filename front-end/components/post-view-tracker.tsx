"use client"

import { useEffect } from "react"

import { apiFetch } from "@/lib/api/client"

// Đếm lượt xem một lần mỗi phiên trình duyệt; lỗi không ảnh hưởng trang
export function PostViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `gt-viewed:${slug}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, "1")
    } catch {
      // sessionStorage bị chặn: vẫn đếm
    }
    apiFetch(`/public/posts/${encodeURIComponent(slug)}/view`, { method: "POST" }).catch(() => undefined)
  }, [slug])
  return null
}
