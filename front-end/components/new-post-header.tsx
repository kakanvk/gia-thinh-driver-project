"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

export const NEW_POST_SUBMIT_EVENT = "new-post:submit"

export function NewPostHeader() {
  const router = useRouter()

  return (
    <div className="sticky top-[64px] z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-5 sm:px-8">
        <Link
          href="/thao-luan"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-bold text-primary hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Về diễn đàn
        </Link>
        <h1 className="hidden min-w-0 flex-1 truncate text-lg font-extrabold text-navy sm:block">
          Đăng bài chia sẻ
        </h1>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/thao-luan")}
            className="inline-flex h-11 items-center rounded-md border border-border px-5 text-sm font-bold text-navy hover:border-primary/40 hover:text-primary"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(NEW_POST_SUBMIT_EVENT))}
            className="inline-flex h-11 items-center rounded-md bg-primary px-6 text-sm font-bold text-white hover:bg-primary/90"
          >
            Đăng bài
          </button>
        </div>
      </div>
    </div>
  )
}
