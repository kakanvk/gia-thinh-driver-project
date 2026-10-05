import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClientProvider } from "@tanstack/react-query"
import type { Value } from "platejs"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AdminPostEditor } from "@/components/admin/admin-post-editor"
import { PostEditorForm } from "@/components/admin/posts/post-editor-form"
import { makeQueryClient } from "@/components/providers/query-provider"
import type { AdminPost, Category } from "@/lib/admin/posts"
import { slugify } from "@/lib/admin/posts"
import type { MediaItem } from "@/lib/admin/types"
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => "/admin/bai-viet/tao-moi",
}))

let auth: Record<string, unknown>
vi.mock("@/components/admin/auth-provider", () => ({ useAuth: () => auth }))

function media(overrides: Partial<MediaItem> = {}): MediaItem {
  return {
    id: "m1",
    kind: "image",
    url: "https://cdn.example.com/2026/10/a.webp",
    mimeType: "image/webp",
    size: 1000,
    alt: "Sân tập",
    refsCount: 0,
    createdAt: "2026-10-01T09:00:00+07:00",
    ...overrides,
  }
}

// MediaPicker giả: mở ra là nút chọn sẵn một ảnh (ảnh bìa m1, ảnh nội dung m2)
vi.mock("@/components/admin/media/media-picker", () => ({
  MediaPicker: ({
    open,
    title,
    onSelect,
    onOpenChange,
  }: {
    open: boolean
    title?: string
    onSelect: (media: MediaItem) => void
    onOpenChange: (open: boolean) => void
  }) =>
    open ? (
      <button
        type="button"
        onClick={() => {
          onSelect(
            title === "Chọn ảnh bìa"
              ? media()
              : media({
                  id: "m2",
                  url: "https://cdn.example.com/2026/10/b.webp",
                })
          )
          onOpenChange(false)
        }}
      >
        {`Chọn giả: ${title}`}
      </button>
    ) : null,
}))

const categories: Category[] = [
  { id: "c1", name: "Kinh nghiệm thi", slug: "kinh-nghiem-thi", isAnnouncement: false, order: 0 },
  { id: "c2", name: "Thông báo", slug: "thong-bao", isAnnouncement: true, order: 1 },
]

const content = [
  { type: "p", children: [{ text: "Nội dung bài viết về sa hình." }] },
]

function post(overrides: Partial<AdminPost> = {}): AdminPost {
  return {
    id: "p1",
    title: "Kinh nghiệm thi sa hình",
    slug: "kinh-nghiem-thi-sa-hinh",
    excerpt: "Tóm tắt",
    excerptAuto: false,
    cover: null,
    categoryId: "c1",
    tags: ["sa-hinh"],
    authorName: "Ban biên tập",
    status: "draft",
    publishedAt: null,
    views: 0,
    seo: null,
    content,
    createdAt: "2026-10-01T09:00:00+07:00",
    updatedAt: "2026-10-02T10:30:00+07:00",
    ...overrides,
  }
}

function renderWithClient(ui: React.ReactElement) {
  const client = makeQueryClient()
  client.setDefaultOptions({ queries: { retry: false } })
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
  return client
}

function bodyOf(calls: { key: string; init: RequestInit }[], key: string) {
  const call = calls.find((entry) => entry.key === key)
  return call ? JSON.parse(String(call.init.body)) : undefined
}

async function chooseCategory(name: string) {
  await userEvent.click(screen.getByRole("combobox", { name: /Chuyên mục/ }))
  await userEvent.click(await screen.findByRole("option", { name }))
}

async function insertContentImage() {
  await userEvent.click(screen.getByRole("button", { name: "Chèn ảnh" }))
  await userEvent.click(
    screen.getByRole("button", { name: "Chọn giả: Chèn ảnh vào bài viết" })
  )
}

