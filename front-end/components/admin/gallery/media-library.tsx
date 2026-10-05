"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ImageOff, Trash2, Upload } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { EntitySheet } from "@/components/admin/entity-sheet"
import { FilterBar, FilterSelect } from "@/components/admin/filter-bar"
import { FormField } from "@/components/admin/form-field"
import { MediaPicker } from "@/components/admin/media/media-picker"
import { MediaTile } from "@/components/admin/media/media-tile"
import { Pagination } from "@/components/admin/pagination"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatDateTime } from "@/lib/admin/datetime"
import {
  formatDuration,
  formatFileSize,
  MEDIA_PAGE_SIZE,
  useMediaList,
} from "@/lib/admin/media"
import type { MediaItem, MediaKind } from "@/lib/admin/types"
import { useCan } from "@/lib/admin/use-can"
import { apiData, apiFetch } from "@/lib/api/client"
import { ApiError, errorMessage } from "@/lib/api/errors"

const KIND_ITEMS = [
  { value: "image", label: "Ảnh" },
  { value: "video", label: "Video" },
]

export type MediaUsage = {
  entity: "post" | "gallery"
  entityId: string
  label: string
}

// details của 409 MEDIA_IN_USE: "<entity>:<entityId>:<label>" (label có thể chứa ":")
export function parseMediaUsage(message: string): MediaUsage | null {
  const match = /^(post|gallery):([^:]+):([\s\S]*)$/.exec(message)
  if (!match) return null
  return {
    entity: match[1] as MediaUsage["entity"],
    entityId: match[2]!,
    label: match[3]!,
  }
}

