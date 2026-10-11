import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { CategorySheet } from "@/components/admin/posts/category-sheet"
import { PostList } from "@/components/admin/posts/post-list"
import { makeQueryClient } from "@/components/providers/query-provider"
import type { AdminPost, Category } from "@/lib/admin/posts"
import { postStatusLabel } from "@/lib/admin/posts"
import { setAccessToken } from "@/lib/api/session"
import { jsonResponse, mockFetch } from "@/test/fetch-mock"

const { toastSuccess, toastError, replace, push } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
}))
vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError, info: vi.fn() },
}))

let search = ""
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => "/admin/bai-viet",
  useSearchParams: () => new URLSearchParams(search),
}))

let auth: Record<string, unknown>
vi.mock("@/components/admin/auth-provider", () => ({ useAuth: () => auth }))

function post(overrides: Partial<AdminPost> = {}): AdminPost {
  return {
    id: "p1",
    title: "Kinh nghiệm thi sa hình",
    slug: "kinh-nghiem-thi-sa-hinh",
    excerpt: "",
    cover: { url: "/uploads/a.webp", alt: "Bìa", mediaId: "m1" },
    categoryId: "c1",
    tags: [],
    authorName: "Ban biên tập",
    status: "draft",
    publishedAt: null,
    views: 1200,
    seo: null,
    createdAt: "2026-10-01T09:00:00+07:00",
    updatedAt: "2026-10-02T10:30:00+07:00",
    ...overrides,
  }
}

const categories: Category[] = [
  { id: "c2", name: "Thông báo", slug: "thong-bao", isAnnouncement: true, order: 1 },
  { id: "c1", name: "Kinh nghiệm thi", slug: "kinh-nghiem-thi", isAnnouncement: false, order: 0 },
  { id: "c3", name: "Học phí", slug: "hoc-phi", isAnnouncement: false, order: 2 },
]

const posts = [
  post(),
  post({
    id: "p2",
    title: "Lịch thi tháng 12",
    slug: "lich-thi-thang-12",
    categoryId: "c2",
    status: "published",
    publishedAt: "2099-01-01T08:00:00+07:00",
  }),
  post({
    id: "p3",
    title: "Bài đã đăng",
    slug: "bai-da-dang",
    status: "published",
    publishedAt: "2026-09-01T08:00:00+07:00",
  }),
  post({ id: "p4", title: "Bài lưu trữ", slug: "bai-luu-tru", status: "archived" }),
]

function renderWithClient(ui: React.ReactElement) {
  const client = makeQueryClient()
  client.setDefaultOptions({ queries: { retry: false } })
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
  return client
}

function listHandlers(extra: Record<string, Parameters<typeof mockFetch>[0][string]> = {}) {
  return mockFetch({
    "GET /posts": () =>
      jsonResponse(200, { data: posts, meta: { page: 1, limit: 20, total: 4 } }),
    "GET /categories": () => jsonResponse(200, { data: categories }),
    ...extra,
  })
}

async function openMenu(title: string) {
  await userEvent.click(
    await screen.findByRole("button", { name: `Thao tác cho ${title}` })
  )
  return screen.findByRole("menu")
}

beforeEach(() => {
  toastSuccess.mockClear()
  toastError.mockClear()
  replace.mockClear()
  push.mockClear()
  search = ""
  setAccessToken("t1")
  auth = { permissions: ["post.manage", "category.manage", "media.read"] }
})

describe("postStatusLabel", () => {
  it("published + publishedAt tương lai → Hẹn giờ", () => {
    const now = new Date("2026-10-05T00:00:00+07:00")
    expect(
      postStatusLabel({ status: "published", publishedAt: "2026-10-06T08:00:00+07:00" }, now)
    ).toBe("Hẹn giờ")
    expect(
      postStatusLabel({ status: "published", publishedAt: "2026-10-01T08:00:00+07:00" }, now)
    ).toBe("Đã xuất bản")
    expect(postStatusLabel({ status: "pending", publishedAt: null }, now)).toBe("Chờ duyệt")
  })
})