function beforeUnloadPrevented(): boolean {
  const event = new Event("beforeunload", { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}

beforeEach(() => {
  toastSuccess.mockClear()
  toastError.mockClear()
  replace.mockClear()
  push.mockClear()
  setAccessToken("t1")
  auth = {
    user: { id: "u1", name: "Mỹ Duyên" },
    permissions: ["post.manage", "category.manage", "media.read", "media.upload"],
  }
})

describe("slugify", () => {
  it("bỏ dấu tiếng Việt, đ → d, ký tự khác → gạch ngang", () => {
    expect(slugify("Đăng ký học lái xe B2 — 2026!")).toBe(
      "dang-ky-hoc-lai-xe-b2-2026"
    )
  })
})

describe("AdminPostEditor", () => {
  it("Chèn ảnh lấy từ kho media: node img có mediaId, không có data: URL", async () => {
    const onChange = vi.fn()
    render(<AdminPostEditor value={[]} onChange={onChange} />)
    await insertContentImage()

    await waitFor(() => expect(onChange).toHaveBeenCalled())
    const value = onChange.mock.lastCall![0] as Value
    const image = value.find((node) => node.type === "img")
    expect(image).toMatchObject({
      type: "img",
      url: "https://cdn.example.com/2026/10/b.webp",
      mediaId: "m2",
    })
    expect(JSON.stringify(value)).not.toContain("data:")
  })
})

describe("PostEditorForm — tạo mới", () => {
  it("slug tự gợi ý theo tiêu đề, ngừng tự điền khi người dùng sửa slug", async () => {
    mockFetch({ "GET /categories": () => jsonResponse(200, { data: categories }) })
    renderWithClient(<PostEditorForm />)
    const title = screen.getByLabelText(/^Tiêu đề/)
    const slug = screen.getByLabelText("Slug")

    await userEvent.type(title, "Lịch thi đợt 1")
    expect(slug).toHaveValue("lich-thi-dot-1")
    await userEvent.clear(slug)
    await userEvent.type(slug, "lich-thi")
    await userEvent.type(title, "0")
    expect(slug).toHaveValue("lich-thi")
    expect(screen.getByLabelText("Tác giả")).toHaveValue("Mỹ Duyên")
  })

  it("thiếu chuyên mục, tiêu đề ngắn, chưa có nội dung → lỗi tại ô, Lưu nháp và Xuất bản không gọi API", async () => {
    const { calls } = mockFetch({
      "GET /categories": () => jsonResponse(200, { data: categories }),
    })
    renderWithClient(<PostEditorForm />)
    await userEvent.type(screen.getByLabelText(/^Tiêu đề/), "Abc")

    await userEvent.click(screen.getByRole("button", { name: "Xuất bản" }))
    expect(screen.getByText("Tiêu đề từ 5 đến 200 ký tự")).toBeInTheDocument()
    expect(screen.getByText("Chưa chọn chuyên mục")).toBeInTheDocument()
    expect(screen.getByText("Nhập nội dung bài viết")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Lưu nháp" }))

    expect(calls.map((call) => call.key)).toEqual(["GET /categories"])
  })

  it("Lưu nháp → POST /posts với ảnh bìa và ảnh nội dung từ kho → chuyển sang trang sửa", async () => {
    const { calls } = mockFetch({
      "GET /categories": () => jsonResponse(200, { data: categories }),
      "POST /posts": () => jsonResponse(201, { data: post({ id: "p9" }) }),
    })
    renderWithClient(<PostEditorForm />)
    await userEvent.type(screen.getByLabelText(/^Tiêu đề/), "Lịch thi tháng 11")
    await chooseCategory("Thông báo")
    await userEvent.type(screen.getByLabelText("Tag"), "Lịch Thi{Enter}")
    await userEvent.click(screen.getByRole("button", { name: "Chọn ảnh bìa" }))
    await userEvent.click(
      screen.getByRole("button", { name: "Chọn giả: Chọn ảnh bìa" })
    )
    expect(screen.getByRole("img", { name: "Sân tập" })).toBeInTheDocument()
    await insertContentImage()
    expect(beforeUnloadPrevented()).toBe(true)

    await userEvent.click(screen.getByRole("button", { name: "Lưu nháp" }))
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/admin/bai-viet/p9")
    )
    const body = bodyOf(calls, "POST /posts")
    expect(body).toMatchObject({
      title: "Lịch thi tháng 11",
      slug: "lich-thi-thang-11",
      categoryId: "c2",
      tags: ["lịch thi"],
      authorName: "Mỹ Duyên",
      cover: {
        url: "https://cdn.example.com/2026/10/a.webp",
        alt: "Sân tập",
        mediaId: "m1",
      },
      seo: null,
    })
    expect(body.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "img", mediaId: "m2" }),
      ])
    )
    expect(calls.some((call) => call.key.includes("publish"))).toBe(false)
    expect(toastSuccess).toHaveBeenCalledWith("Đã lưu bài viết")
    expect(beforeUnloadPrevented()).toBe(false)
  })
})

