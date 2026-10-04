import { act, render, screen, waitFor } from "@testing-library/react"
import { QueryClientProvider } from "@tanstack/react-query"
import { useEffect } from "react"
import { beforeEach, describe, expect, it } from "vitest"

import { AuthProvider, useAuth } from "@/components/admin/auth-provider"
import { makeQueryClient } from "@/components/providers/query-provider"
import {
  expireSession,
  getAccessToken,
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
const me = { data: { user, permissions: ["lead.read"] } }
const unauthorized = {
  error: { code: "UNAUTHORIZED", message: "Phiên hết hạn" },
}

let auth: ReturnType<typeof useAuth>

function Probe() {
  const value = useAuth()
  useEffect(() => {
    auth = value
  }, [value])
  return (
    <p>
      {value.status}|{value.user?.name ?? "-"}|{value.permissions.join(",")}|
      {value.signedOut ? "signedOut" : ""}
    </p>
  )
}

function renderAuth() {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  setAccessToken(null)
})

describe("AuthProvider", () => {
  it("refresh thành công → lấy /auth/me → authenticated", async () => {
    mockFetch({
      "POST /auth/refresh": () =>
        jsonResponse(200, { data: { accessToken: "t1", user } }),
      "GET /auth/me": () => jsonResponse(200, me),
    })
    renderAuth()
    expect(screen.getByText(/^loading/)).toBeInTheDocument()
    await screen.findByText("authenticated|Trần Mỹ Duyên|lead.read|")
    expect(getAccessToken()).toBe("t1")
  })

  it("refresh 401 → anonymous", async () => {
    mockFetch({ "POST /auth/refresh": () => jsonResponse(401, unauthorized) })
    renderAuth()
    await screen.findByText("anonymous|-||")
  })

  it("không tới được máy chủ → offline, retry thử lại", async () => {
    mockFetch({
      "POST /auth/refresh": [
        () => {
          throw new TypeError("Failed to fetch")
        },
        () => jsonResponse(200, { data: { accessToken: "t1", user } }),
      ],
      "GET /auth/me": () => jsonResponse(200, me),
    })
    renderAuth()
    await screen.findByText("offline|-||")
    act(() => auth.retry())
    await screen.findByText("authenticated|Trần Mỹ Duyên|lead.read|")
  })

  it("login lưu token và quyền", async () => {
    mockFetch({
      "POST /auth/refresh": () => jsonResponse(401, unauthorized),
      "POST /auth/login": (init) => {
        expect(JSON.parse(String(init.body))).toEqual({
          identifier: "duyen",
          password: "Matkhau123",
        })
        return jsonResponse(200, { data: { accessToken: "t2", user } })
      },
      "GET /auth/me": () => jsonResponse(200, me),
    })
    renderAuth()
    await screen.findByText("anonymous|-||")
    await act(() => auth.login("duyen", "Matkhau123"))
    expect(
      screen.getByText("authenticated|Trần Mỹ Duyên|lead.read|")
    ).toBeInTheDocument()
    expect(getAccessToken()).toBe("t2")
  })

  it("logout gọi API, xoá token, đánh dấu signedOut kể cả khi API lỗi", async () => {
    const { calls } = mockFetch({
      "POST /auth/refresh": () =>
        jsonResponse(200, { data: { accessToken: "t1", user } }),
      "GET /auth/me": () => jsonResponse(200, me),
      "POST /auth/logout": () => {
        throw new TypeError("Failed to fetch")
      },
    })
    renderAuth()
    await screen.findByText(/^authenticated/)
    await act(() => auth.logout())
    expect(screen.getByText("anonymous|-||signedOut")).toBeInTheDocument()
    expect(getAccessToken()).toBeNull()
    expect(calls.some((c) => c.key === "POST /auth/logout")).toBe(true)
  })

  it("đổi mật khẩu xong tự đăng nhập lại bằng username và mật khẩu mới", async () => {
    const { calls } = mockFetch({
      "POST /auth/refresh": () =>
        jsonResponse(200, { data: { accessToken: "t1", user } }),
      "GET /auth/me": () => jsonResponse(200, me),
      "POST /auth/change-password": () => jsonResponse(204),
      "POST /auth/login": (init) => {
        expect(JSON.parse(String(init.body))).toEqual({
          identifier: "duyen",
          password: "Moimatkhau1",
        })
        return jsonResponse(200, { data: { accessToken: "t3", user } })
      },
    })
    renderAuth()
    await screen.findByText(/^authenticated/)
    await act(() => auth.changePassword("Matkhau123", "Moimatkhau1"))
    expect(getAccessToken()).toBe("t3")
    expect(calls.map((c) => c.key)).toContain("POST /auth/change-password")
    expect(screen.getByText(/^authenticated/)).toBeInTheDocument()
  })

  it("hết phiên giữa chừng → anonymous (không signedOut)", async () => {
    mockFetch({
      "POST /auth/refresh": () =>
        jsonResponse(200, { data: { accessToken: "t1", user } }),
      "GET /auth/me": () => jsonResponse(200, me),
    })
    renderAuth()
    await screen.findByText(/^authenticated/)
    act(() => expireSession())
    await waitFor(() =>
      expect(screen.getByText("anonymous|-||")).toBeInTheDocument()
    )
  })
})