describe("PostList", () => {
  it("gọi GET /posts với phân trang, sắp -updatedAt và bộ lọc từ URL", async () => {
    search = "q=thi&status=draft&categoryId=c1&page=2"
    const { fn } = listHandlers()
    renderWithClient(<PostList />)
    await screen.findByText("Kinh nghiệm thi sa hình")

    const call = fn.mock.calls
      .map((args) => new URL(String(args[0]), "http://localhost"))
      .find((url) => url.pathname === "/api/v1/posts")!
    expect(Object.fromEntries(call.searchParams)).toEqual({
      q: "thi",
      status: "draft",
      categoryId: "c1",
      page: "2",
      limit: "20",
      sort: "-updatedAt",
    })
  })

  it("hiện tên chuyên mục, nhãn Hẹn giờ; bấm hàng → trang sửa", async () => {
    listHandlers()
    renderWithClient(<PostList />)
    const row = (await screen.findByText("Lịch thi tháng 12")).closest("tr")!
    expect(within(row).getByText("Hẹn giờ")).toBeInTheDocument()
    await waitFor(() => expect(within(row).getByText("Thông báo")).toBeInTheDocument())
    const draftRow = screen.getByText("Kinh nghiệm thi sa hình").closest("tr")!
    expect(within(draftRow).getByText("Nháp")).toBeInTheDocument()

    await userEvent.click(draftRow)
    expect(push).toHaveBeenCalledWith("/admin/bai-viet/p1")
  })

  it("menu bài nháp: Xuất bản (POST không body), không có Khôi phục; không mở trang sửa", async () => {
    const { calls } = listHandlers({
      "POST /posts/p1/publish": () =>
        jsonResponse(200, { data: post({ status: "published" }) }),
    })
    renderWithClient(<PostList />)
    const menu = await openMenu("Kinh nghiệm thi sa hình")
    expect(within(menu).queryByRole("menuitem", { name: "Khôi phục" })).toBeNull()
    expect(within(menu).queryByRole("menuitem", { name: "Gỡ xuất bản" })).toBeNull()
    expect(within(menu).queryByRole("menuitem", { name: "Xem trên web" })).toBeNull()
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Xuất bản" }))

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled())
    const publish = calls.find((call) => call.key === "POST /posts/p1/publish")!
    expect(publish.init.body).toBeUndefined()
    expect(push).not.toHaveBeenCalled()
  })

  it("menu bài đã xuất bản: Gỡ xuất bản, Xem trên web mở tab mới", async () => {
    listHandlers()
    renderWithClient(<PostList />)
    const menu = await openMenu("Bài đã đăng")
    expect(within(menu).getByRole("menuitem", { name: "Gỡ xuất bản" })).toBeInTheDocument()
    expect(within(menu).queryByRole("menuitem", { name: "Xuất bản" })).toBeNull()
    const view = within(menu).getByRole("menuitem", { name: "Xem trên web" })
    expect(view).toHaveAttribute("href", "/dien-dan/bai-da-dang")
    expect(view).toHaveAttribute("target", "_blank")
  })

  it("menu bài lưu trữ: Khôi phục; 409 → toast lỗi", async () => {
    listHandlers({
      "POST /posts/p4/restore": () =>
        jsonResponse(409, {
          error: { code: "CONFLICT", message: "Không thể khôi phục bài viết" },
        }),
    })
    renderWithClient(<PostList />)
    const menu = await openMenu("Bài lưu trữ")
    expect(within(menu).queryByRole("menuitem", { name: "Lưu trữ" })).toBeNull()
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Khôi phục" }))
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Không thể khôi phục bài viết")
    )
    // Mutation tự báo lỗi → không báo thêm lần nữa qua MutationCache
    expect(toastError).toHaveBeenCalledTimes(1)
  })

  it("Nhân bản → POST duplicate → toast + chuyển tới bài mới", async () => {
    listHandlers({
      "POST /posts/p1/duplicate": () =>
        jsonResponse(201, { data: post({ id: "p9", title: "Bản sao" }) }),
    })
    renderWithClient(<PostList />)
    const menu = await openMenu("Kinh nghiệm thi sa hình")
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Nhân bản" }))
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/bai-viet/p9"))
    expect(toastSuccess).toHaveBeenCalled()
  })

  it("Xoá cần xác nhận → DELETE /posts/:id", async () => {
    const { calls } = listHandlers({
      "DELETE /posts/p1": () => jsonResponse(204),
    })
    renderWithClient(<PostList />)
    const menu = await openMenu("Kinh nghiệm thi sa hình")
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Xoá" }))
    expect(calls.some((call) => call.key === "DELETE /posts/p1")).toBe(false)
    await userEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Xoá" })
    )
    await waitFor(() =>
      expect(calls.some((call) => call.key === "DELETE /posts/p1")).toBe(true)
    )
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled())
    expect(push).not.toHaveBeenCalled()
  })

  it("nút Chuyên mục ẩn khi thiếu category.manage; Viết bài dẫn tới trang tạo", async () => {
    auth = { permissions: ["post.manage"] }
    listHandlers()
    renderWithClient(<PostList />)
    await screen.findByText("Kinh nghiệm thi sa hình")
    expect(screen.queryByRole("button", { name: "Chuyên mục" })).toBeNull()
    expect(screen.getByRole("link", { name: "Viết bài" })).toHaveAttribute(
      "href",
      "/admin/bai-viet/tao-moi"
    )
  })
})

