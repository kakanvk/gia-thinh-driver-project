import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  readVideoMeta,
  uploadImage,
  uploadVideo,
  validateMediaFile,
} from "@/lib/admin/media-upload"
import type { MediaItem } from "@/lib/admin/types"
import { setAccessToken } from "@/lib/api/session"
import { jsonResponse, mockFetch } from "@/test/fetch-mock"

// XMLHttpRequest giả: test tự quyết định lúc nào báo tiến trình / xong / lỗi
class FakeXhr {
  static instances: FakeXhr[] = []
  method = ""
  url = ""
  headers: Record<string, string> = {}
  body: unknown = null
  status = 0
  aborted = false
  upload: { onprogress: ((event: ProgressEvent) => void) | null } = {
    onprogress: null,
  }
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null

  constructor() {
    FakeXhr.instances.push(this)
  }
  open(method: string, url: string) {
    this.method = method
    this.url = url
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value
  }
  send(body: unknown) {
    this.body = body
  }
  abort() {
    this.aborted = true
    this.onabort?.()
  }
  progress(loaded: number, total: number) {
    this.upload.onprogress?.({
      lengthComputable: true,
      loaded,
      total,
    } as ProgressEvent)
  }
  respond(status: number) {
    this.status = status
    this.onload?.()
  }
}

const video: MediaItem = {
  id: "m9",
  kind: "video",
  url: "https://cdn.example/2026/10/abc.mp4",
  mimeType: "video/mp4",
  size: 2048,
  width: 1280,
  height: 720,
  duration: 12.5,
  alt: "Sa hình",
  refsCount: 0,
  createdAt: "2026-10-05T09:00:00+07:00",
}

const ticket = {
  uploadId: "tmp/0b0c3c3e-7d1a-4e7e-9a7b-6a2a4f1c2d3e.mp4",
  uploadUrl: "https://storage.example/bucket/tmp/abc.mp4?X-Goog-Signature=1",
  headers: {
    "Content-Type": "video/mp4",
    "x-goog-content-length-range": "0,524288000",
  },
  expiresAt: "2026-10-05T02:15:00.000Z",
  maxBytes: 524288000,
}

function fileOf(name: string, type: string, size: number): File {
  const file = new File(["x"], name, { type })
  Object.defineProperty(file, "size", { value: size })
  return file
}

const MB = 1024 * 1024

// Chờ đến khi XHR được tạo (sau khi init trả về)
async function nextXhr(): Promise<FakeXhr> {
  await vi.waitFor(() => expect(FakeXhr.instances).toHaveLength(1))
  return FakeXhr.instances[0]!
}

beforeEach(() => {
  FakeXhr.instances = []
  vi.stubGlobal("XMLHttpRequest", FakeXhr)
  setAccessToken("t1")
})

afterEach(() => {
  vi.useRealTimers()
})

describe("uploadVideo", () => {
  it("init → PUT kèm headers và tiến trình → complete, trả media", async () => {
    const { calls } = mockFetch({
      "POST /media/video-uploads": () => jsonResponse(201, { data: ticket }),
      "POST /media/video-uploads/complete": () =>
        jsonResponse(201, { data: video }),
    })
    const file = fileOf("sa-hinh.mp4", "video/mp4", 2048)
    const onProgress = vi.fn()

    const promise = uploadVideo(file, {
      alt: "Sa hình",
      onProgress,
      meta: { width: 1280, height: 720, duration: 12.5 },
    })
    const xhr = await nextXhr()

    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      filename: "sa-hinh.mp4",
      contentType: "video/mp4",
      size: 2048,
      alt: "Sa hình",
    })
    expect(xhr.method).toBe("PUT")
    expect(xhr.url).toBe(ticket.uploadUrl)
    expect(xhr.headers).toEqual(ticket.headers)
    expect(xhr.body).toBe(file)
    // Chưa PUT xong thì chưa gọi complete
    expect(calls).toHaveLength(1)

    xhr.progress(1024, 2048)
    expect(onProgress).toHaveBeenCalledWith(0.5)
    xhr.respond(200)

    await expect(promise).resolves.toEqual(video)
    expect(calls.map((call) => call.key)).toEqual([
      "POST /media/video-uploads",
      "POST /media/video-uploads/complete",
    ])
    expect(JSON.parse(String(calls[1]!.init.body))).toEqual({
      uploadId: ticket.uploadId,
      alt: "Sa hình",
      width: 1280,
      height: 720,
      duration: 12.5,
    })
  })

  it("PUT trả 403 → báo lỗi CORS, không gọi complete", async () => {
    const { calls } = mockFetch({
      "POST /media/video-uploads": () => jsonResponse(201, { data: ticket }),
    })
    const promise = uploadVideo(fileOf("a.mp4", "video/mp4", 10), {})
    const xhr = await nextXhr()
    xhr.respond(403)

    await expect(promise).rejects.toThrow(/CORS/)
    expect(calls).toHaveLength(1)
  })

  it("lỗi mạng khi PUT → báo lỗi CORS", async () => {
    mockFetch({
      "POST /media/video-uploads": () => jsonResponse(201, { data: ticket }),
    })
    const promise = uploadVideo(fileOf("a.webm", "video/webm", 10), {})
    const xhr = await nextXhr()
    xhr.onerror?.()

    await expect(promise).rejects.toThrow(
      "Không tải được lên kho lưu trữ (kiểm tra cấu hình CORS của bucket)"
    )
  })

  it("huỷ giữa chừng → AbortError, huỷ XHR, không gọi complete", async () => {
    const { calls } = mockFetch({
      "POST /media/video-uploads": () => jsonResponse(201, { data: ticket }),
    })
    const controller = new AbortController()
    const promise = uploadVideo(fileOf("a.mp4", "video/mp4", 10), {
      signal: controller.signal,
    })
    const xhr = await nextXhr()
    xhr.progress(3, 10)
    controller.abort()

    await expect(promise).rejects.toMatchObject({ name: "AbortError" })
    expect(xhr.aborted).toBe(true)
    expect(calls.map((call) => call.key)).toEqual(["POST /media/video-uploads"])
  })

  it("đã huỷ trước khi bắt đầu → không gọi API", async () => {
    const { calls } = mockFetch({})
    const controller = new AbortController()
    controller.abort()
    await expect(
      uploadVideo(fileOf("a.mp4", "video/mp4", 10), {
        signal: controller.signal,
      })
    ).rejects.toMatchObject({ name: "AbortError" })
    expect(calls).toHaveLength(0)
    expect(FakeXhr.instances).toHaveLength(0)
  })
})

