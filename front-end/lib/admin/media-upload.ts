import type { MediaItem, MediaKind } from "@/lib/admin/types"
import { apiData } from "@/lib/api/client"

// Cùng giới hạn với backend (upload.middleware, MAX_VIDEO_BYTES mặc định)
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]
export const VIDEO_TYPES = ["video/mp4", "video/webm"]
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024

export const STORAGE_UPLOAD_ERROR =
  "Không tải được lên kho lưu trữ (kiểm tra cấu hình CORS của bucket)"

export type VideoMeta = { width?: number; height?: number; duration?: number }

type VideoUploadTicket = {
  uploadId: string
  uploadUrl: string
  headers: Record<string, string>
  expiresAt: string
}

export function acceptOf(kind: MediaKind | "all" = "all"): string {
  if (kind === "image") return IMAGE_TYPES.join(",")
  if (kind === "video") return VIDEO_TYPES.join(",")
  return [...IMAGE_TYPES, ...VIDEO_TYPES].join(",")
}

// Kiểm loại/kích thước trước khi gửi; null = hợp lệ
export function validateMediaFile(
  file: File,
  kind: MediaKind | "all" = "all"
): string | null {
  const isImage = IMAGE_TYPES.includes(file.type)
  const isVideo = VIDEO_TYPES.includes(file.type)
  if (kind === "image" && !isImage) return "Chỉ nhận ảnh JPG, PNG hoặc WebP"
  if (kind === "video" && !isVideo) return "Chỉ nhận video MP4 hoặc WebM"
  if (!isImage && !isVideo)
    return "Chỉ nhận ảnh JPG, PNG, WebP hoặc video MP4, WebM"
  if (isImage && file.size > MAX_IMAGE_BYTES) return "Ảnh tối đa 5 MB"
  if (isVideo && file.size > MAX_VIDEO_BYTES) return "Video tối đa 500 MB"
  return null
}

export function uploadImage(file: File, alt?: string): Promise<MediaItem> {
  const body = new FormData()
  body.append("file", file)
  if (alt) body.append("alt", alt)
  return apiData<MediaItem>("/media", { method: "POST", body })
}

function abortError(): DOMException {
  return new DOMException("Đã huỷ tải lên", "AbortError")
}

// PUT thẳng lên kho lưu trữ bằng XHR để có tiến trình (fetch chưa có upload progress)
function putToStorage(
  ticket: VideoUploadTicket,
  file: File,
  onProgress?: (ratio: number) => void,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const onAbort = () => xhr.abort()
    const settle = (fn: () => void) => {
      signal?.removeEventListener("abort", onAbort)
      fn()
    }
    xhr.open("PUT", ticket.uploadUrl)
    for (const [name, value] of Object.entries(ticket.headers))
      xhr.setRequestHeader(name, value)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0)
        onProgress?.(event.loaded / event.total)
    }
    xhr.onload = () =>
      settle(() => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(1)
          resolve()
        } else reject(new Error(STORAGE_UPLOAD_ERROR))
      })
    xhr.onerror = () => settle(() => reject(new Error(STORAGE_UPLOAD_ERROR)))
    xhr.onabort = () => settle(() => reject(abortError()))
    signal?.addEventListener("abort", onAbort, { once: true })
    xhr.send(file)
  })
}

// Video: xin signed URL → PUT thẳng lên kho → báo backend hoàn tất
export async function uploadVideo(
  file: File,
  opts: {
    alt?: string
    onProgress?: (ratio: number) => void
    signal?: AbortSignal
    meta?: VideoMeta
  } = {}
): Promise<MediaItem> {
  const { alt, onProgress, signal, meta } = opts
  if (signal?.aborted) throw abortError()
  const ticket = await apiData<VideoUploadTicket>("/media/video-uploads", {
    method: "POST",
    body: {
      filename: file.name.slice(-200) || "video",
      contentType: file.type,
      size: file.size,
      alt: alt || undefined,
    },
    signal,
  })
  if (signal?.aborted) throw abortError()
  await putToStorage(ticket, file, onProgress, signal)
  return apiData<MediaItem>("/media/video-uploads/complete", {
    method: "POST",
    body: { uploadId: ticket.uploadId, alt: alt || undefined, ...meta },
  })
}

// Đọc kích thước/thời lượng bằng thẻ video ẩn; không đọc được trong 5 s → {}
export function readVideoMeta(
  file: File,
  timeoutMs = 5000
): Promise<VideoMeta> {
  return new Promise((resolve) => {
    let src: string
    try {
      src = URL.createObjectURL(file)
    } catch {
      resolve({})
      return
    }
    const video = document.createElement("video")
    let done = false
    const finish = (meta: VideoMeta) => {
      if (done) return
      done = true
      clearTimeout(timer)
      video.onloadedmetadata = null
      video.onerror = null
      video.removeAttribute("src")
      URL.revokeObjectURL(src)
      resolve(meta)
    }
    const timer = setTimeout(() => finish({}), timeoutMs)
    video.preload = "metadata"
    video.muted = true
    video.onloadedmetadata = () => {
      const { videoWidth, videoHeight, duration } = video
      finish({
        width: videoWidth > 0 ? videoWidth : undefined,
        height: videoHeight > 0 ? videoHeight : undefined,
        duration:
          Number.isFinite(duration) && duration >= 0 ? duration : undefined,
      })
    }
    video.onerror = () => finish({})
    video.src = src
  })
}
