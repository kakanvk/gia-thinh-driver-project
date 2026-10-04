"use client"

import { useEffect, useId, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ImageOff, Upload } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"

import { FilterBar, FilterSelect } from "@/components/admin/filter-bar"
import { MediaTile } from "@/components/admin/media/media-tile"
import { Pagination } from "@/components/admin/pagination"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MEDIA_PAGE_SIZE, useMediaList } from "@/lib/admin/media"
import {
  acceptOf,
  readVideoMeta,
  STORAGE_UPLOAD_ERROR,
  uploadImage,
  uploadVideo,
  validateMediaFile,
} from "@/lib/admin/media-upload"
import type { MediaItem, MediaKind } from "@/lib/admin/types"
import { useCan } from "@/lib/admin/use-can"
import { errorMessage } from "@/lib/api/errors"

type PickerKind = MediaKind | "all"

const KIND_ITEMS = [
  { value: "image", label: "Ảnh" },
  { value: "video", label: "Video" },
]

function defaultTitle(kind: PickerKind): string {
  if (kind === "image") return "Chọn ảnh"
  if (kind === "video") return "Chọn video"
  return "Chọn media"
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function LibraryPanel({
  kind,
  onChoose,
}: {
  kind: PickerKind
  onChoose: (media: MediaItem) => void
}) {
  const [q, setQ] = useState("")
  const [kindFilter, setKindFilter] = useState("")
  const [page, setPage] = useState(1)
  const listKind =
    kind === "all" ? (kindFilter as MediaKind | "") || undefined : kind
  const { data, isPending, isError, refetch } = useMediaList({
    q: q || undefined,
    kind: listKind,
    page,
  })

  let content: React.ReactNode
  if (isPending) {
    content = (
      <div
        role="status"
        aria-busy="true"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <span className="sr-only">Đang tải…</span>
        {Array.from({ length: 8 }, (_, i) => (
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
      <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
        <ImageOff aria-hidden="true" className="size-8" />
        <p>
          {q || kindFilter
            ? "Không tìm thấy media phù hợp"
            : "Kho media chưa có file nào"}
        </p>
      </div>
    )
  } else {
    content = (
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {data.data.map((media) => (
          <li key={media.id}>
            <MediaTile media={media} onClick={() => onChoose(media)} />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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
        {kind === "all" ? (
          <FilterSelect
            label="Loại"
            items={KIND_ITEMS}
            value={kindFilter}
            onChange={(next) => {
              setKindFilter(next)
              setPage(1)
            }}
          />
        ) : null}
      </FilterBar>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{content}</div>
      {data ? (
        <Pagination
          page={page}
          limit={MEDIA_PAGE_SIZE}
          total={data.meta.total}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  )
}

function UploadPanel({
  kind,
  onUploaded,
  onBusyChange,
}: {
  kind: PickerKind
  onUploaded: (media: MediaItem) => void
  onBusyChange: (busy: boolean) => void
}) {
  const queryClient = useQueryClient()
  const inputId = useId()
  const altId = useId()
  const [file, setFile] = useState<File | null>(null)
  const [alt, setAlt] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)
  const onBusyChangeRef = useRef(onBusyChange)

  useEffect(() => {
    onBusyChangeRef.current = onBusyChange
  }, [onBusyChange])

  // Rời picker giữa chừng → huỷ lượt tải đang chạy
  useEffect(
    () => () => {
      controllerRef.current?.abort()
      onBusyChangeRef.current(false)
    },
    []
  )

  function pick(next: File | undefined) {
    if (!next) return
    setFile(next)
    setError(validateMediaFile(next, kind))
    setProgress(null)
  }

  async function submit() {
    if (!file || error || uploading) return
    const controller = new AbortController()
    controllerRef.current = controller
    const description = alt.trim() || undefined
    const isVideo = file.type.startsWith("video/")
    setUploading(true)
    setProgress(isVideo ? 0 : null)
    onBusyChange(true)
    let media: MediaItem | null = null
    try {
      if (isVideo) {
        const meta = await readVideoMeta(file)
        media = await uploadVideo(file, {
          alt: description,
          onProgress: setProgress,
          signal: controller.signal,
          meta,
        })
      } else {
        media = await uploadImage(file, description)
      }
    } catch (err) {
      setProgress(null)
      if (err instanceof DOMException && err.name === "AbortError") {
        toast.info("Đã huỷ tải lên")
      } else {
        setError(
          err instanceof Error && err.message === STORAGE_UPLOAD_ERROR
            ? err.message
            : errorMessage(err)
        )
      }
    } finally {
      controllerRef.current = null
      setUploading(false)
      onBusyChange(false)
    }
    if (!media) return
    void queryClient.invalidateQueries({ queryKey: ["media"] })
    toast.success("Đã tải lên kho media")
    onUploaded(media)
  }

  const percent = progress === null ? null : Math.round(progress * 100)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div
          onDragOver={(event) => {
            event.preventDefault()
            if (!uploading) setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            if (!uploading) pick(event.dataTransfer.files[0])
          }}
          className={cn(
            "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border px-4 py-10 text-center",
            dragging && "border-primary bg-primary/5"
          )}
        >
          <Upload aria-hidden="true" className="size-8 text-muted-foreground" />
          <p className="text-muted-foreground">Kéo thả file vào đây hoặc</p>
          <label
            htmlFor={inputId}
            className={cn(
              "inline-flex h-8 cursor-pointer items-center rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted",
              uploading && "pointer-events-none opacity-50"
            )}
          >
            Chọn file
          </label>
          <input
            id={inputId}
            type="file"
            accept={acceptOf(kind)}
            disabled={uploading}
            className="sr-only"
            onChange={(event) => {
              pick(event.target.files?.[0])
              event.target.value = ""
            }}
          />
          <p className="text-xs text-muted-foreground">
            {kind !== "video" ? "Ảnh JPG, PNG, WebP tối đa 5 MB" : null}
            {kind === "all" ? " · " : null}
            {kind !== "image" ? "Video MP4, WebM tối đa 500 MB" : null}
          </p>
        </div>

        {file ? (
          <p className="truncate text-[13px]">
            <span className="font-medium">{file.name}</span>{" "}
            <span className="text-muted-foreground">
              ({formatSize(file.size)})
            </span>
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="text-[13px] text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={altId} className="text-[13px]">
            Mô tả
          </Label>
          <Input
            id={altId}
            value={alt}
            maxLength={255}
            disabled={uploading}
            placeholder="VD: Học viên thực hành sa hình"
            onChange={(event) => setAlt(event.target.value)}
          />
        </div>

        {percent !== null ? (
          <div className="flex flex-col gap-1.5">
            <div
              role="progressbar"
              aria-label="Tiến trình tải lên"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="h-2 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full bg-primary transition-[width]"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              Đang tải lên… {percent}%
            </p>
          </div>
        ) : null}
      </div>
      <SheetFooter className="flex-row justify-end border-t border-border/70">
        {uploading && progress !== null ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => controllerRef.current?.abort()}
          >
            Huỷ tải lên
          </Button>
        ) : null}
        <Button
          type="button"
          disabled={!file || !!error || uploading}
          onClick={submit}
        >
          {uploading ? "Đang tải lên…" : "Tải lên và chọn"}
        </Button>
      </SheetFooter>
    </div>
  )
}

export function MediaPicker({
  open,
  onOpenChange,
  kind = "all",
  onSelect,
  title,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind?: PickerKind
  onSelect: (media: MediaItem) => void
  title?: string
}) {
  const canUpload = useCan("media.upload")
  const [busy, setBusy] = useState(false)

  function choose(media: MediaItem) {
    onSelect(media)
    onOpenChange(false)
  }

  return (
    // Đang tải lên: X, Escape và bấm nền không đóng được (dùng nút Huỷ tải lên)
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) return
        onOpenChange(next)
      }}
    >
      <SheetContent
        showCloseButton={!busy}
        className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-3xl"
      >
        <SheetHeader className="border-b border-border/70 pr-12">
          <SheetTitle className="font-semibold text-navy">
            {title ?? defaultTitle(kind)}
          </SheetTitle>
          <SheetDescription>
            {canUpload
              ? "Chọn từ kho media hoặc tải file mới lên"
              : "Chọn từ kho media"}
          </SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="library" className="min-h-0 flex-1 gap-0">
          <TabsList className="mx-4 mt-3">
            <TabsTrigger value="library">Kho media</TabsTrigger>
            {canUpload ? (
              <TabsTrigger value="upload">Tải lên</TabsTrigger>
            ) : null}
          </TabsList>
          <TabsContent value="library" className="flex min-h-0 flex-col">
            <LibraryPanel kind={kind} onChoose={choose} />
          </TabsContent>
          {canUpload ? (
            // Giữ panel khi đổi tab để lượt tải đang chạy không bị huỷ
            <TabsContent
              value="upload"
              keepMounted
              className="flex min-h-0 flex-col"
            >
              <UploadPanel
                kind={kind}
                onUploaded={choose}
                onBusyChange={setBusy}
              />
            </TabsContent>
          ) : null}
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
