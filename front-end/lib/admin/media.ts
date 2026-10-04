"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"

import type { MediaItem, MediaKind, Page } from "@/lib/admin/types"
import { apiFetch } from "@/lib/api/client"

export type { MediaItem, MediaKind } from "@/lib/admin/types"

export const MEDIA_PAGE_SIZE = 24

export type MediaListParams = { q?: string; kind?: MediaKind; page: number }

export function useMediaList(params: MediaListParams) {
  return useQuery({
    queryKey: ["media", params],
    queryFn: ({ signal }) =>
      apiFetch<Page<MediaItem>>("/media", {
        query: { ...params, limit: MEDIA_PAGE_SIZE },
        signal,
      }),
    placeholderData: keepPreviousData,
  })
}

// Thời lượng video dạng m:ss
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(total / 60)
  return `${minutes}:${String(total % 60).padStart(2, "0")}`
}

export function mediaLabel(media: MediaItem): string {
  return media.alt || (media.kind === "video" ? "Video" : "Ảnh")
}
