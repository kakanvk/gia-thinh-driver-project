"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight, Clapperboard, Images, LayoutGrid, Play, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type MediaItem = {
  src: string
  kind: "image" | "video"
}

const tabs = [
  { key: "all", label: "Tất cả", icon: LayoutGrid },
  { key: "image", label: "Hình ảnh", icon: Images },
  { key: "video", label: "Video", icon: Clapperboard },
] as const

type TabKey = (typeof tabs)[number]["key"]

export function MediaGallery({ items }: { items: MediaItem[] }) {
  const [tab, setTab] = useState<TabKey>("all")
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const visible = useMemo(
    () => (tab === "all" ? items : items.filter((item) => item.kind === tab)),
    [items, tab]
  )
  const counts = useMemo(
    () => ({
      all: items.length,
      image: items.filter((item) => item.kind === "image").length,
      video: items.filter((item) => item.kind === "video").length,
    }),
    [items]
  )

  const close = useCallback(() => setActiveIndex(null), [])
  const step = useCallback(
    (delta: 1 | -1) =>
      setActiveIndex((current) =>
        current === null ? current : (current + delta + visible.length) % visible.length
      ),
    [visible.length]
  )

  useEffect(() => {
    if (activeIndex === null) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close()
      if (event.key === "ArrowRight") step(1)
      if (event.key === "ArrowLeft") step(-1)
    }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [activeIndex, close, step])

  const active = activeIndex !== null ? visible[activeIndex] : null

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTab(t.key)
                setActiveIndex(null)
              }}
              aria-pressed={active}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-bold transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-primary/20 bg-background text-muted-foreground hover:border-primary/40 hover:text-primary"
              )}
            >
              <Icon aria-hidden="true" className="size-4" />
              {t.label}
              <Badge variant={active ? "secondary" : "outline"} className="tabular-nums">
                {counts[t.key]}
              </Badge>
            </button>
          )
        })}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {visible.map((item, index) =>
            item.kind === "image" ? (
              <button
                key={item.src}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Xem ảnh ${index + 1}`}
                className="group relative block aspect-square cursor-zoom-in overflow-hidden rounded-md border border-border bg-mist"
              >
                <Image
                  src={item.src}
                  alt="Tư liệu hoạt động của trung tâm Gia Thịnh"
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  loading="lazy"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
              </button>
            ) : (
              <button
                key={item.src}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Xem video ${index + 1}`}
                className="group relative block aspect-square cursor-pointer overflow-hidden rounded-md border border-border bg-navy"
              >
                <video
                  src={item.src}
                  preload="metadata"
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
                <span className="absolute inset-0 grid place-items-center bg-black/40 transition-colors group-hover:bg-black/20">
                  <span className="grid size-12 place-items-center rounded-full bg-white/90 text-navy">
                    <Play aria-hidden="true" className="size-5 fill-current" />
                  </span>
                </span>
              </button>
            )
          )}
        </div>

      {active ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Trình xem tư liệu"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 sm:p-8"
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Đóng trình xem"
            className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X aria-hidden="true" className="size-5" />
          </button>

          <div
            className="relative max-h-full w-full max-w-5xl overflow-hidden rounded-md border border-white/20 bg-black"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Tư liệu trước"
              className="absolute top-1/2 left-2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white hover:bg-black/75 sm:left-4 sm:size-12"
            >
              <ChevronLeft aria-hidden="true" className="size-6" />
            </button>
            {active.kind === "image" ? (
              <span className="relative block h-[70vh] w-full sm:h-[80vh]">
                <Image
                  src={active.src}
                  alt="Tư liệu hoạt động của trung tâm Gia Thịnh"
                  fill
                  sizes="100vw"
                  className="object-contain"
                />
              </span>
            ) : (
              <video
                key={active.src}
                src={active.src}
                controls
                autoPlay
                playsInline
                className="max-h-[80vh] w-full"
              />
            )}
            <p className="bg-black px-4 py-2.5 text-center text-xs text-white/70 tabular-nums">
              {(activeIndex ?? 0) + 1} / {visible.length} ·{" "}
              {active.kind === "image" ? "Hình ảnh" : "Video"}
            </p>

            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Tư liệu sau"
              className="absolute top-1/2 right-2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white hover:bg-black/75 sm:right-4 sm:size-12"
            >
              <ChevronRight aria-hidden="true" className="size-6" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
