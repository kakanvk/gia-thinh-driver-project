import { render, screen, within } from "@testing-library/react"
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
    // Chuyên mục thông báo không có tab/lựa chọn trong bộ lọc
    expect(screen.queryByRole("button", { name: /Thông báo/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("option", { name: /Thông báo/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /Kinh nghiệm thi/ }).length).toBeGreaterThan(0)
    // Bài thông báo nằm trong khối "Thông báo từ trung tâm", không nằm trong lưới bài viết
    const announcementBlock = screen
      .getByRole("heading", { name: "Thông báo từ trung tâm" })
      .closest("section") as HTMLElement
    expect(within(announcementBlock).getByRole("link", { name: /Lịch nghỉ lễ/ })).toHaveAttribute(
      "href",
      "/dien-dan/c"
    )
    expect(within(announcementBlock).queryByText("Bảng học phí 2026")).not.toBeInTheDocument()
    const articleLinks = screen
      .getAllByRole("link")
      .filter((link) => !announcementBlock.contains(link))
      .map((link) => link.getAttribute("href"))
    expect(articleLinks).toContain("/dien-dan/b")
    expect(articleLinks).not.toContain("/dien-dan/c")
    // Lọc theo chuyên mục động (tab hoặc select hiện có)
    await userEvent.click(screen.getAllByRole("button", { name: /Học phí/ })[0])
    expect(screen.queryByText("Mẹo thi")).not.toBeInTheDocument()
    expect(screen.getAllByText("Bảng học phí 2026").length).toBeGreaterThan(0)
  })

  it("API lỗi (posts null) hiện thông báo dự phòng kèm hotline, khác danh sách rỗng", () => {
    const { unmount } = render(
      <NewsExplorer
        posts={null}
        categories={categories}
        contact={{ hotline: "0909 000 111", telHref: "tel:0909000111", zaloHref: "https://zalo.me/0909000111" }}
      />
    )
    expect(screen.getByText(/Tin tức đang được cập nhật/)).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "0909 000 111" })[0]).toHaveAttribute("href", "tel:0909000111")
    expect(screen.queryByText("Chưa có bài viết.")).not.toBeInTheDocument()
    unmount()

    render(<NewsExplorer posts={[]} categories={categories} />)
    expect(screen.getByText("Chưa có bài viết.")).toBeInTheDocument()
    expect(screen.queryByText(/Tin tức đang được cập nhật/)).not.toBeInTheDocument()
  })
})

describe("PostContent", () => {
  it("render đoạn văn, tiêu đề, đậm, danh sách, liên kết, ảnh có/không chú thích và bỏ qua node lạ", () => {
    const { container } = render(
      <PostContent
        value={[
          { type: "h2", children: [{ text: "Chuẩn bị giấy tờ" }] },
          { type: "p", children: [{ text: "Mang " }, { text: "CCCD", bold: true }, { text: " gốc." }] },
          { type: "p", listStyleType: "disc", indent: 1, children: [{ text: "Ý một" }] },
          { type: "p", children: [{ type: "a", url: "https://giathinh.vn/tu-van", children: [{ text: "Trang chủ" }] }] },
          { type: "img", url: "https://cdn/x.webp", caption: [{ text: "Sân thi" }], children: [{ text: "" }] },
          { type: "khong-ton-tai", children: [{ text: "Vẫn hiện" }] },
          { type: "img", url: "https://cdn/y.webp", children: [{ text: "" }] },
          { type: "p", children: [{ text: "Sau ảnh không chú thích" }] },
        ]}
      />
    )
    expect(screen.getByRole("heading", { name: "Chuẩn bị giấy tờ" })).toBeInTheDocument()
    expect(screen.getByText("CCCD").closest("strong")).not.toBeNull()
    expect(screen.getByText("Ý một").closest("ul")).not.toBeNull()
    expect(screen.getByRole("link", { name: "Trang chủ" })).toHaveAttribute("href", "https://giathinh.vn/tu-van")
    const imgs = container.querySelectorAll("img")
    expect(imgs).toHaveLength(2)
    expect(imgs[0]).toHaveAttribute("src", "https://cdn/x.webp")
    expect(imgs[1]).toHaveAttribute("src", "https://cdn/y.webp")
    expect(imgs[1]).toHaveAttribute("alt", "")
    expect(container.querySelectorAll("figcaption")).toHaveLength(1)
    expect(screen.getByText("Sân thi")).toBeInTheDocument()
    expect(screen.getByText("Vẫn hiện")).toBeInTheDocument()
    expect(screen.getByText("Sau ảnh không chú thích")).toBeInTheDocument()
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