describe("uploadImage", () => {
  it("gửi FormData file + alt tới POST /media", async () => {
    const image = { ...video, id: "m1", kind: "image", mimeType: "image/webp" }
    const { calls } = mockFetch({
      "POST /media": () => jsonResponse(201, { data: image }),
    })
    const file = fileOf("xe.png", "image/png", 100)

    await expect(uploadImage(file, "Xe tập lái")).resolves.toEqual(image)
    const body = calls[0]!.init.body as FormData
    expect(body).toBeInstanceOf(FormData)
    expect((body.get("file") as File).name).toBe("xe.png")
    expect(body.get("alt")).toBe("Xe tập lái")
  })

  it("không có alt → không gửi trường alt", async () => {
    const { calls } = mockFetch({
      "POST /media": () => jsonResponse(201, { data: video }),
    })
    await uploadImage(fileOf("xe.png", "image/png", 100))
    expect((calls[0]!.init.body as FormData).has("alt")).toBe(false)
  })
})

describe("validateMediaFile", () => {
  it("chặn sai loại / quá lớn, nhận file hợp lệ", () => {
    expect(validateMediaFile(fileOf("a.jpg", "image/jpeg", 6 * MB))).toMatch(
      /5 MB/
    )
    expect(validateMediaFile(fileOf("a.pdf", "application/pdf", 1000))).toMatch(
      /Chỉ nhận/
    )
    expect(validateMediaFile(fileOf("a.mp4", "video/mp4", 600 * MB))).toMatch(
      /500 MB/
    )
    expect(validateMediaFile(fileOf("a.webp", "image/webp", 5 * MB))).toBeNull()
    expect(validateMediaFile(fileOf("a.png", "image/png", 1000))).toBeNull()
    expect(
      validateMediaFile(fileOf("a.webm", "video/webm", 500 * MB))
    ).toBeNull()
  })

  it("giới hạn theo loại media được phép", () => {
    expect(
      validateMediaFile(fileOf("a.mp4", "video/mp4", 1000), "image")
    ).toMatch(/Chỉ nhận ảnh/)
    expect(
      validateMediaFile(fileOf("a.png", "image/png", 1000), "video")
    ).toMatch(/Chỉ nhận video/)
    expect(
      validateMediaFile(fileOf("a.png", "image/png", 1000), "image")
    ).toBeNull()
  })
})

describe("readVideoMeta", () => {
  it("không đọc được metadata trong 5 giây → {} và thu hồi object URL", async () => {
    vi.useFakeTimers()
    const revoke = vi.fn()
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:video"),
      revokeObjectURL: revoke,
    })
    const promise = readVideoMeta(fileOf("a.mp4", "video/mp4", 10))
    await vi.advanceTimersByTimeAsync(5000)
    await expect(promise).resolves.toEqual({})
    expect(revoke).toHaveBeenCalledWith("blob:video")
  })

  it("loadedmetadata → trả kích thước và thời lượng", async () => {
    const revoke = vi.fn()
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:video"),
      revokeObjectURL: revoke,
    })
    const createElement = document.createElement.bind(document)
    let element: HTMLVideoElement | undefined
    vi.spyOn(document, "createElement").mockImplementation(
      (tag: string, options?: ElementCreationOptions) => {
        const node = createElement(tag, options)
        if (tag === "video") {
          element = node as HTMLVideoElement
          Object.defineProperty(node, "videoWidth", { value: 1920 })
          Object.defineProperty(node, "videoHeight", { value: 1080 })
          Object.defineProperty(node, "duration", { value: 65.25 })
        }
        return node
      }
    )
    const promise = readVideoMeta(fileOf("a.mp4", "video/mp4", 10))
    element!.dispatchEvent(new Event("loadedmetadata"))
    await expect(promise).resolves.toEqual({
      width: 1920,
      height: 1080,
      duration: 65.25,
    })
    expect(revoke).toHaveBeenCalledWith("blob:video")
  })
})
