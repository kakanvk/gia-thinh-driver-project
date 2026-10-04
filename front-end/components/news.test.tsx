import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { NewsCard } from "@/components/news-card"
import { NewsExplorer } from "@/components/news-explorer"
import { PostContent } from "@/components/post-content"
import { PostViewTracker } from "@/components/post-view-tracker"
import type { NewsCategory, NewsPost } from "@/lib/news"
import { jsonResponse, mockFetch } from "@/test/fetch-mock"

const newsPost = (over: Partial<NewsPost>): NewsPost => ({
  slug: "a",
  title: "Mẹo thi",
  excerpt: "Tóm tắt",
  category: "Kinh nghiệm thi",
  categorySlug: "kinh-nghiem-thi",
  isAnnouncement: false,
  date: "01/10/2026",
  publishedAt: "2026-10-01T08:00:00+07:00",
  readTime: "4 phút đọc",
  image: null,
  imageAlt: "Mẹo thi",
  ...over,
})

const categories: NewsCategory[] = [
  { slug: "kinh-nghiem-thi", name: "Kinh nghiệm thi", description: null, isAnnouncement: false, postCount: 1 },
  { slug: "hoc-phi", name: "Học phí", description: null, isAnnouncement: false, postCount: 1 },
  { slug: "thong-bao", name: "Thông báo", description: null, isAnnouncement: true, postCount: 1 },
]

describe("NewsCard", () => {
  it("bài không có ảnh bìa vẫn hiển thị", () => {
    render(<NewsCard post={newsPost({})} />)
    expect(screen.getByRole("link")).toHaveAttribute("href", "/dien-dan/a")
    expect(screen.getByText("Mẹo thi")).toBeInTheDocument()
  })
})

describe("NewsExplorer", () => {
  // jsdom không có IntersectionObserver (ScrollReveal dùng motion whileInView)
  beforeEach(() => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    )
  })

  it("chuyên mục lấy từ API, thông báo tách riêng theo isAnnouncement", async () => {
    const posts = [
      newsPost({ slug: "a" }),
      newsPost({ slug: "b", title: "Bảng học phí 2026", category: "Học phí", categorySlug: "hoc-phi" }),
      newsPost({ slug: "c", title: "Lịch nghỉ lễ", category: "Thông báo", categorySlug: "thong-bao", isAnnouncement: true }),
    ]
    render(<NewsExplorer posts={posts} categories={categories} />)
    expect(screen.getAllByText("Lịch nghỉ lễ").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Bảng học phí 2026").length).toBeGreaterThan(0)
    // Lọc theo chuyên mục động (tab hoặc select hiện có)
    await userEvent.click(screen.getAllByRole("button", { name: /Học phí/ })[0])
    expect(screen.queryByText("Mẹo thi")).not.toBeInTheDocument()
    expect(screen.getAllByText("Bảng học phí 2026").length).toBeGreaterThan(0)
  })
})

describe("PostContent", () => {
  it("render đoạn văn, tiêu đề, đậm, danh sách, liên kết, ảnh có chú thích và bỏ qua node lạ", () => {
    render(
      <PostContent
        value={[
          { type: "h2", children: [{ text: "Chuẩn bị giấy tờ" }] },
          { type: "p", children: [{ text: "Mang " }, { text: "CCCD", bold: true }, { text: " gốc." }] },
          { type: "p", listStyleType: "disc", indent: 1, children: [{ text: "Ý một" }] },
          { type: "p", children: [{ type: "a", url: "https://giathinh.vn/tu-van", children: [{ text: "Trang chủ" }] }] },
          { type: "img", url: "https://cdn/x.webp", caption: [{ text: "Sân thi" }], children: [{ text: "" }] },
          { type: "khong-ton-tai", children: [{ text: "Vẫn hiện" }] },
        ]}
      />
    )
    expect(screen.getByRole("heading", { name: "Chuẩn bị giấy tờ" })).toBeInTheDocument()
    expect(screen.getByText("CCCD").closest("strong")).not.toBeNull()
    expect(screen.getByText("Ý một").closest("ul")).not.toBeNull()
    expect(screen.getByRole("link", { name: "Trang chủ" })).toHaveAttribute("href", "https://giathinh.vn/tu-van")
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://cdn/x.webp")
    expect(screen.getByText("Sân thi")).toBeInTheDocument()
    expect(screen.getByText("Vẫn hiện")).toBeInTheDocument()
  })
})

describe("PostViewTracker", () => {
  beforeEach(() => sessionStorage.clear())

  it("gọi đếm lượt xem một lần mỗi phiên", async () => {
    const { calls } = mockFetch({ "POST /public/posts/meo-thi/view": () => jsonResponse(204) })
    const first = render(<PostViewTracker slug="meo-thi" />)
    await vi.waitFor(() => expect(calls).toHaveLength(1))
    first.unmount()
    render(<PostViewTracker slug="meo-thi" />)
    await new Promise((r) => setTimeout(r, 20))
    expect(calls).toHaveLength(1)
  })

  it("lỗi mạng không ném ra ngoài", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")))
    expect(() => render(<PostViewTracker slug="x" />)).not.toThrow()
    await new Promise((r) => setTimeout(r, 20))
  })
})
