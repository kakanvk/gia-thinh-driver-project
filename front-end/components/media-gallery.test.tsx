import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import MediaPage from "@/app/thu-vien/page"
import { MediaGallery, type MediaItem } from "@/components/media-gallery"
import type { PublicGalleryItem } from "@/lib/public/types"
import { jsonResponse, mockFetch } from "@/test/fetch-mock"

vi.mock("@/components/site-header", () => ({ SiteHeader: () => null }))

const items: MediaItem[] = [
  {
    src: "https://cdn.example.com/2026/10/san-tap.webp",
    kind: "image",
    alt: "Sân tập sa hình",
    caption: "Sân tập tại Vĩnh Long",
  },
  {
    src: "https://cdn.example.com/2026/10/vong-so-8.mp4",
    kind: "video",
    alt: "Vòng số 8",
    caption: "Bài thi vòng số 8",
    poster: "https://cdn.example.com/2026/10/poster.webp",
  },
  {
    src: "https://cdn.example.com/2026/10/lop-hoc.webp",
    kind: "image",
    alt: "Lớp lý thuyết",
  },
]

beforeEach(() => {
  // jsdom không có IntersectionObserver (ScrollReveal dùng motion whileInView)
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
})

describe("MediaGallery", () => {
  it("đếm tab Ảnh/Video, ảnh có alt, video có poster", async () => {
    render(<MediaGallery items={items} />)
    expect(screen.getByRole("button", { name: /Tất cả/ })).toHaveTextContent("3")
    expect(screen.getByRole("button", { name: /Hình ảnh/ })).toHaveTextContent("2")
    expect(screen.getByRole("button", { name: /^Video/ })).toHaveTextContent("1")

    expect(screen.getByAltText("Sân tập sa hình")).toBeInTheDocument()
    const video = document.querySelector("video")!
    expect(video).toHaveAttribute("src", items[1]!.src)
    expect(video).toHaveAttribute("poster", items[1]!.poster)

    await userEvent.click(screen.getByRole("button", { name: /^Video/ }))
    expect(screen.queryByAltText("Sân tập sa hình")).toBeNull()
  })

  it("lightbox hiện chú thích; phím mũi tên chuyển tư liệu", async () => {
    render(<MediaGallery items={items} />)
    await userEvent.click(screen.getByRole("button", { name: "Xem ảnh 1" }))
    const dialog = screen.getByRole("dialog", { name: "Trình xem tư liệu" })
    expect(within(dialog).getByText("Sân tập tại Vĩnh Long")).toBeInTheDocument()

    await userEvent.keyboard("{ArrowRight}")
    expect(within(dialog).getByText("Bài thi vòng số 8")).toBeInTheDocument()
    expect(dialog.querySelector("video")).toHaveAttribute("poster", items[1]!.poster)

    await userEvent.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})

describe("/thu-vien", () => {
  const gallery: PublicGalleryItem[] = [
    {
      id: "g1",
      kind: "image",
      url: "https://cdn.example.com/2026/10/san-tap.webp",
      alt: "Sân tập sa hình",
      caption: null,
      width: 1600,
      height: 900,
      posterUrl: null,
    },
    {
      id: "g2",
      kind: "video",
      url: "https://cdn.example.com/2026/10/vong-so-8.mp4",
      alt: "",
      caption: "Bài thi vòng số 8",
      width: null,
      height: null,
      posterUrl: "https://cdn.example.com/2026/10/poster.webp",
    },
  ]

  beforeEach(() => {
    vi.stubEnv("API_ORIGIN", "http://api.test")
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("lấy mục từ GET /public/gallery", async () => {
    const { fn } = mockFetch({
      "GET /public/gallery": () => jsonResponse(200, { data: gallery }),
    })
    render(await MediaPage())
    expect(String(fn.mock.calls[0]![0])).toBe(
      "http://api.test/api/v1/public/gallery"
    )
    expect(screen.getByAltText("Sân tập sa hình")).toBeInTheDocument()
    expect(document.querySelector("video")).toHaveAttribute(
      "poster",
      "https://cdn.example.com/2026/10/poster.webp"
    )
  })

  it("API lỗi → khối thư viện đang cập nhật", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockFetch({ "GET /public/gallery": () => jsonResponse(500) })
    render(await MediaPage())
    expect(
      screen.getByText("Thư viện đang được cập nhật, vui lòng quay lại sau.")
    ).toBeInTheDocument()
  })

  it("chưa có mục nào → thông báo rỗng", async () => {
    mockFetch({ "GET /public/gallery": () => jsonResponse(200, { data: [] }) })
    render(await MediaPage())
    expect(screen.getByText("Chưa có ảnh hoặc video.")).toBeInTheDocument()
  })
})