describe("PostEditorForm — sửa bài", () => {
  it("GET /posts/:id điền form; Xuất bản hẹn giờ → PATCH rồi POST publish +07:00", async () => {
    const { calls } = mockFetch({
      "GET /categories": () => jsonResponse(200, { data: categories }),
      "GET /posts/p1": () => jsonResponse(200, { data: post() }),
      "PATCH /posts/p1": () => jsonResponse(200, { data: post() }),
      "POST /posts/p1/publish": () =>
        jsonResponse(200, {
          data: post({
            status: "published",
            publishedAt: "2099-10-21T08:30:00+07:00",
          }),
        }),
    })
    renderWithClient(<PostEditorForm postId="p1" />)
    const title = await screen.findByLabelText(/^Tiêu đề/)
    expect(title).toHaveValue("Kinh nghiệm thi sa hình")
    expect(screen.getByLabelText("Slug")).toHaveValue("kinh-nghiem-thi-sa-hinh")
    expect(screen.getByLabelText("Tóm tắt")).toHaveValue("Tóm tắt")
    expect(screen.getByText("sa-hinh")).toBeInTheDocument()
    expect(screen.getByText("Nháp")).toBeInTheDocument()

    // Sửa tiêu đề không đổi slug của bài đã có
    await userEvent.type(title, " B2")
    expect(screen.getByLabelText("Slug")).toHaveValue("kinh-nghiem-thi-sa-hinh")

    await userEvent.type(
      screen.getByLabelText("Hẹn giờ xuất bản"),
      "2026-10-21T08:30"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Hẹn giờ xuất bản" })
    )

    await waitFor(() =>
      expect(bodyOf(calls, "POST /posts/p1/publish")).toEqual({
        publishedAt: "2026-10-21T08:30:00+07:00",
      })
    )
    const keys = calls.map((call) => call.key)
    expect(keys.indexOf("PATCH /posts/p1")).toBeLessThan(
      keys.indexOf("POST /posts/p1/publish")
    )
    expect(bodyOf(calls, "PATCH /posts/p1")).toMatchObject({
      title: "Kinh nghiệm thi sa hình B2",
      content,
    })
    expect(replace).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Đã xuất bản bài viết")
    )
    // Bài đã xuất bản (hẹn giờ): nút đổi sang Cập nhật / Gỡ xuất bản
    expect(
      await screen.findByRole("button", { name: "Cập nhật" })
    ).toBeInTheDocument()
    expect(screen.getByText("Hẹn giờ")).toBeInTheDocument()
  })

  it("bài đã xuất bản: Cập nhật, Gỡ xuất bản, Xem trên web", async () => {
    const { calls } = mockFetch({
      "GET /categories": () => jsonResponse(200, { data: categories }),
      "GET /posts/p1": () =>
        jsonResponse(200, {
          data: post({
            status: "published",
            publishedAt: "2026-09-01T08:00:00+07:00",
          }),
        }),
      "POST /posts/p1/unpublish": () => jsonResponse(200, { data: post() }),
    })
    renderWithClient(<PostEditorForm postId="p1" />)
    await screen.findByRole("button", { name: "Cập nhật" })
    // Mới mở, chưa sửa gì → không hỏi khi rời trang
    expect(beforeUnloadPrevented()).toBe(false)
    expect(screen.queryByRole("button", { name: "Xuất bản" })).toBeNull()
    expect(screen.queryByLabelText("Hẹn giờ xuất bản")).toBeNull()
    const view = screen.getByRole("link", { name: "Xem trên web" })
    expect(view).toHaveAttribute("href", "/dien-dan/kinh-nghiem-thi-sa-hinh")
    expect(view).toHaveAttribute("target", "_blank")

    await userEvent.click(screen.getByRole("button", { name: "Gỡ xuất bản" }))
    await waitFor(() =>
      expect(calls.some((call) => call.key === "POST /posts/p1/unpublish")).toBe(
        true
      )
    )
    expect(calls.some((call) => call.key === "PATCH /posts/p1")).toBe(false)
    expect(await screen.findByRole("button", { name: "Xuất bản" })).toBeEnabled()
  })

  it("lỗi 400 body.slug → hiện dưới ô Slug, form vẫn còn thay đổi chưa lưu", async () => {
    mockFetch({
      "GET /categories": () => jsonResponse(200, { data: categories }),
      "GET /posts/p1": () => jsonResponse(200, { data: post() }),
      "PATCH /posts/p1": () =>
        jsonResponse(400, {
          error: {
            code: "VALIDATION_ERROR",
            message: "Dữ liệu không hợp lệ",
            details: [{ path: "body.slug", message: "Slug đã được dùng" }],
          },
        }),
    })
    renderWithClient(<PostEditorForm postId="p1" />)
    const slug = await screen.findByLabelText("Slug")
    await userEvent.clear(slug)
    await userEvent.type(slug, "trung-slug")
    await userEvent.click(screen.getByRole("button", { name: "Lưu nháp" }))

    expect(await screen.findByText("Slug đã được dùng")).toBeInTheDocument()
    expect(slug).toHaveAttribute("aria-invalid", "true")
    expect(toastError).toHaveBeenCalled()
    expect(beforeUnloadPrevented()).toBe(true)
  })

  it("409 khi xuất bản → toast lỗi", async () => {
    mockFetch({
      "GET /categories": () => jsonResponse(200, { data: categories }),
      "GET /posts/p1": () => jsonResponse(200, { data: post() }),
      "PATCH /posts/p1": () => jsonResponse(200, { data: post() }),
      "POST /posts/p1/publish": () =>
        jsonResponse(409, {
          error: { code: "CONFLICT", message: "Không thể xuất bản bài viết" },
        }),
    })
    renderWithClient(<PostEditorForm postId="p1" />)
    await userEvent.click(await screen.findByRole("button", { name: "Xuất bản" }))
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Không thể xuất bản bài viết")
    )
    expect(toastError).toHaveBeenCalledTimes(1)
  })

  it("bài không tồn tại → thông báo", async () => {
    mockFetch({
      "GET /categories": () => jsonResponse(200, { data: categories }),
      "GET /posts/p404": () =>
        jsonResponse(404, {
          error: { code: "NOT_FOUND", message: "Không tìm thấy bài viết" },
        }),
    })
    renderWithClient(<PostEditorForm postId="p404" />)
    expect(
      await screen.findByText("Không tìm thấy bài viết")
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole("main")).getByRole("link", {
        name: "Về danh sách bài viết",
      })
    ).toHaveAttribute("href", "/admin/bai-viet")
  })
})
