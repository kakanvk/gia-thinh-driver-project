import { describe, expect, it } from "vitest"

import { API_URL, resolveApiUrl } from "@/lib/api/config"

describe("resolveApiUrl", () => {
  it("mặc định /api/v1 khi chưa cấu hình", () => {
    expect(resolveApiUrl(undefined)).toBe("/api/v1")
    expect(resolveApiUrl("")).toBe("/api/v1")
  })

  it("bỏ dấu / ở cuối", () => {
    expect(resolveApiUrl("https://api.giathinh.vn/api/v1/")).toBe(
      "https://api.giathinh.vn/api/v1"
    )
  })

  it("API_URL đọc từ NEXT_PUBLIC_API_URL", () => {
    expect(API_URL).toBe("/api/v1")
  })
})
