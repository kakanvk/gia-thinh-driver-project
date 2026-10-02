"use client"

import Image from "next/image"
import { useCallback, useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"

import { cn } from "@/lib/utils"

export type TimelineImage = {
  src: string
  alt: string
}

export function TimelineGallery({
  images,
  className,
  zoom = false,
}: {
  images: TimelineImage[]
  className?: string
  zoom?: boolean
}) {
  const [index, setIndex] = useState<number | null>(null)

  const close = useCallback(() => setIndex(null), [])
  const step = useCallback(
    (dir: 1 | -1) =>
      setIndex((current) =>
        current === null
          ? current
          : (current + dir + images.length) % images.length
      ),
    [images.length]
  )

  useEffect(() => {
    if (index === null) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close()
      if (e.key === "ArrowRight") step(1)
      if (e.key === "ArrowLeft") step(-1)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [index, close, step])

  if (images.length === 0) return null

  return (
    <>
      <div className={cn("group grid grid-cols-2 gap-2", className)}>
        {images.map((image, i) => (
          <button
            key={image.src}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Xem ảnh: ${image.alt}`}
            className="relative block aspect-[4/3] cursor-zoom-in overflow-hidden rounded-md border border-border"
          >
            <Image
              src={image.src}
              alt={i === 0 ? image.alt : ""}
              aria-hidden={i === 0 ? undefined : true}
              fill
              sizes="(max-width: 768px) 50vw, 280px"
              loading="lazy"
              className={cn(
                "object-cover",
                zoom && "transition-transform duration-500 group-hover:scale-[1.03]"
              )}
            />
          </button>
        ))}
      </div>

      {index !== null ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh timeline"
          onClick={close}
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
        >
          <button
            type="button"
            aria-label="Đóng ảnh"
            onClick={close}
            className="absolute top-4 right-4 grid size-9 place-items-center rounded-full bg-white/15 text-white hover:bg-white/30"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
          {images.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Ảnh trước"
                onClick={(e) => {
                  e.stopPropagation()
                  step(-1)
                }}
                className="absolute left-3 grid size-10 place-items-center rounded-full bg-white/15 text-white hover:bg-white/30 sm:left-6"
              >
                <ChevronLeft aria-hidden="true" className="size-5" />
              </button>
              <button
                type="button"
                aria-label="Ảnh sau"
                onClick={(e) => {
                  e.stopPropagation()
                  step(1)
                }}
                className="absolute right-3 grid size-10 place-items-center rounded-full bg-white/15 text-white hover:bg-white/30 sm:right-6"
              >
                <ChevronRight aria-hidden="true" className="size-5" />
              </button>
            </>
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[index].src}
            alt={images[index].alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[80vh] max-w-full rounded-md object-contain"
          />
          {images.length > 1 ? (
            <p className="absolute bottom-4 text-sm font-bold text-white/80 tabular-nums">
              {index + 1} / {images.length}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
