import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { MediaPicker } from "@/components/admin/media/media-picker"
import { makeQueryClient } from "@/components/providers/query-provider"
import type { MediaItem } from "@/lib/admin/types"
import { setAccessToken } from "@/lib/api/session"
import { jsonResponse, mockFetch } from "@/test/fetch-mock"

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))
vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}))

let auth: Record<string, unknown>
vi.mock("@/components/admin/auth-provider", () => ({ useAuth: () => auth }))

// jsdom không đọc được metadata video (thẻ video không bao giờ loadedmetadata)
vi.mock("@/lib/admin/media-upload", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin/media-upload")>()),
  readVideoMeta: vi.fn(async () => ({ width: 640, height: 360, duration: 3 })),
}))

function media(overrides: Partial<MediaItem> = {}): MediaItem {
  return {
    id: "m1",
    kind: "image",
    url: "/uploads/2026/10/a.webp",
    mimeType: "image/webp",
    size: 1000,
    width: 800,
    height: 600,
    alt: "Sân tập lái",
    refsCount: 0,
    createdAt: "2026-10-05T09:00:00+07:00",
    ...overrides,
  }
}

const mediaPage = {
  data: [
    media(),
    media({
      id: "m2",
      kind: "video",
      url: "/uploads/2026/10/b.mp4",
      mimeType: "video/mp4",
      alt: "Video sa hình",
      duration: 75,
    }),
  ],
  meta: { page: 1, limit: 24, total: 2 },
}

function mediaUrls(fn: ReturnType<typeof mockFetch>["fn"]): URL[] {
  return fn.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === "/api/v1/media")
}

function renderPicker(props: Partial<Parameters<typeof MediaPicker>[0]> = {}) {
  const client = makeQueryClient()
  client.setDefaultOptions({ queries: { retry: false } })
  const onSelect = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <MediaPicker
        open
        onOpenChange={onOpenChange}
        onSelect={onSelect}
        {...props}
      />
    </QueryClientProvider>
  )
  return { onSelect, onOpenChange, client }
}

function fileOf(name: string, type: string, size: number): File {
  const file = new File(["x"], name, { type })
  Object.defineProperty(file, "size", { value: size })
  return file
}

beforeEach(() => {
  toastSuccess.mockClear()
  toastError.mockClear()
  setAccessToken("t1")
  auth = { permissions: ["media.read", "media.upload"] }
})

