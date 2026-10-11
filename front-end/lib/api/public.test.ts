import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  getAllPosts,
  getPost,
  getRelatedPosts,
  getSiteContact,
  PublicApiError,
  publicGet,
  publicGetOrNull,
} from "@/lib/api/public"
import { jsonResponse } from "@/test/fetch-mock"

const post = (slug: string, category: string | null = "kinh-nghiem") => ({
  slug,
  title: slug,
  excerpt: "",
  cover: null,
  tags: [],
  authorName: "Gia Thịnh",
  publishedAt: "2026-10-01T08:00:00+07:00",
  readTimeMinutes: 3,
  views: 0,
  category: category ? { name: category, slug: category, isAnnouncement: false } : null,
})

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.stubEnv("API_ORIGIN", "http://api.test/")
  vi.spyOn(console, "error").mockImplementation(() => undefined)
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("publicGet", () => {
  it("gọi API_ORIGIN/api/v1/public với ISR 300 giây và trả data", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: [{ slug: "a" }] }))
    await expect(publicGet("/branches", { branch: "tan-ngai", empty: "", none: undefined })).resolves.toEqual([
      { slug: "a" },
    ])
    expect(fetchMock).toHaveBeenCalledWith("http://api.test/api/v1/public/branches?branch=tan-ngai", {
      next: { revalidate: 300 },
    })
  })

  it("lỗi HTTP → PublicApiError có status", async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { error: { code: "X", message: "x" } }))
    await expect(publicGet("/settings")).rejects.toMatchObject({ status: 503 })
  })

  it("lỗi mạng hoặc thiếu API_ORIGIN → status 0", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"))
    await expect(publicGet("/settings")).rejects.toMatchObject({ status: 0 })
    vi.stubEnv("API_ORIGIN", "")
    const error = await publicGet("/settings").catch((e: unknown) => e)
    expect(error).toBeInstanceOf(PublicApiError)
    expect(error).toMatchObject({ status: 0 })
  })

  it("publicGetOrNull nuốt lỗi", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"))
    await expect(publicGetOrNull("/settings")).resolves.toBeNull()
  })
})

describe("các hàm lấy dữ liệu", () => {
  it("getSiteContact dùng mặc định khi API lỗi", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, {}))
    await expect(getSiteContact()).resolves.toMatchObject({ hotline: "0779 666 664" })
  })

  it("getPost: 404 → null, 5xx → ném lỗi", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { error: { code: "NOT_FOUND", message: "x" } }))
    await expect(getPost("khong-co")).resolves.toBeNull()
    fetchMock.mockResolvedValueOnce(jsonResponse(502, {}))
    await expect(getPost("bai")).rejects.toMatchObject({ status: 502 })
  })

  it("getAllPosts gom các trang tới total, tối đa maxPages", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { data: [post("a"), post("b")], meta: { page: 1, limit: 50, total: 3 } }))
      .mockResolvedValueOnce(jsonResponse(200, { data: [post("c")], meta: { page: 2, limit: 50, total: 3 } }))
    const all = await getAllPosts()
    expect(all?.map((p) => p.slug)).toEqual(["a", "b", "c"])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1][0])).toContain("page=2")
  })

  it("getAllPosts: trang đầu lỗi → null; trang sau lỗi → giữ phần đã có", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, {}))
    await expect(getAllPosts()).resolves.toBeNull()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { data: [post("a")], meta: { page: 1, limit: 1, total: 2 } }))
      .mockResolvedValueOnce(jsonResponse(500, {}))
    await expect(getAllPosts()).resolves.toHaveLength(1)
  })

  it("getRelatedPosts bỏ bài hiện tại, tối đa 4", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { data: ["x", "a", "b", "c", "d"].map((s) => post(s)), meta: { page: 1, limit: 5, total: 5 } })
    )
    const related = await getRelatedPosts("kinh-nghiem", "x")
    expect(related.map((p) => p.slug)).toEqual(["a", "b", "c", "d"])
    expect(String(fetchMock.mock.calls[0][0])).toContain("category=kinh-nghiem")
  })
})
