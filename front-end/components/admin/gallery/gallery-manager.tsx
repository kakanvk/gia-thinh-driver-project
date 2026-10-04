"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  ImageOff,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { EntitySheet } from "@/components/admin/entity-sheet"
import { FormField } from "@/components/admin/form-field"
import { MediaPicker } from "@/components/admin/media/media-picker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { formatDuration } from "@/lib/admin/media"
import type { GalleryItem } from "@/lib/admin/types"
import { apiData, apiFetch } from "@/lib/api/client"
import { errorMessage } from "@/lib/api/errors"

const GALLERY_KEY = ["gallery"]

type GalleryPatch = {
  caption?: string | null
  posterMediaId?: string | null
  visible?: boolean
}

function itemLabel(item: GalleryItem): string {
  return item.caption || item.media?.alt || "mục thư viện"
}

function Thumb({ item }: { item: GalleryItem }) {
  const media = item.media
  const src = media?.kind === "video" ? item.poster?.url : media?.url
  return (
    <div className="relative aspect-4/3 w-28 shrink-0 overflow-hidden rounded-md border border-border/70 bg-neutral-900 sm:w-32">
      {src ? (
        <Image
          src={src}
          alt={media?.alt ?? ""}
          fill
          unoptimized
          sizes="8rem"
          className="object-cover"
        />
      ) : !media ? (
        <div className="grid size-full place-items-center bg-muted text-muted-foreground">
          <ImageOff aria-hidden="true" className="size-6" />
        </div>
      ) : null}
      {media?.kind === "video" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-white">
          <Play aria-hidden="true" className="size-6 fill-white/90" />
          {media.duration !== null ? (
            <span className="rounded bg-black/60 px-1.5 text-[11px] tabular-nums">
              {formatDuration(media.duration)}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function ItemSheet({
  item,
  onOpenChange,
  onSaved,
}: {
  item: GalleryItem
  onOpenChange: (open: boolean) => void
  onSaved: (item: GalleryItem) => void
}) {
  const isVideo = item.media?.kind === "video"
  const [caption, setCaption] = useState(item.caption ?? "")
  const [poster, setPoster] = useState(
    item.posterMediaId && item.poster
      ? { id: item.posterMediaId, url: item.poster.url, alt: item.poster.alt }
      : null
  )
  const [pickerOpen, setPickerOpen] = useState(false)

  const save = useMutation({
    mutationFn: (body: GalleryPatch) =>
      apiData<GalleryItem>(`/gallery/${item.id}`, { method: "PATCH", body }),
    onSuccess: (saved) => {
      onSaved(saved)
      toast.success("Đã lưu mục thư viện")
      onOpenChange(false)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body: GalleryPatch = {}
    const nextCaption = caption.trim() || null
    if (nextCaption !== item.caption) body.caption = nextCaption
    const nextPoster = poster?.id ?? null
    if (isVideo && nextPoster !== item.posterMediaId) {
      body.posterMediaId = nextPoster
    }
    if (Object.keys(body).length === 0) {
      onOpenChange(false)
      return
    }
    save.mutate(body)
  }

  return (
    <EntitySheet
      open
      onOpenChange={onOpenChange}
      title="Sửa mục thư viện"
      description={
        isVideo
          ? "Chú thích và ảnh bìa hiện trên trang Thư viện"
          : "Chú thích hiện trên trang Thư viện"
      }
      submitting={save.isPending}
      onSubmit={submit}
    >
      <FormField id="gallery-caption" label="Chú thích">
        <Textarea
          value={caption}
          maxLength={300}
          rows={3}
          placeholder="VD: Học viên thực hành sa hình"
          onChange={(event) => setCaption(event.target.value)}
        />
      </FormField>
      {isVideo ? (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-medium">Ảnh bìa</p>
          {poster ? (
            <div className="relative aspect-video w-full overflow-hidden rounded-md border border-border/70 bg-muted">
              <Image
                src={poster.url}
                alt={poster.alt ?? ""}
                fill
                unoptimized
                sizes="28rem"
                className="object-cover"
              />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Chưa có ảnh bìa, trình duyệt sẽ hiện khung đầu của video
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPickerOpen(true)}
            >
              {poster ? "Đổi ảnh bìa" : "Chọn ảnh bìa"}
            </Button>
            {poster ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPoster(null)}
              >
                Bỏ ảnh bìa
              </Button>
            ) : null}
          </div>
          {/* Lồng trong sheet (cây React) để Base UI coi là hộp thoại con */}
          <MediaPicker
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            kind="image"
            title="Chọn ảnh bìa"
            onSelect={(media) =>
              setPoster({
                id: media.id,
                url: media.url,
                alt: media.alt ?? null,
              })
            }
          />
        </div>
      ) : null}
    </EntitySheet>
  )
}

export function GalleryManager() {
  const queryClient = useQueryClient()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editing, setEditing] = useState<GalleryItem | null>(null)
  const [deleting, setDeleting] = useState<GalleryItem | null>(null)

  const gallery = useQuery({
    queryKey: GALLERY_KEY,
    queryFn: ({ signal }) => apiData<GalleryItem[]>("/gallery", { signal }),
  })

  // Thay đổi mục thư viện làm đổi số nơi dùng (refsCount) của media
  function refresh() {
    void queryClient.invalidateQueries({ queryKey: GALLERY_KEY })
    void queryClient.invalidateQueries({ queryKey: ["media"] })
  }

  function replaceItem(saved: GalleryItem) {
    queryClient.setQueryData<GalleryItem[]>(GALLERY_KEY, (old) =>
      old?.map((entry) => (entry.id === saved.id ? saved : entry))
    )
  }

  const add = useMutation({
    mutationFn: (mediaId: string) =>
      apiData<GalleryItem>("/gallery", { method: "POST", body: { mediaId } }),
    onSuccess: () => {
      refresh()
      toast.success("Đã thêm vào thư viện")
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const reorder = useMutation({
    mutationFn: (ids: string[]) =>
      apiData<GalleryItem[]>("/gallery/reorder", {
        method: "PATCH",
        body: { ids },
      }),
    onSuccess: (items) => queryClient.setQueryData(GALLERY_KEY, items),
    onError: (error) => {
      toast.error(errorMessage(error))
      void queryClient.invalidateQueries({ queryKey: GALLERY_KEY })
    },
  })

  const toggle = useMutation({
    mutationFn: (item: GalleryItem) =>
      apiData<GalleryItem>(`/gallery/${item.id}`, {
        method: "PATCH",
        body: { visible: !item.visible },
      }),
    onSuccess: (saved) => {
      replaceItem(saved)
      toast.success(
        saved.visible ? "Đã hiện trên website" : "Đã ẩn khỏi website"
      )
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const remove = useMutation({
    mutationFn: (item: GalleryItem) =>
      apiFetch<void>(`/gallery/${item.id}`, { method: "DELETE" }),
    onSuccess: () => {
      refresh()
      toast.success("Đã xoá khỏi thư viện")
      setDeleting(null)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  function move(items: GalleryItem[], index: number, delta: number) {
    const ids = items.map((item) => item.id)
    const target = index + delta
    ;[ids[index], ids[target]] = [ids[target]!, ids[index]!]
    reorder.mutate(ids)
  }

  let content: React.ReactNode
  if (gallery.isPending) {
    content = (
      <div role="status" aria-busy="true" className="flex flex-col gap-3 p-4">
        <span className="sr-only">Đang tải…</span>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    )
  } else if (gallery.isError) {
    content = (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-muted-foreground">Không tải được thư viện</p>
        <Button
          type="button"
          variant="outline"
          onClick={() => gallery.refetch()}
        >
          Thử lại
        </Button>
      </div>
    )
  } else if (gallery.data.length === 0) {
    content = (
      <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
        <ImageOff aria-hidden="true" className="size-8" />
        <p>Thư viện website chưa có mục nào</p>
      </div>
    )
  } else {
    const items = gallery.data
    content = (
      <ul className="divide-y divide-border/70">
        {items.map((item, index) => {
          const label = itemLabel(item)
          return (
            <li
              key={item.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Thumb item={item} />
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary">
                      {item.media?.kind === "video" ? "Video" : "Ảnh"}
                    </Badge>
                    {!item.visible ? (
                      <Badge variant="outline">Đang ẩn</Badge>
                    ) : null}
                    {!item.media ? (
                      <Badge variant="destructive">Media không còn</Badge>
                    ) : null}
                  </div>
                  <p
                    className={
                      item.caption
                        ? "line-clamp-2 font-medium"
                        : "text-muted-foreground italic"
                    }
                  >
                    {item.caption || "Chưa có chú thích"}
                  </p>
                </div>
              </div>
              <div
                role="group"
                aria-label={`Thao tác cho ${label}`}
                className="flex shrink-0 items-center gap-1 self-end sm:self-auto"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Đưa lên"
                  title="Đưa lên"
                  disabled={index === 0 || reorder.isPending}
                  onClick={() => move(items, index, -1)}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Đưa xuống"
                  title="Đưa xuống"
                  disabled={index === items.length - 1 || reorder.isPending}
                  onClick={() => move(items, index, 1)}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={
                    item.visible ? "Ẩn khỏi website" : "Hiện trên website"
                  }
                  title={item.visible ? "Ẩn khỏi website" : "Hiện trên website"}
                  disabled={
                    toggle.isPending && toggle.variables?.id === item.id
                  }
                  onClick={() => toggle.mutate(item)}
                >
                  {item.visible ? (
                    <EyeOff aria-hidden="true" />
                  ) : (
                    <Eye aria-hidden="true" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Sửa"
                  title="Sửa chú thích, ảnh bìa"
                  onClick={() => setEditing(item)}
                >
                  <Pencil aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Xoá khỏi thư viện"
                  title="Xoá khỏi thư viện"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleting(item)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <section className="overflow-hidden rounded-lg border border-border/70 bg-background">
      <div className="flex flex-col gap-3 border-b border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground">
          Ảnh và video hiện ở trang Thư viện của website, theo thứ tự dưới đây
        </p>
        <Button
          type="button"
          disabled={add.isPending}
          onClick={() => setPickerOpen(true)}
        >
          <Plus aria-hidden="true" />
          Thêm vào thư viện
        </Button>
      </div>
      {content}

      <MediaPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Thêm vào thư viện"
        onSelect={(media) => add.mutate(media.id)}
      />
      {editing ? (
        <ItemSheet
          key={editing.id}
          item={editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          onSaved={(saved) => {
            replaceItem(saved)
            void queryClient.invalidateQueries({ queryKey: ["media"] })
          }}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title="Xoá khỏi thư viện?"
        description={
          deleting
            ? `"${itemLabel(deleting)}" sẽ không còn hiện trên website. File vẫn được giữ trong kho media.`
            : undefined
        }
        confirmLabel="Xoá"
        destructive
        pending={remove.isPending}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting)
        }}
      />
    </section>
  )
}
