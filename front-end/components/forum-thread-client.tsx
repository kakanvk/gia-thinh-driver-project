"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { ImagePlus, ThumbsUp, X } from "lucide-react"

import type { ForumReply } from "@/lib/forum"
import { VerifiedBadge } from "@/components/verified-badge"

function readFilesAsDataUrls(files: FileList | File[]): Promise<string[]> {
  const list = Array.from(files)
  return Promise.all(
    list.map(
      (file) =>
        new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.readAsDataURL(file)
        })
    )
  )
}

export function ForumThreadClient({
  initialReplies,
}: {
  initialReplies: ForumReply[]
}) {
  const [replies, setReplies] = useState<ForumReply[]>(initialReplies)
  const [content, setContent] = useState("")
  const [previews, setPreviews] = useState<string[]>([])
  const [liked, setLiked] = useState<Set<number>>(new Set())
  const [lightbox, setLightbox] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!lightbox) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(null)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [lightbox])

  async function handleFiles(files: FileList | null) {
    if (!files) return
    const urls = await readFilesAsDataUrls(files)
    setPreviews((prev) => [...prev, ...urls].slice(0, 4))
  }

  function submit() {
    if (!content.trim() && previews.length === 0) return
    setReplies((prev) => [
      ...prev,
      {
        author: "Bạn",
        time: "Vừa xong",
        likes: 0,
        content: content.trim() || "(đính kèm ảnh)",
        images: previews,
      },
    ])
    setContent("")
    setPreviews([])
  }

  function toggleLike(index: number) {
    setLiked((prev) => {
      const next = new Set(prev)
      const has = next.has(index)
      if (has) next.delete(index)
      else next.add(index)
      return next
    })
    setReplies((prev) =>
      prev.map((reply, i) =>
        i === index
          ? { ...reply, likes: reply.likes + (liked.has(index) ? -1 : 1) }
          : reply
      )
    )
  }

  return (
    <div>
      <div className="mt-4 flex flex-col gap-4">
        {replies.map((reply, index) => (
          <div
            key={`${reply.author}-${index}`}
            className="rounded-md border border-border bg-card p-5 sm:p-6"
          >
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-mist text-sm font-extrabold text-navy">
                {reply.author.charAt(0)}
              </span>
              <div>
                <p className="flex items-center gap-1.5 text-sm font-extrabold text-navy">
                  {reply.author}
                  {reply.role ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                      <VerifiedBadge className="size-3" />
                      {reply.role}
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">{reply.time}</p>
              </div>
              <button
                type="button"
                onClick={() => toggleLike(index)}
                className={`ml-auto inline-flex h-11 items-center gap-1.5 rounded-full border px-3 text-xs tabular-nums transition-colors sm:h-auto sm:px-2.5 sm:py-1 ${
                  liked.has(index)
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
                }`}
              >
                <ThumbsUp aria-hidden="true" className="size-3.5" />
                {reply.likes}
              </button>
            </div>
            <p className="mt-4 leading-7 text-foreground/85">{reply.content}</p>
            {reply.images && reply.images.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {reply.images.map((src, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setLightbox(src)}
                    aria-label={`Xem ảnh đính kèm ${i + 1}`}
                    className="relative block size-24 overflow-hidden rounded-md border border-border transition-colors hover:border-primary/40"
                  >
                    <Image
                      src={src}
                      alt={`Ảnh đính kèm ${i + 1} của ${reply.author}`}
                      fill
                      sizes="96px"
                      loading="lazy"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-md border border-border bg-card p-5 sm:p-6">
        <p className="font-extrabold text-navy">Viết trả lời của bạn</p>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          placeholder="Chia sẻ kinh nghiệm thực tế, ghi rõ hạng bằng và sân thi…"
          className="mt-3 w-full resize-y rounded-md border border-border bg-background px-4 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
        />
        {previews.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {previews.map((src, i) => (
              <span key={i} className="relative block aspect-square overflow-hidden rounded-md border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Ảnh đính kèm ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  aria-label="Xóa ảnh"
                  onClick={() => setPreviews((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 grid size-8 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80 sm:size-6"
                >
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              handleFiles(e.target.files)
              e.target.value = ""
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-4 text-sm font-bold text-navy hover:border-primary/40 hover:text-primary"
          >
            <ImagePlus aria-hidden="true" className="size-4" />
            Thêm ảnh (tối đa 4)
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!content.trim() && previews.length === 0}
            className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-bold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Gửi trả lời
          </button>
          <span className="text-xs text-muted-foreground">Ảnh tải lên xem trước ngay, không cần đăng nhập demo.</span>
        </div>
      </div>

      {lightbox ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh đính kèm"
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
        >
          <button
            type="button"
            aria-label="Đóng ảnh"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 grid size-11 place-items-center rounded-full bg-white/15 text-white hover:bg-white/30"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Ảnh đính kèm phóng to"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-full rounded-md object-contain"
          />
        </div>
      ) : null}
    </div>
  )
}