function UsageDialog({
  usages,
  onOpenChange,
}: {
  usages: MediaUsage[] | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <AlertDialog open={usages !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Media đang được dùng</AlertDialogTitle>
          <AlertDialogDescription>
            Gỡ media khỏi những nơi dưới đây rồi xoá lại.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="flex flex-col gap-2 text-[13px]">
          {(usages ?? []).map((usage) => (
            <li
              key={`${usage.entity}:${usage.entityId}`}
              className="rounded-md border border-border/70 px-3 py-2"
            >
              {usage.entity === "post" ? (
                <>
                  <span className="text-muted-foreground">Bài viết: </span>
                  <Link
                    href={`/admin/bai-viet/${usage.entityId}`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {usage.label || "(không có tiêu đề)"}
                  </Link>
                </>
              ) : (
                <>
                  <span className="text-muted-foreground">
                    Thư viện website:{" "}
                  </span>
                  <span className="font-medium">
                    {usage.label || "mục chưa có chú thích"}
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel>Đóng</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function Preview({ media }: { media: MediaItem }) {
  if (media.kind === "video") {
    return (
      <video
        src={media.url}
        controls
        preload="metadata"
        playsInline
        className="aspect-video w-full rounded-md bg-neutral-900"
      />
    )
  }
  return (
    <div className="relative aspect-4/3 w-full overflow-hidden rounded-md border border-border/70 bg-muted">
      <Image
        src={media.url}
        alt={media.alt ?? ""}
        fill
        unoptimized
        sizes="28rem"
        className="object-contain"
      />
    </div>
  )
}

function MediaSheet({
  media,
  canEdit,
  onOpenChange,
  onDelete,
}: {
  media: MediaItem
  canEdit: boolean
  onOpenChange: (open: boolean) => void
  onDelete: () => void
}) {
  const queryClient = useQueryClient()
  const [alt, setAlt] = useState(media.alt ?? "")

  const save = useMutation({
    mutationFn: (next: string | null) =>
      apiData<MediaItem>(`/media/${media.id}`, {
        method: "PATCH",
        body: { alt: next },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["media"] })
      toast.success("Đã lưu mô tả")
      onOpenChange(false)
    },
    meta: { silent: true },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const facts = [
    ["Loại", media.kind === "video" ? "Video" : "Ảnh"],
    ["Dung lượng", formatFileSize(media.size)],
    media.width && media.height
      ? ["Kích thước", `${media.width} × ${media.height}`]
      : null,
    media.duration !== undefined
      ? ["Thời lượng", formatDuration(media.duration)]
      : null,
    ["Số nơi dùng", String(media.refsCount)],
    ["Tải lên", formatDateTime(media.createdAt)],
  ].filter((fact): fact is string[] => fact !== null)

  const body = (
    <>
      <Preview media={media} />
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
        {facts.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {canEdit ? (
        <FormField id="media-alt" label="Mô tả">
          <Input
            value={alt}
            maxLength={255}
            placeholder="VD: Học viên thực hành sa hình"
            onChange={(event) => setAlt(event.target.value)}
          />
        </FormField>
      ) : (
        <p className="text-[13px]">
          <span className="text-muted-foreground">Mô tả: </span>
          {media.alt || "Chưa có"}
        </p>
      )}
    </>
  )

  return (
    <EntitySheet
      open
      onOpenChange={onOpenChange}
      title={media.kind === "video" ? "Chi tiết video" : "Chi tiết ảnh"}
      submitLabel="Lưu mô tả"
      submitting={save.isPending}
      onSubmit={
        canEdit
          ? (event) => {
              event.preventDefault()
              save.mutate(alt.trim() || null)
            }
          : undefined
      }
      footer={
        canEdit ? (
          <Button
            type="button"
            variant="outline"
            className="mr-auto text-destructive hover:text-destructive"
            disabled={save.isPending}
            onClick={onDelete}
          >
            <Trash2 aria-hidden="true" />
            Xoá media
          </Button>
        ) : undefined
      }
    >
      {body}
    </EntitySheet>
  )
}

export function MediaLibrary() {
  const queryClient = useQueryClient()
  const canUpload = useCan("media.upload")
  const [q, setQ] = useState("")
  const [kind, setKind] = useState("")
  const [page, setPage] = useState(1)
  const [viewing, setViewing] = useState<MediaItem | null>(null)
  const [deleting, setDeleting] = useState<MediaItem | null>(null)
  const [usages, setUsages] = useState<MediaUsage[] | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)

  const { data, isPending, isError, refetch } = useMediaList({
    q: q || undefined,
    kind: (kind as MediaKind | "") || undefined,
    page,
  })

  const remove = useMutation({
    mutationFn: (media: MediaItem) =>
      apiFetch<void>(`/media/${media.id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["media"] })
      toast.success("Đã xoá media")
      setDeleting(null)
      setViewing(null)
    },
    meta: { silent: true },
    onError: (error) => {
      setDeleting(null)
      if (error instanceof ApiError && error.code === "MEDIA_IN_USE") {
        setUsages(
          error.details
            .map((detail) => parseMediaUsage(detail.message))
            .filter((usage): usage is MediaUsage => usage !== null)
        )
        // Số nơi dùng hiện trên lưới có thể đã cũ
        void queryClient.invalidateQueries({ queryKey: ["media"] })
        return
      }
      toast.error(errorMessage(error))
    },
  })

  let content: React.ReactNode
  if (isPending) {
    content = (
      <div
        role="status"
        aria-busy="true"
        className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6"
      >
        <span className="sr-only">Đang tải…</span>
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="aspect-square animate-pulse rounded-lg bg-muted"
          />
        ))}
      </div>
    )
  } else if (isError) {
    content = (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-muted-foreground">Không tải được kho media</p>
        <Button type="button" variant="outline" onClick={() => refetch()}>
          Thử lại
        </Button>
      </div>
    )
  } else if (data.data.length === 0) {
    content = (
      <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
        <ImageOff aria-hidden="true" className="size-8" />
        <p>
          {q || kind
            ? "Không tìm thấy media phù hợp"
            : "Kho media chưa có file nào"}
        </p>
      </div>
    )
  } else {
    content = (
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        {data.data.map((media) => (
          <li key={media.id} className="flex flex-col gap-1.5">
            <MediaTile media={media} onClick={() => setViewing(media)} />
            <p className="truncate text-xs text-muted-foreground">
              {media.refsCount > 0
                ? `Đang dùng ở ${media.refsCount} nơi`
                : "Chưa dùng"}
            </p>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <section className="overflow-hidden rounded-lg border border-border/70 bg-background">
      <FilterBar
        search={{
          value: q,
          placeholder: "Tìm theo mô tả",
          onChange: (next) => {
            setQ(next)
            setPage(1)
          },
        }}
      >
        <FilterSelect
          label="Loại"
          items={KIND_ITEMS}
          value={kind}
          onChange={(next) => {
            setKind(next)
            setPage(1)
          }}
        />
        {canUpload ? (
          <Button
            type="button"
            className="sm:ml-auto"
            onClick={() => setUploadOpen(true)}
          >
            <Upload aria-hidden="true" />
            Tải lên
          </Button>
        ) : null}
      </FilterBar>
      <div className="p-4">{content}</div>
      {data ? (
        <Pagination
          page={page}
          limit={MEDIA_PAGE_SIZE}
          total={data.meta.total}
          onPageChange={setPage}
        />
      ) : null}

      {viewing ? (
        <MediaSheet
          key={viewing.id}
          media={viewing}
          canEdit={canUpload}
          onOpenChange={(open) => {
            if (!open) setViewing(null)
          }}
          onDelete={() => setDeleting(viewing)}
        />
      ) : null}
      {canUpload ? (
        <MediaPicker
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          title="Tải lên kho media"
          defaultTab="upload"
          onSelect={(media) => setViewing(media)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title="Xoá media?"
        description="File sẽ bị xoá vĩnh viễn khỏi kho lưu trữ. Media đang được bài viết hoặc thư viện dùng sẽ không xoá được."
        confirmLabel="Xoá"
        destructive
        pending={remove.isPending}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting)
        }}
      />
      <UsageDialog
        usages={usages}
        onOpenChange={(open) => {
          if (!open) setUsages(null)
        }}
      />
    </section>
  )
}