describe("MediaPicker", () => {
  it("kho media: hiện tile theo kind, limit 24; chọn → onSelect và đóng", async () => {
    const { fn } = mockFetch({
      "GET /media": () =>
        jsonResponse(200, { ...mediaPage, data: [mediaPage.data[0]] }),
    })
    const { onSelect, onOpenChange } = renderPicker({ kind: "image" })

    const tile = await screen.findByRole("button", { name: /Sân tập lái/ })
    const [url] = mediaUrls(fn)
    expect(Object.fromEntries(url!.searchParams)).toEqual({
      kind: "image",
      page: "1",
      limit: "24",
    })
    // Picker chỉ nhận ảnh thì không có ô lọc loại
    expect(screen.queryByRole("combobox", { name: "Loại" })).toBeNull()

    await userEvent.click(tile)
    expect(onSelect).toHaveBeenCalledWith(mediaPage.data[0])
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("video hiện thời lượng m:ss", async () => {
    mockFetch({ "GET /media": () => jsonResponse(200, mediaPage) })
    renderPicker()
    expect(
      await screen.findByRole("button", { name: /Video sa hình/ })
    ).toHaveTextContent("1:15")
  })

  it("tìm 'san' → gọi lại /media với q=san", async () => {
    const { fn } = mockFetch({
      "GET /media": () => jsonResponse(200, mediaPage),
    })
    renderPicker()
    await screen.findByRole("button", { name: /Sân tập lái/ })

    await userEvent.type(
      screen.getByRole("searchbox", { name: /Tìm theo mô tả/ }),
      "san"
    )
    await waitFor(() =>
      expect(
        mediaUrls(fn).some((url) => url.searchParams.get("q") === "san")
      ).toBe(true)
    )
    const last = mediaUrls(fn).at(-1)!
    expect(Object.fromEntries(last.searchParams)).toEqual({
      q: "san",
      page: "1",
      limit: "24",
    })
  })

  it("không có quyền media.upload → không có tab Tải lên", async () => {
    auth = { permissions: ["media.read"] }
    mockFetch({ "GET /media": () => jsonResponse(200, mediaPage) })
    renderPicker()
    await screen.findByRole("button", { name: /Sân tập lái/ })
    expect(screen.queryByRole("tab", { name: "Tải lên" })).toBeNull()
    expect(screen.queryByLabelText(/Chọn file/)).toBeNull()
  })

  it("có quyền: tải ảnh lên → POST /media FormData → chọn luôn media mới", async () => {
    const created = media({ id: "m7", alt: "Ảnh mới" })
    const { calls } = mockFetch({
      "GET /media": () => jsonResponse(200, mediaPage),
      "POST /media": () => jsonResponse(201, { data: created }),
    })
    const { onSelect, onOpenChange, client } = renderPicker({ kind: "image" })
    const invalidate = vi.spyOn(client, "invalidateQueries")

    await userEvent.click(screen.getByRole("tab", { name: "Tải lên" }))
    await userEvent.upload(
      screen.getByLabelText(/Chọn file/),
      fileOf("xe.png", "image/png", 2000)
    )
    await userEvent.type(screen.getByLabelText("Mô tả"), "Ảnh mới")
    await userEvent.click(
      screen.getByRole("button", { name: "Tải lên và chọn" })
    )

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(created))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["media"] })
    const post = calls.find((call) => call.key === "POST /media")!
    const body = post.init.body as FormData
    expect((body.get("file") as File).name).toBe("xe.png")
    expect(body.get("alt")).toBe("Ảnh mới")
  })

  it("tải video: hiện tiến trình, xong thì chọn luôn video mới", async () => {
    let xhr: {
      upload: { onprogress: ((event: unknown) => void) | null }
      onload: (() => void) | null
      status: number
    } | null = null
    vi.stubGlobal(
      "XMLHttpRequest",
      class {
        upload = { onprogress: null }
        onload = null
        onerror = null
        onabort = null
        status = 0
        constructor() {
          // eslint-disable-next-line @typescript-eslint/no-this-alias
          xhr = this
        }
        open() {}
        setRequestHeader() {}
        send() {}
        abort() {}
      }
    )
    const created = media({ id: "m8", kind: "video", alt: "Clip" })
    const { calls } = mockFetch({
      "GET /media": () => jsonResponse(200, mediaPage),
      "POST /media/video-uploads": () =>
        jsonResponse(201, {
          data: {
            uploadId: "tmp/0b0c3c3e-7d1a-4e7e-9a7b-6a2a4f1c2d3e.mp4",
            uploadUrl: "/api/v1/media/direct/abc.sig",
            headers: { "Content-Type": "video/mp4" },
            expiresAt: "2026-10-05T02:15:00.000Z",
          },
        }),
      "POST /media/video-uploads/complete": () =>
        jsonResponse(201, { data: created }),
    })
    const { onSelect } = renderPicker({ kind: "video" })

    await userEvent.click(screen.getByRole("tab", { name: "Tải lên" }))
    await userEvent.upload(
      screen.getByLabelText(/Chọn file/),
      fileOf("clip.mp4", "video/mp4", 4000)
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Tải lên và chọn" })
    )
    await waitFor(() => expect(xhr).not.toBeNull())
    act(() =>
      xhr!.upload.onprogress!({
        lengthComputable: true,
        loaded: 1000,
        total: 4000,
      })
    )
    expect(
      screen.getByRole("progressbar", { name: "Tiến trình tải lên" })
    ).toHaveAttribute("aria-valuenow", "25")
    expect(screen.getByRole("button", { name: "Huỷ tải lên" })).toBeVisible()

    xhr!.status = 200
    act(() => xhr!.onload!())
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(created))
    const complete = calls.find(
      (call) => call.key === "POST /media/video-uploads/complete"
    )!
    expect(JSON.parse(String(complete.init.body))).toEqual({
      uploadId: "tmp/0b0c3c3e-7d1a-4e7e-9a7b-6a2a4f1c2d3e.mp4",
      width: 640,
      height: 360,
      duration: 3,
    })
  })

  it("file quá lớn → báo lỗi, không gọi API tải lên", async () => {
    const { calls } = mockFetch({
      "GET /media": () => jsonResponse(200, mediaPage),
    })
    renderPicker()

    await userEvent.click(screen.getByRole("tab", { name: "Tải lên" }))
    await userEvent.upload(
      screen.getByLabelText(/Chọn file/),
      fileOf("lon.jpg", "image/jpeg", 6 * 1024 * 1024)
    )

    expect(await screen.findByRole("alert")).toHaveTextContent(/5 MB/)
    expect(
      screen.getByRole("button", { name: "Tải lên và chọn" })
    ).toBeDisabled()
    expect(calls.every((call) => call.key === "GET /media")).toBe(true)
  })
})
