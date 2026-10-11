"use client"

import Image from "next/image"
import { Play } from "lucide-react"
import { cn } from "cn"

import { formatDuration, mediaLabel } from "@/lib/admin/media"
import type { MediaItem } from "@/lib/admin/types"

export function MediaTile({
  media,
  selected = false,
  onClick,
}: {
  media: MediaItem
  selected?: boolean
  onClick?: () => void
}) {
  const label = mediaLabel(media)
  const body =
    media.kind === "video" ? (
      <div className="flex size-full flex-col items-center justify-center gap-1.5 bg-neutral-900 p-2 text-white">
        <Play aria-hidden="true" className="size-8 fill-white/90" />
        {media.duration !== undefined ? (
          <span className="rounded bg-black/60 px-1.5 text-xs tabular-nums">
            {formatDuration(media.duration)}
          </span>
        ) : null}
        <span className="line-clamp-2 text-center text-xs text-white/80">
          {label}
        </span>
      </div>
    ) : (
      <Image
        src={media.url}
        alt={media.alt ?? ""}
        fill
        unoptimized
        sizes="(min-width: 640px) 12rem, 50vw"
        className="object-cover"
      />
    )

  const className = cn(
    "relative aspect-square w-full overflow-hidden rounded-lg border border-border/70 bg-muted",
    selected && "ring-2 ring-primary ring-offset-2"
  )

  if (!onClick) return <div className={className}>{body}</div>
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        className,
        "cursor-pointer transition hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      )}
    >
      {body}
    </button>
  )
}