describe("CategorySheet", () => {
  it("danh sách theo order; thêm chuyên mục → POST /categories", async () => {
    const { calls } = mockFetch({
      "GET /categories": () => jsonResponse(200, { data: categories }),
      "POST /categories": () =>
        jsonResponse(201, {
          data: { id: "c4", name: "Ô tô", slug: "o-to", isAnnouncement: true, order: 0 },
        }),
    })
    renderWithClient(<CategorySheet open onOpenChange={vi.fn()} />)
    const list = await screen.findByRole("list", { name: "Chuyên mục" })
    const names = within(list)
      .getAllByRole("listitem")
      .map((item) => item.querySelector("p")!.firstChild!.textContent)
    expect(names).toEqual(["Kinh nghiệm thi", "Thông báo", "Học phí"])

    await userEvent.click(screen.getByRole("button", { name: "Thêm chuyên mục" }))
    await userEvent.type(screen.getByLabelText(/^Tên/), "Ô tô")
    await userEvent.type(screen.getByLabelText("Mô tả"), "Hạng B")
    await userEvent.click(screen.getByRole("checkbox"))
    await userEvent.click(screen.getByRole("button", { name: "Thêm chuyên mục" }))

    await waitFor(() => {
      const call = calls.find((entry) => entry.key === "POST /categories")
      expect(call && JSON.parse(String(call.init.body))).toEqual({
        name: "Ô tô",
        description: "Hạng B",
        isAnnouncement: true,
      })
    })
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled())
  })

  it("xoá chuyên mục còn bài → 409 → thông báo", async () => {
    mockFetch({
      "GET /categories": () => jsonResponse(200, { data: categories }),
      "DELETE /categories/c1": () =>
        jsonResponse(409, {
          error: { code: "CONFLICT", message: "Chuyên mục còn bài viết" },
        }),
    })
    renderWithClient(<CategorySheet open onOpenChange={vi.fn()} />)
    const list = await screen.findByRole("list", { name: "Chuyên mục" })
    const first = within(list).getAllByRole("listitem")[0]!
    await userEvent.click(within(first).getByRole("button", { name: "Xoá" }))
    await userEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Xoá" })
    )
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining("Chuyên mục còn bài viết")
      )
    )
  })

  it("đưa xuống → PATCH /categories/reorder với thứ tự mới", async () => {
    const { calls } = mockFetch({
      "GET /categories": () => jsonResponse(200, { data: categories }),
      "PATCH /categories/reorder": () => jsonResponse(200, { data: { ok: true } }),
    })
    renderWithClient(<CategorySheet open onOpenChange={vi.fn()} />)
    const list = await screen.findByRole("list", { name: "Chuyên mục" })
    const first = within(list).getAllByRole("listitem")[0]!
    await userEvent.click(within(first).getByRole("button", { name: "Đưa xuống" }))
    await waitFor(() => {
      const call = calls.find((entry) => entry.key === "PATCH /categories/reorder")
      expect(call && JSON.parse(String(call.init.body))).toEqual({
        ids: ["c2", "c1", "c3"],
      })
    })
  })
})
