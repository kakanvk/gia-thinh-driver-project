import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AdminShell } from "@/components/admin/admin-shell"
import { GalleryManager } from "@/components/admin/gallery/gallery-manager"
import { MediaLibrary } from "@/components/admin/gallery/media-library"
import { makeQueryClient } from "@/components/providers/query-provider"
import type { GalleryItem, MediaItem } from "@/lib/admin/types"
import { setAccessToken } from "@/lib/api/session"
import { jsonResponse, mockFetch } from "@/test/fetch-mock"

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))
vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError, info: vi.fn() },
}))

let auth: Record<string, unknown>
vi.mock("@/components/admin/auth-provider", () => ({ useAuth: () => auth }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/thu-vien",
}))

// MediaPicker giả: khi mở hiện nút chọn sẵn media theo kind được yêu cầu
vi.mock("@/components/admin/media/media-picker", () => ({
  MediaPicker: ({
    open,
    kind = "all",
    onSelect,
    onOpenChange,
  }: {
    open: boolean
    kind?: string
    onSelect: (media: MediaItem) => void
    onOpenChange: (open: boolean) => void
  }) =>
    open ? (
      <button
        type="button"
        onClick={() => {
          onSelect(
            kind === "image" ? posterMedia : media({ id: "m9", alt: "Mới" })
          )
          onOpenChange(false)
        }}
      >
        {`Chọn giả (${kind})`}
      </button>
    ) : null,
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

const posterMedia = media({ id: "p1", alt: "Ảnh bìa", url: "/uploads/p.webp" })

function item(
  id: string,
  overrides: Partial<GalleryItem> = {},
  kind: "image" | "video" = "image"
): GalleryItem {
  return {
    id,
    mediaId: `media-${id}`,
    posterMediaId: null,
    caption: `Chú thích ${id}`,
    order: 1,
    visible: true,
    media: {
      id: `media-${id}`,
      url: `/uploads/${id}.${kind === "video" ? "mp4" : "webp"}`,
      kind,
      alt: null,
      width: 800,
      height: 600,
      duration: kind === "video" ? 75 : null,
    },
    poster: null,
    createdAt: "2026-10-05T09:00:00+07:00",
    updatedAt: "2026-10-05T09:00:00+07:00",
    ...overrides,
  }
}

const items = [
  item("g1", { order: 1 }),
  item("g2", { order: 2, caption: null, visible: false }, "video"),
  item("g3", { order: 3 }),
]

function renderWithClient(ui: React.ReactElement) {
  const client = makeQueryClient()
  client.setDefaultOptions({ queries: { retry: false } })
  const invalidate = vi.spyOn(client, "invalidateQueries")
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
  return { client, invalidate }
}

function bodyOf(calls: { key: string; init: RequestInit }[], key: string) {
  const call = calls.find((entry) => entry.key === key)
  return call ? JSON.parse(String(call.init.body)) : undefined
}

beforeEach(() => {
  toastSuccess.mockClear()
  toastError.mockClear()
  setAccessToken("t1")
  auth = {
    permissions: ["media.read", "media.upload", "gallery.manage"],
  }
})

describe("GalleryManager", () => {
  it("hiện mục theo thứ tự: nhãn loại, chú thích, đang ẩn", async () => {
    mockFetch({ "GET /gallery": () => jsonResponse(200, { data: items }) })
    renderWithClient(<GalleryManager />)

    const rows = await screen.findAllByRole("listitem")
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent("Ảnh")
    expect(rows[0]).toHaveTextContent("Chú thích g1")
    expect(rows[1]).toHaveTextContent("Video")
    expect(rows[1]).toHaveTextContent("Chưa có chú thích")
    expect(rows[1]).toHaveTextContent("Đang ẩn")
    expect(rows[0]).not.toHaveTextContent("Đang ẩn")
    expect(rows[2]).toHaveTextContent("Chú thích g3")
  })

  it("thêm vào thư viện → MediaPicker → POST /gallery { mediaId }", async () => {
    const { calls } = mockFetch({
      "GET /gallery": () => jsonResponse(200, { data: items }),
      "POST /gallery": () =>
        jsonResponse(201, { data: item("g4", { mediaId: "m9" }) }),
    })
    const { invalidate } = renderWithClient(<GalleryManager />)
    await screen.findAllByRole("listitem")

    await userEvent.click(
      screen.getByRole("button", { name: "Thêm vào thư viện" })
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Chọn giả (all)" })
    )

    await waitFor(() =>
      expect(bodyOf(calls, "POST /gallery")).toEqual({ mediaId: "m9" })
    )
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled())
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["gallery"] })
  })

  it("xuống ở mục 1 → PATCH /gallery/reorder với thứ tự mới", async () => {
    const reordered = [items[1], items[0], items[2]]
    const { calls } = mockFetch({
      "GET /gallery": () => jsonResponse(200, { data: items }),
      "PATCH /gallery/reorder": () => jsonResponse(200, { data: reordered }),
    })
    renderWithClient(<GalleryManager />)
    const rows = await screen.findAllByRole("listitem")

    expect(
      within(rows[0]!).getByRole("button", { name: "Đưa lên" })
    ).toBeDisabled()
    expect(
      within(rows[2]!).getByRole("button", { name: "Đưa xuống" })
    ).toBeDisabled()
    await userEvent.click(
      within(rows[0]!).getByRole("button", { name: "Đưa xuống" })
    )

    await waitFor(() =>
      expect(bodyOf(calls, "PATCH /gallery/reorder")).toEqual({
        ids: ["g2", "g1", "g3"],
      })
    )
    await waitFor(() =>
      expect(screen.getAllByRole("listitem")[0]).toHaveTextContent(
        "Chưa có chú thích"
      )
    )
  })

  it("ẩn mục → PATCH /gallery/:id { visible: false }; hiện lại mục đang ẩn", async () => {
    const { calls } = mockFetch({
      "GET /gallery": () => jsonResponse(200, { data: items }),
      "PATCH /gallery/g1": () =>
        jsonResponse(200, { data: { ...items[0], visible: false } }),
      "PATCH /gallery/g2": () =>
        jsonResponse(200, { data: { ...items[1], visible: true } }),
    })
    renderWithClient(<GalleryManager />)
    const rows = await screen.findAllByRole("listitem")

    await userEvent.click(
      within(rows[0]!).getByRole("button", { name: "Ẩn khỏi website" })
    )
    await waitFor(() =>
      expect(bodyOf(calls, "PATCH /gallery/g1")).toEqual({ visible: false })
    )
    await userEvent.click(
      within(rows[1]!).getByRole("button", { name: "Hiện trên website" })
    )
    await waitFor(() =>
      expect(bodyOf(calls, "PATCH /gallery/g2")).toEqual({ visible: true })
    )
  })

  it("sửa chú thích trong sheet → PATCH { caption }; mục ảnh không có ảnh bìa", async () => {
    const { calls } = mockFetch({
      "GET /gallery": () => jsonResponse(200, { data: items }),
      "PATCH /gallery/g1": () =>
        jsonResponse(200, { data: { ...items[0], caption: "Sân mới" } }),
    })
    renderWithClient(<GalleryManager />)
    const rows = await screen.findAllByRole("listitem")

    await userEvent.click(within(rows[0]!).getByRole("button", { name: "Sửa" }))
    expect(screen.queryByRole("button", { name: "Chọn ảnh bìa" })).toBeNull()
    const caption = screen.getByLabelText("Chú thích")
    await userEvent.clear(caption)
    await userEvent.type(caption, "  Sân mới ")
    await userEvent.click(screen.getByRole("button", { name: "Lưu" }))

    await waitFor(() =>
      expect(bodyOf(calls, "PATCH /gallery/g1")).toEqual({
        caption: "Sân mới",
      })
    )
  })

  it("video: chọn ảnh bìa → PATCH { posterMediaId }", async () => {
    const { calls } = mockFetch({
      "GET /gallery": () => jsonResponse(200, { data: items }),
      "PATCH /gallery/g2": () =>
        jsonResponse(200, {
          data: {
            ...items[1],
            posterMediaId: "p1",
            poster: { url: "/uploads/p.webp", alt: "Ảnh bìa" },
          },
        }),
    })
    renderWithClient(<GalleryManager />)
    const rows = await screen.findAllByRole("listitem")

    await userEvent.click(within(rows[1]!).getByRole("button", { name: "Sửa" }))
    await userEvent.click(screen.getByRole("button", { name: "Chọn ảnh bìa" }))
    await userEvent.click(
      screen.getByRole("button", { name: "Chọn giả (image)" })
    )
    await userEvent.click(screen.getByRole("button", { name: "Lưu" }))

    await waitFor(() =>
      expect(bodyOf(calls, "PATCH /gallery/g2")).toEqual({
        posterMediaId: "p1",
      })
    )
  })

  it("xoá mục cần xác nhận → DELETE /gallery/:id", async () => {
    const { calls } = mockFetch({
      "GET /gallery": () => jsonResponse(200, { data: items }),
      "DELETE /gallery/g3": () => jsonResponse(204),
    })
    renderWithClient(<GalleryManager />)
    const rows = await screen.findAllByRole("listitem")

    await userEvent.click(
      within(rows[2]!).getByRole("button", { name: "Xoá khỏi thư viện" })
    )
    expect(calls.some((call) => call.key === "DELETE /gallery/g3")).toBe(false)
    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Xoá",
      })
    )
    await waitFor(() =>
      expect(calls.some((call) => call.key === "DELETE /gallery/g3")).toBe(true)
    )
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled())
  })
})

