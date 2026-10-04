import { beforeEach, describe, expect, it, vi } from "vitest"

import { apiData, apiFetch, buildUrl } from "@/lib/api/client"
import { ApiError } from "@/lib/api/errors"
import {
  getAccessToken,
  onSessionExpired,
  setAccessToken,
} from "@/lib/api/session"
import { jsonResponse, mockFetch } from "@/test/fetch-mock"

const user = {
  id: "u1",
  name: "Trần Mỹ Duyên",
  username: "duyen",
  phone: "0779666664",
  role: "consultant",
  branchIds: [],
  status: "active",
}

function bearer(init: RequestInit) {
  return new Headers(init.headers).get("Authorization")
}

beforeEach(() => {
  setAccessToken(null)
})

describe("buildUrl", () => {
  it("ghép API_URL và bỏ query rỗng", () => {
    expect(
      buildUrl("/leads", {
        page: 2,
        q: "",
        status: undefined,
        mine: false,
        x: null,
      })
    ).toBe("/api/v1/leads?page=2&mine=false")
    expect(buildUrl("/leads")).toBe("/api/v1/leads")
  })
})

describe("apiFetch", () => {
  it("gắn Bearer, gửi JSON và credentials include", async () => {
    setAccessToken("t1")
    const { calls } = mockFetch({
      "POST /leads": (init) => {
        expect(bearer(init)).toBe("Bearer t1")
        expect(new Headers(init.headers).get("Content-Type")).toBe(
          "application/json"
        )
        expect(init.body).toBe(JSON.stringify({ name: "A" }))
        return jsonResponse(201, { data: { id: "l1" } })
      },
    })
    await expect(
      apiData("/leads", { method: "POST", body: { name: "A" } })
    ).resolves.toEqual({
      id: "l1",
    })
    expect(calls[0].init.credentials).toBe("include")
  })

  it("FormData gửi nguyên, không đặt Content-Type", async () => {
    setAccessToken("t1")
    const form = new FormData()
    form.append("alt", "ảnh")
    mockFetch({
      "POST /media": (init) => {
        expect(init.body).toBe(form)
        expect(new Headers(init.headers).has("Content-Type")).toBe(false)
        return jsonResponse(201, { data: { id: "m1" } })
      },
    })
    await apiFetch("/media", { method: "POST", body: form })
  })

  it("204 trả undefined", async () => {
    setAccessToken("t1")
    mockFetch({ "DELETE /leads/l1": () => jsonResponse(204) })
    await expect(
      apiFetch("/leads/l1", { method: "DELETE" })
    ).resolves.toBeUndefined()
  })

  it("401 → refresh một lần → gửi lại với token mới", async () => {
    setAccessToken("old")
    const { calls } = mockFetch({
      "GET /auth/me": (init) =>
        bearer(init) === "Bearer new"
          ? jsonResponse(200, { data: { ok: true } })
          : jsonResponse(401, {
              error: { code: "UNAUTHORIZED", message: "Hết hạn" },
            }),
      "POST /auth/refresh": () =>
        jsonResponse(200, { data: { accessToken: "new", user } }),
    })
    await expect(apiData("/auth/me")).resolves.toEqual({ ok: true })
    expect(calls.map((c) => c.key)).toEqual([
      "GET /auth/me",
      "POST /auth/refresh",
      "GET /auth/me",
    ])
    expect(getAccessToken()).toBe("new")
  })

  it("nhiều request 401 cùng lúc chỉ refresh một lần", async () => {
    setAccessToken("old")
    let refreshes = 0
    const { calls } = mockFetch({
      "GET /x": (init) =>
        bearer(init) === "Bearer new"
          ? jsonResponse(200, { data: 1 })
          : jsonResponse(401, {
              error: { code: "UNAUTHORIZED", message: "Hết hạn" },
            }),
      "POST /auth/refresh": async () => {
        refreshes += 1
        await new Promise((resolve) => setTimeout(resolve, 10))
        return jsonResponse(200, { data: { accessToken: "new", user } })
      },
    })
    const results = await Promise.all([
      apiData("/x"),
      apiData("/x"),
      apiData("/x"),
    ])
    expect(results).toEqual([1, 1, 1])
    expect(refreshes).toBe(1)
    expect(calls.filter((c) => c.key === "GET /x")).toHaveLength(6)
  })

  it("refresh thất bại → báo hết phiên và ném 401", async () => {
    setAccessToken("old")
    const expired = vi.fn()
    const off = onSessionExpired(expired)
    mockFetch({
      "GET /x": () =>
        jsonResponse(401, {
          error: { code: "UNAUTHORIZED", message: "Hết hạn" },
        }),
      "POST /auth/refresh": () =>
        jsonResponse(401, {
          error: { code: "UNAUTHORIZED", message: "Phiên hết hạn" },
        }),
    })
    await expect(apiFetch("/x")).rejects.toMatchObject({ status: 401 })
    expect(expired).toHaveBeenCalledTimes(1)
    expect(getAccessToken()).toBeNull()
    off()
  })

  it("gửi lại vẫn 401 → báo hết phiên, không refresh lần hai", async () => {
    setAccessToken("old")
    const expired = vi.fn()
    const off = onSessionExpired(expired)
    const { calls } = mockFetch({
      "GET /x": () =>
        jsonResponse(401, {
          error: { code: "UNAUTHORIZED", message: "Hết hạn" },
        }),
      "POST /auth/refresh": () =>
        jsonResponse(200, { data: { accessToken: "new", user } }),
    })
    await expect(apiFetch("/x")).rejects.toMatchObject({ status: 401 })
    expect(calls.filter((c) => c.key === "POST /auth/refresh")).toHaveLength(1)
    expect(expired).toHaveBeenCalledTimes(1)
    off()
  })

  it("không refresh cho /auth/login và khi chưa có token", async () => {
    const { calls } = mockFetch({
      "POST /auth/login": () =>
        jsonResponse(401, {
          error: {
            code: "UNAUTHORIZED",
            message: "Tài khoản hoặc mật khẩu không đúng",
          },
        }),
      "GET /x": () =>
        jsonResponse(401, {
          error: { code: "UNAUTHORIZED", message: "Cần đăng nhập" },
        }),
    })
    await expect(
      apiFetch("/auth/login", {
        method: "POST",
        body: { identifier: "a", password: "b" },
      })
    ).rejects.toMatchObject({
      status: 401,
      message: "Tài khoản hoặc mật khẩu không đúng",
    })
    await expect(apiFetch("/x")).rejects.toMatchObject({ status: 401 })
    expect(calls.map((c) => c.key)).toEqual(["POST /auth/login", "GET /x"])
  })

  it("request khác đã refresh xong → gửi lại bằng token hiện tại, không refresh nữa", async () => {
    setAccessToken("old")
    const { calls } = mockFetch({
      "GET /x": [
        () => {
          setAccessToken("new")
          return jsonResponse(401, {
            error: { code: "UNAUTHORIZED", message: "Hết hạn" },
          })
        },
        (init) => {
          expect(bearer(init)).toBe("Bearer new")
          return jsonResponse(200, { data: 1 })
        },
      ],
    })
    await expect(apiData("/x")).resolves.toBe(1)
    expect(calls.map((c) => c.key)).toEqual(["GET /x", "GET /x"])
  })

  it("lỗi mạng → ApiError status 0", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    )
    await expect(apiFetch("/x")).rejects.toMatchObject({
      status: 0,
      code: "NETWORK_ERROR",
    })
  })

  it("ném ApiError với chi tiết của backend", async () => {
    setAccessToken("t1")
    mockFetch({
      "POST /leads": () =>
        jsonResponse(400, {
          error: {
            code: "VALIDATION_ERROR",
            message: "Dữ liệu không hợp lệ",
            details: [{ path: "body.phone", message: "Sai" }],
          },
        }),
    })
    const error = await apiFetch<never>("/leads", {
      method: "POST",
      body: {},
    }).catch((e: ApiError) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.details).toEqual([{ path: "body.phone", message: "Sai" }])
  })

  it("refresh chạy trong navigator.locks khi trình duyệt hỗ trợ", async () => {
    setAccessToken("old")
    const request = vi.fn((_name: string, callback: () => Promise<unknown>) =>
      callback()
    )
    Object.defineProperty(navigator, "locks", {
      value: { request },
      configurable: true,
    })
    mockFetch({
      "GET /x": (init) =>
        bearer(init) === "Bearer new"
          ? jsonResponse(200, { data: 1 })
          : jsonResponse(401, {
              error: { code: "UNAUTHORIZED", message: "Hết hạn" },
            }),
      "POST /auth/refresh": () =>
        jsonResponse(200, { data: { accessToken: "new", user } }),
    })
    await apiData("/x")
    expect(request).toHaveBeenCalledWith("gt-refresh", expect.any(Function))
    Reflect.deleteProperty(navigator, "locks")
  })
})
