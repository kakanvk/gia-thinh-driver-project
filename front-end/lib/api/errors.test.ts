import { describe, expect, it } from "vitest"

import {
  ApiError,
  errorMessage,
  fieldErrors,
  parseRetryAfter,
  toApiError,
} from "@/lib/api/errors"
import { jsonResponse } from "@/test/fetch-mock"

describe("toApiError", () => {
  it("đọc { error } của backend", async () => {
    const error = await toApiError(
      jsonResponse(400, {
        error: {
          code: "VALIDATION_ERROR",
          message: "Dữ liệu không hợp lệ",
          details: [{ path: "body.phone", message: "Sai định dạng" }],
        },
      })
    )
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Dữ liệu không hợp lệ",
      details: [{ path: "body.phone", message: "Sai định dạng" }],
    })
  })

  it("body không phải JSON vẫn ra ApiError", async () => {
    const error = await toApiError(new Response("Bad Gateway", { status: 502 }))
    expect(error).toMatchObject({
      status: 502,
      code: "SERVER_ERROR",
      details: [],
    })
  })

  it("429 lấy thời gian chờ từ header RateLimit", async () => {
    const error = await toApiError(
      jsonResponse(
        429,
        { error: { code: "RATE_LIMITED", message: "Quá nhiều lần" } },
        { RateLimit: "limit=5, remaining=0, reset=875" }
      )
    )
    expect(error.retryAfterSec).toBe(875)
  })
})

describe("parseRetryAfter", () => {
  it("đọc Retry-After khi không có RateLimit", () => {
    expect(parseRetryAfter(new Headers({ "Retry-After": "120" }))).toBe(120)
    expect(parseRetryAfter(new Headers())).toBeUndefined()
  })
})

describe("fieldErrors", () => {
  it("bỏ tiền tố body./query./params. và giữ lỗi đầu tiên mỗi trường", () => {
    expect(
      fieldErrors([
        { path: "body.phone", message: "Sai định dạng" },
        { path: "body.phone", message: "Lỗi thứ hai" },
        { path: "query.month", message: "Thiếu tháng" },
        { path: "body.address.city", message: "Thiếu" },
      ])
    ).toEqual({
      phone: "Sai định dạng",
      month: "Thiếu tháng",
      "address.city": "Thiếu",
    })
    expect(fieldErrors(undefined)).toEqual({})
  })
})

describe("errorMessage", () => {
  it("thông báo theo mã lỗi", () => {
    expect(errorMessage(new ApiError(403, "FORBIDDEN", "x"))).toBe(
      "Bạn không có quyền thực hiện thao tác này"
    )
    expect(errorMessage(new ApiError(429, "RATE_LIMITED", "x", [], 875))).toBe(
      "Thao tác quá nhiều lần, thử lại sau 15 phút"
    )
    expect(errorMessage(new ApiError(429, "RATE_LIMITED", "x"))).toBe(
      "Thao tác quá nhiều lần, thử lại sau 1 phút"
    )
    expect(errorMessage(new ApiError(0, "NETWORK_ERROR", "x"))).toBe(
      "Không kết nối được máy chủ, vui lòng thử lại"
    )
    expect(errorMessage(new ApiError(500, "SERVER_ERROR", "x"))).toBe(
      "Không kết nối được máy chủ, vui lòng thử lại"
    )
    expect(errorMessage(new ApiError(409, "CONFLICT", "Slug đã tồn tại"))).toBe(
      "Slug đã tồn tại"
    )
    expect(errorMessage(new Error("boom"))).toBe(
      "Đã có lỗi xảy ra, vui lòng thử lại"
    )
  })
})