describe("MediaLibrary", () => {
  const mediaPage = {
    data: [
      media({ refsCount: 2 }),
      media({
        id: "m2",
        kind: "video",
        url: "/uploads/b.mp4",
        mimeType: "video/mp4",
        alt: "Video sa hình",
        duration: 75,
      }),
    ],
    meta: { page: 1, limit: 24, total: 2 },
  }

  it("lưới từ GET /media, hiện số nơi dùng", async () => {
    const { fn } = mockFetch({
      "GET /media": () => jsonResponse(200, mediaPage),
    })
    renderWithClient(<MediaLibrary />)

    expect(
      await screen.findByRole("button", { name: /Sân tập lái/ })
    ).toBeInTheDocument()
    expect(screen.getByText("Đang dùng ở 2 nơi")).toBeInTheDocument()
    expect(screen.getByText("Chưa dùng")).toBeInTheDocument()
    const url = new URL(String(fn.mock.calls[0]![0]), "http://localhost")
    expect(url.pathname).toBe("/api/v1/media")
    expect(url.searchParams.get("limit")).toBe("24")
  })

  it("sửa mô tả → PATCH /media/:id { alt }", async () => {
    const { calls } = mockFetch({
      "GET /media": () => jsonResponse(200, mediaPage),
      "PATCH /media/m1": () =>
        jsonResponse(200, { data: { ...mediaPage.data[0], alt: "Sân mới" } }),
    })
    const { invalidate } = renderWithClient(<MediaLibrary />)

    await userEvent.click(
      await screen.findByRole("button", { name: /Sân tập lái/ })
    )
    const alt = screen.getByLabelText("Mô tả")
    expect(alt).toHaveValue("Sân tập lái")
    await userEvent.clear(alt)
    await userEvent.type(alt, "Sân mới")
    await userEvent.click(screen.getByRole("button", { name: "Lưu mô tả" }))

    await waitFor(() =>
      expect(bodyOf(calls, "PATCH /media/m1")).toEqual({ alt: "Sân mới" })
    )
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["media"] })
    )
  })

  it("xoá media đang dùng → 409 → hộp liệt kê nơi dùng, có link bài viết", async () => {
    mockFetch({
      "GET /media": () => jsonResponse(200, mediaPage),
      "DELETE /media/m1": () =>
        jsonResponse(409, {
          error: {
            code: "MEDIA_IN_USE",
            message: "Media đang được dùng",
            details: [
              { path: "refs", message: "post:p1:Học lái xe: kinh nghiệm" },
              { path: "refs", message: "gallery:g1:Sân tập" },
            ],
          },
        }),
    })
    renderWithClient(<MediaLibrary />)

    await userEvent.click(
      await screen.findByRole("button", { name: /Sân tập lái/ })
    )
    await userEvent.click(screen.getByRole("button", { name: "Xoá media" }))
    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Xoá",
      })
    )

    const dialog = await screen.findByRole("alertdialog", {
      name: "Media đang được dùng",
    })
    expect(
      within(dialog).getByRole("link", { name: /Học lái xe: kinh nghiệm/ })
    ).toHaveAttribute("href", "/admin/bai-viet/p1")
    expect(dialog).toHaveTextContent("Thư viện website")
    expect(dialog).toHaveTextContent("Sân tập")
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it("xoá media không dùng → 204 → toast + invalidate", async () => {
    const { calls } = mockFetch({
      "GET /media": () => jsonResponse(200, mediaPage),
      "DELETE /media/m2": () => jsonResponse(204),
    })
    const { invalidate } = renderWithClient(<MediaLibrary />)

    await userEvent.click(
      await screen.findByRole("button", { name: /Video sa hình/ })
    )
    await userEvent.click(screen.getByRole("button", { name: "Xoá media" }))
    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Xoá",
      })
    )

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled())
    expect(calls.some((call) => call.key === "DELETE /media/m2")).toBe(true)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["media"] })
  })

  it("không có media.upload → không có Tải lên, sửa, xoá", async () => {
    auth = { permissions: ["media.read", "gallery.manage"] }
    mockFetch({ "GET /media": () => jsonResponse(200, mediaPage) })
    renderWithClient(<MediaLibrary />)

    await userEvent.click(
      await screen.findByRole("button", { name: /Sân tập lái/ })
    )
    expect(screen.queryByRole("button", { name: "Tải lên" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Xoá media" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Lưu mô tả" })).toBeNull()
  })
})

describe("menu Thư viện", () => {
  function renderShell(permissions: string[]) {
    auth = {
      user: { name: "Người dùng", role: "editor" },
      permissions,
      logout: vi.fn(),
    }
    render(
      <AdminShell>
        <p>nội dung</p>
      </AdminShell>
    )
  }

  it("editor (gallery.manage) thấy Thư viện trong nhóm Nội dung", () => {
    renderShell(["media.read", "media.upload", "gallery.manage", "post.manage"])
    const nav = screen.getByRole("navigation", {
      name: "Điều hướng nội dung",
    })
    expect(within(nav).getByRole("link", { name: "Thư viện" })).toHaveAttribute(
      "href",
      "/admin/thu-vien"
    )
  })

  it("tư vấn viên không thấy Thư viện", () => {
    renderShell(["branch.read", "lead.read", "media.read", "dashboard.read"])
    expect(screen.queryByRole("link", { name: "Thư viện" })).toBeNull()
  })
})
