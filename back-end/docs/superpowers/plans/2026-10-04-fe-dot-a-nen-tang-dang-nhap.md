# Front-end đợt A — Nền tảng gọi API và đăng nhập admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nhân viên đăng nhập vào `/admin` của front-end Next.js bằng tài khoản backend thật, giữ phiên qua tải lại trang và hết hạn token, thấy menu đúng quyền, tự sửa hồ sơ/đổi mật khẩu, đăng xuất.

**Architecture:** Client-side auth: access token trong bộ nhớ (`lib/api/session.ts`), cookie `gt_refresh` httpOnly do trình duyệt giữ; `apiFetch` tự refresh một lần (single-flight + Web Locks) khi gặp 401. `AuthProvider` + TanStack Query bọc `app/admin`; `AdminGuard` trong route group `(panel)` chặn trang theo bảng quyền `lib/auth/routes.ts`. Địa chỉ API qua `NEXT_PUBLIC_API_URL` (mặc định `/api/v1`, đi qua `rewrites` tới `API_ORIGIN`).

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript strict, Tailwind 4, shadcn (`base-nova`), `@tanstack/react-query` v5, `sonner`, Vitest + jsdom + Testing Library. Backend Express 5 (`back-end/`).

**Spec:** `back-end/docs/superpowers/specs/2026-10-04-fe-dot-a-nen-tang-dang-nhap-design.md`

## Global Constraints

- Code front-end nằm trong `front-end/`; mọi lệnh npm của front-end chạy trong `front-end/`, của backend trong `back-end/`.
- Theo `front-end/AGENT.md`: mặc định Server Component, chỉ `"use client"` khi cần state/effect/event/browser API; dữ liệu dùng chung ở `lib/`; không sửa `.next/`, `node_modules/`, `cpanel-deploy/`, `next-env.d.ts`; giữ nguyên block quy tắc trong `AGENTS.md`.
- Next.js 16 khác bản cũ: trước khi dùng API framework mới, đọc `front-end/node_modules/next/dist/docs/` (vd. `01-app/03-api-reference/05-config/01-next-config-js/rewrites.md`).
- Style code front-end: không dấu chấm phẩy, nháy kép, 2 space (giống code hiện có). **Không chạy prettier cho cả project** — chỉ định dạng file mình sửa nếu cần (`npx prettier --write <file>`).
- Access token **chỉ ở bộ nhớ**, không ghi `localStorage`/`sessionStorage`/cookie đọc được.
- Mọi request gửi `credentials: "include"`.
- Không refresh cho chính `/auth/login`, `/auth/refresh`, `/auth/logout`.
- Khoá Web Locks tên `"gt-refresh"`.
- `next` chỉ nhận đường dẫn `/admin` hoặc `/admin/...`, không bắt đầu `//` hoặc `/\`, không phải `/admin/dang-nhap`.
- Nhãn vai trò: `super_admin` Quản trị viên, `branch_manager` Quản lý chi nhánh, `consultant` Tư vấn viên, `editor` Biên tập viên, `instructor` Giáo viên.
- Thông báo lỗi: 403 "Bạn không có quyền thực hiện thao tác này"; 429 "Thao tác quá nhiều lần, thử lại sau N phút"; 0/5xx "Không kết nối được máy chủ, vui lòng thử lại".
- Nội dung các trang admin hiện có (mock `lib/admin-data.ts`) **giữ nguyên** trong đợt này.
- Không commit `.env`, chỉ `.env.example` với giá trị mẫu. Commit kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Backend tắt/không tới được khi mở `/admin` → hiện "Không kết nối được máy chủ" + nút "Thử lại", **không** đá về trang đăng nhập (test ở Task 5 và Task 6).
2. Mở `/admin/dang-nhap` khi phiên còn hợp lệ (tab khác vừa đăng nhập) → vào thẳng admin, không bắt đăng nhập lại (test ở Task 7).
3. `next` bị sửa tay: `//evil.com`, `/administrator`, `/admin/dang-nhap`, `https://evil.com` → bỏ qua, về trang mặc định (test ở Task 4).
4. Token hết hạn khi trang có nhiều query song song → đúng một lần refresh, mọi query đều thành công (test ở Task 3).
5. Vai trò không có `dashboard.read` (editor, instructor) mở `/admin` → chuyển tới mục đầu tiên được phép, không kẹt ở trang trắng hoặc màn "Không có quyền" (test ở Task 6).

---

## File Structure

| File | Trách nhiệm |
|---|---|
| `back-end/src/app.ts` (sửa) | `cors({ ..., maxAge: 600 })` |
| `back-end/tests/integration/cors.test.ts` (mới) | Test preflight có `Access-Control-Max-Age: 600` |
| `back-end/README.md` (sửa) | Mục cấu hình khi chạy cùng front-end |
| `front-end/package.json` (sửa) | Phụ thuộc mới, script `test` |
| `front-end/vitest.config.ts`, `front-end/vitest.setup.ts` (mới) | Cấu hình test |
| `front-end/test/fetch-mock.ts` (mới) | Helper giả `fetch` cho test |
| `front-end/next.config.ts` (sửa) | `rewrites` tới `API_ORIGIN` |
| `front-end/.env.example`, `front-end/.gitignore` (mới/sửa) | Biến môi trường mẫu |
| `front-end/lib/api/config.ts` | `API_URL` |
| `front-end/lib/api/errors.ts` | `ApiError`, `toApiError`, `parseRetryAfter`, `fieldErrors`, `errorMessage` |
| `front-end/lib/api/session.ts` | Token bộ nhớ, `refreshSession` (single-flight + lock), sự kiện hết phiên |
| `front-end/lib/api/client.ts` | `apiFetch`, `apiData`, `buildUrl` |
| `front-end/lib/auth/permissions.ts` | `Role`, `hasPermission` |
| `front-end/lib/auth/user.ts` | `SessionUser`, `ROLE_LABELS`, `initials` |
| `front-end/lib/auth/routes.ts` | Bảng quyền route, `routeFor`, `canAccess`, `firstAllowedPath`, `safeNext`, `loginUrl`, `LOGIN_PATH` |
| `front-end/components/ui/sonner.tsx` | `Toaster` |
| `front-end/components/providers/query-provider.tsx` | `QueryClient` + toast lỗi mutation |
| `front-end/components/admin/auth-provider.tsx` | Trạng thái phiên, `useAuth` |
| `front-end/components/admin/admin-status.tsx` | Màn chờ (skeleton khung admin)/mất kết nối/không có quyền |
| `front-end/components/admin/admin-guard.tsx` | Chặn đăng nhập + quyền, bọc `AdminShell` |
| `front-end/components/admin/admin-shell.tsx` (sửa) | Menu theo quyền, header người dùng thật, đăng xuất |
| `front-end/app/admin/layout.tsx` (sửa) | Metadata + providers |
| `front-end/app/admin/(panel)/layout.tsx` (mới) | `AdminGuard` |
| `front-end/app/admin/(panel)/**` (di chuyển) | Các trang admin hiện có |
| `front-end/components/admin/login-form.tsx`, `front-end/app/admin/dang-nhap/page.tsx` | Trang đăng nhập |
| `front-end/components/admin/account-forms.tsx`, `front-end/app/admin/(panel)/tai-khoan/page.tsx` | Trang tài khoản |

Test đặt cạnh file nguồn: `lib/api/client.test.ts`, `components/admin/login-form.test.tsx`, …

---

### Task 1: Backend — cache preflight CORS và tài liệu cấu hình

**Files:**
- Modify: `back-end/src/app.ts:24`
- Create: `back-end/tests/integration/cors.test.ts`
- Modify: `back-end/README.md` (thêm mục trước `## Lưu ảnh trên Google Cloud Storage`)

**Interfaces:**
- Consumes: none
- Produces: backend trả `Access-Control-Max-Age: 600` cho preflight từ origin trong `CORS_ORIGINS`.

- [ ] **Step 1: Write the failing test** — `back-end/tests/integration/cors.test.ts`

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

describe('CORS', () => {
  it('preflight từ origin hợp lệ được cache 10 phút và cho gửi cookie', async () => {
    const res = await request(createApp())
      .options('/api/v1/auth/me')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-max-age']).toBe('600');
  });

  it('không trả allow-origin cho origin lạ', async () => {
    const res = await request(createApp())
      .options('/api/v1/auth/me')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (trong `back-end/`): `npx vitest run tests/integration/cors.test.ts`
Expected: FAIL ở `access-control-max-age` (`undefined` khác `'600'`).

- [ ] **Step 3: Implement** — `back-end/src/app.ts` dòng 24 đổi thành:

```ts
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: true, maxAge: 600 }));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/cors.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: README** — thêm vào `back-end/README.md` ngay trước dòng `## Lưu ảnh trên Google Cloud Storage`:

```markdown
## Chạy cùng front-end

Front-end (`front-end/`) gọi API theo `NEXT_PUBLIC_API_URL`:

- **Dev / preview Vercel** (`NEXT_PUBLIC_API_URL=/api/v1`): Next.js chuyển tiếp `/api/v1/*` và `/uploads/*` tới `API_ORIGIN` (dev: `http://localhost:4000`). Không cần CORS; backend thấy IP của máy chạy Next nên giới hạn đăng nhập tính chung.
- **Production** (`NEXT_PUBLIC_API_URL=https://api.giathinh.vn/api/v1`): trình duyệt gọi thẳng backend. Cấu hình backend:
  - `CORS_ORIGINS=https://giathinh.vn,https://www.giathinh.vn`
  - `TRUST_PROXY=1` khi chạy sau nginx (nginx gắn `X-Forwarded-For`), để giới hạn đăng nhập tính theo IP người dùng.
  - `COOKIE_DOMAIN` để trống (cookie `gt_refresh` thuộc `api.giathinh.vn`; `giathinh.vn` và `api.giathinh.vn` cùng site nên trình duyệt vẫn gửi).
- Preflight CORS được trình duyệt cache 10 phút (`Access-Control-Max-Age: 600`).
```

- [ ] **Step 6: Full backend check**

Run (trong `back-end/`): `npm run typecheck && npm run lint && npm test`
Expected: tất cả PASS.

- [ ] **Step 7: Commit**

```bash
git add back-end/src/app.ts back-end/tests/integration/cors.test.ts back-end/README.md
git commit -m "feat(be): cache preflight CORS 10 phút, ghi chú cấu hình chạy cùng front-end

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Front-end — công cụ test, phụ thuộc, cấu hình địa chỉ API

**Files:**
- Modify: `front-end/package.json` (qua `npm install`, `npm pkg set`)
- Create: `front-end/vitest.config.ts`, `front-end/vitest.setup.ts`, `front-end/test/fetch-mock.ts`
- Modify: `front-end/next.config.ts`
- Create: `front-end/.env.example`; Modify: `front-end/.gitignore`
- Create: `front-end/lib/api/config.ts`, `front-end/lib/api/config.test.ts`
- Create: `front-end/components/ui/sonner.tsx`

**Interfaces:**
- Consumes: none
- Produces:
  - `API_URL: string` từ `@/lib/api/config` (không có `/` cuối; mặc định `"/api/v1"`), `resolveApiUrl(value: string | undefined): string`.
  - `jsonResponse(status: number, body?: unknown, headers?: Record<string, string>): Response` và `mockFetch(handlers: Record<string, Handler | Handler[]>): { fn, calls }` từ `@/test/fetch-mock`; khoá handler dạng `"POST /auth/refresh"` (đường dẫn đã bỏ tiền tố `/api/v1`). `calls: { key: string; init: RequestInit }[]`.
  - `Toaster` từ `@/components/ui/sonner`.
  - Lệnh `npm test` (vitest run).

- [ ] **Step 1: Install dependencies** (trong `front-end/`)

```bash
npm install @tanstack/react-query sonner
npm install -D vitest jsdom @vitejs/plugin-react @testing-library/react @testing-library/dom @testing-library/user-event @testing-library/jest-dom
npm pkg set scripts.test="vitest run"
```

- [ ] **Step 2: Vitest config** — `front-end/vitest.config.ts`

```ts
import react from "@vitejs/plugin-react"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**", "cpanel-deploy/**"],
    env: { NEXT_PUBLIC_API_URL: "/api/v1" },
  },
})
```

`front-end/vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
```

- [ ] **Step 3: Fetch helper** — `front-end/test/fetch-mock.ts`

```ts
import { vi } from "vitest"

type Handler = (init: RequestInit) => Response | Promise<Response>

export function jsonResponse(
  status: number,
  body?: unknown,
  headers: Record<string, string> = {}
): Response {
  if (body === undefined) return new Response(null, { status, headers })
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  })
}

export function mockFetch(handlers: Record<string, Handler | Handler[]>) {
  const calls: { key: string; init: RequestInit }[] = []
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), "http://localhost")
    const key = `${init.method ?? "GET"} ${url.pathname.replace(/^\/api\/v1/, "")}`
    calls.push({ key, init })
    const entry = handlers[key]
    const handler = Array.isArray(entry) ? entry.shift() : entry
    if (!handler) throw new Error(`Không có handler cho ${key}`)
    return handler(init)
  })
  vi.stubGlobal("fetch", fn)
  return { fn, calls }
}
```

- [ ] **Step 4: Write the failing test** — `front-end/lib/api/config.test.ts`

```ts
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
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npx vitest run lib/api/config.test.ts`
Expected: FAIL — không tìm thấy module `@/lib/api/config`.

- [ ] **Step 6: Implement** — `front-end/lib/api/config.ts`

```ts
export function resolveApiUrl(value: string | undefined): string {
  return (value || "/api/v1").replace(/\/+$/, "")
}

// NEXT_PUBLIC_* được Next.js thay giá trị lúc build
export const API_URL = resolveApiUrl(process.env.NEXT_PUBLIC_API_URL)
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run lib/api/config.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Rewrites** — `front-end/next.config.ts` (thay toàn bộ file):

```ts
import type { NextConfig } from "next"

// Đích chuyển tiếp /api/v1/* và /uploads/* (dev, preview). Production gọi thẳng NEXT_PUBLIC_API_URL.
const apiOrigin = process.env.API_ORIGIN?.replace(/\/+$/, "")

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
  async rewrites() {
    if (!apiOrigin) return []
    return [
      { source: "/api/v1/:path*", destination: `${apiOrigin}/api/v1/:path*` },
      { source: "/uploads/:path*", destination: `${apiOrigin}/uploads/:path*` },
    ]
  },
}

export default nextConfig
```

- [ ] **Step 9: Env example** — `front-end/.env.example`:

```bash
# Địa chỉ gốc API mà trình duyệt gọi.
# Dev / preview Vercel: /api/v1 (đi qua rewrites tới API_ORIGIN, không cần CORS)
# Production: https://api.giathinh.vn/api/v1 (gọi thẳng, backend cần CORS_ORIGINS)
NEXT_PUBLIC_API_URL=/api/v1

# Đích chuyển tiếp /api/v1/* và /uploads/* khi NEXT_PUBLIC_API_URL là đường dẫn tương đối
# Dev: http://localhost:4000 · Preview: https://api.giathinh.vn
API_ORIGIN=http://localhost:4000
```

Trong `front-end/.gitignore`, ngay dưới dòng `.env*` thêm:

```
!.env.example
```

Rồi tạo `.env.local` cho máy dev (không commit): `cp .env.example .env.local`.

- [ ] **Step 10: Toaster** — `front-end/components/ui/sonner.tsx`

```tsx
"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"

export function Toaster(props: ToasterProps) {
  return <Sonner position="top-right" richColors closeButton {...props} />
}
```

- [ ] **Step 11: Verify**

Run (trong `front-end/`): `npm test && npm run typecheck && npm run lint && git status --short`
Expected: test PASS; typecheck, lint không lỗi; `git status` có `.env.example` và **không** có `.env.local`.

- [ ] **Step 12: Commit**

```bash
git add front-end/package.json front-end/package-lock.json front-end/vitest.config.ts front-end/vitest.setup.ts front-end/test/fetch-mock.ts front-end/next.config.ts front-end/.env.example front-end/.gitignore front-end/lib/api/config.ts front-end/lib/api/config.test.ts front-end/components/ui/sonner.tsx
git commit -m "feat(fe): cấu hình địa chỉ API, rewrites, Vitest và Toaster

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Lớp gọi API — lỗi, phiên, `apiFetch`

**Files:**
- Create: `front-end/lib/api/errors.ts`, `front-end/lib/api/errors.test.ts`
- Create: `front-end/lib/auth/user.ts` (chỉ kiểu `SessionUser` ở task này; `ROLE_LABELS`, `initials` thêm ở Task 4)
- Create: `front-end/lib/auth/permissions.ts` (chỉ kiểu `Role` ở task này; `hasPermission` thêm ở Task 4)
- Create: `front-end/lib/api/session.ts`, `front-end/lib/api/client.ts`, `front-end/lib/api/client.test.ts`

**Interfaces:**
- Consumes: `API_URL` (Task 2), `mockFetch`, `jsonResponse` (Task 2).
- Produces:
  - `type ErrorDetail = { path: string; message: string }`
  - `class ApiError extends Error { status: number; code: string; details: ErrorDetail[]; retryAfterSec?: number }` — `status: 0` + `code: "NETWORK_ERROR"` khi không tới được máy chủ.
  - `toApiError(res: Response): Promise<ApiError>`, `parseRetryAfter(headers: Headers): number | undefined`
  - `fieldErrors(details: ErrorDetail[] | undefined): Record<string, string>`, `errorMessage(error: unknown): string`
  - `type Role = "super_admin" | "branch_manager" | "consultant" | "editor" | "instructor"` (`@/lib/auth/permissions`)
  - `type SessionUser = { id: string; name: string; username: string; phone: string; role: Role; branchIds: string[]; status: string }` (`@/lib/auth/user`)
  - Session (`@/lib/api/session`): `getAccessToken(): string | null`, `setAccessToken(token: string | null): void`, `type RefreshResult = { accessToken: string; user: SessionUser }`, `refreshSession(): Promise<RefreshResult | null>` (null = phiên hết hạn; ném `ApiError` status 0/5xx khi máy chủ không phản hồi), `onSessionExpired(listener: () => void): () => void`, `expireSession(): void`.
  - Client (`@/lib/api/client`): `type ApiRequest = { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown; query?: Record<string, string | number | boolean | null | undefined>; signal?: AbortSignal }`, `buildUrl(path: string, query?: ApiRequest["query"]): string`, `apiFetch<T>(path: string, request?: ApiRequest): Promise<T>`, `apiData<T>(path: string, request?: ApiRequest): Promise<T>`.

- [ ] **Step 1: Write the failing test** — `front-end/lib/api/errors.test.ts`

```ts
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
    expect(error).toMatchObject({ status: 502, code: "SERVER_ERROR", details: [] })
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
    ).toEqual({ phone: "Sai định dạng", month: "Thiếu tháng", "address.city": "Thiếu" })
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
    expect(errorMessage(new Error("boom"))).toBe("Đã có lỗi xảy ra, vui lòng thử lại")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/api/errors.test.ts`
Expected: FAIL — không tìm thấy module `@/lib/api/errors`.

- [ ] **Step 3: Implement** — `front-end/lib/api/errors.ts`

```ts
export type ErrorDetail = { path: string; message: string }

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: ErrorDetail[] = [],
    public retryAfterSec?: number
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export function networkError(): ApiError {
  return new ApiError(0, "NETWORK_ERROR", "Không kết nối được máy chủ")
}

export function parseRetryAfter(headers: Headers): number | undefined {
  const reset = headers.get("ratelimit")?.match(/reset=(\d+)/)
  if (reset) return Number(reset[1])
  const retryAfter = headers.get("retry-after")
  if (retryAfter && /^\d+$/.test(retryAfter)) return Number(retryAfter)
  return undefined
}

type ErrorBody = {
  error?: { code?: string; message?: string; details?: ErrorDetail[] }
}

export async function toApiError(res: Response): Promise<ApiError> {
  let body: ErrorBody | undefined
  try {
    body = (await res.json()) as ErrorBody
  } catch {
    body = undefined
  }
  const error = body?.error
  return new ApiError(
    res.status,
    error?.code ?? (res.status >= 500 ? "SERVER_ERROR" : "HTTP_ERROR"),
    error?.message ?? `Lỗi ${res.status}`,
    error?.details ?? [],
    res.status === 429 ? parseRetryAfter(res.headers) : undefined
  )
}

export function fieldErrors(details: ErrorDetail[] | undefined): Record<string, string> {
  const result: Record<string, string> = {}
  for (const detail of details ?? []) {
    const key = detail.path.replace(/^(body|query|params)\./, "")
    if (!(key in result)) result[key] = detail.message
  }
  return result
}

export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return "Đã có lỗi xảy ra, vui lòng thử lại"
  if (error.status === 403) return "Bạn không có quyền thực hiện thao tác này"
  if (error.status === 429) {
    const minutes = Math.max(1, Math.ceil((error.retryAfterSec ?? 60) / 60))
    return `Thao tác quá nhiều lần, thử lại sau ${minutes} phút`
  }
  if (error.status === 0 || error.status >= 500) {
    return "Không kết nối được máy chủ, vui lòng thử lại"
  }
  return error.message
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/api/errors.test.ts`
Expected: PASS.

- [ ] **Step 5: Types** — `front-end/lib/auth/permissions.ts`:

```ts
export type Role =
  | "super_admin"
  | "branch_manager"
  | "consultant"
  | "editor"
  | "instructor"
```

`front-end/lib/auth/user.ts`:

```ts
import type { Role } from "@/lib/auth/permissions"

export type SessionUser = {
  id: string
  name: string
  username: string
  phone: string
  role: Role
  branchIds: string[]
  status: string
}
```

- [ ] **Step 6: Write the failing test** — `front-end/lib/api/client.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

import { apiData, apiFetch, buildUrl } from "@/lib/api/client"
import { ApiError } from "@/lib/api/errors"
import { getAccessToken, onSessionExpired, setAccessToken } from "@/lib/api/session"
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
    expect(buildUrl("/leads", { page: 2, q: "", status: undefined, mine: false, x: null })).toBe(
      "/api/v1/leads?page=2&mine=false"
    )
    expect(buildUrl("/leads")).toBe("/api/v1/leads")
  })
})

describe("apiFetch", () => {
  it("gắn Bearer, gửi JSON và credentials include", async () => {
    setAccessToken("t1")
    const { calls } = mockFetch({
      "POST /leads": (init) => {
        expect(bearer(init)).toBe("Bearer t1")
        expect(new Headers(init.headers).get("Content-Type")).toBe("application/json")
        expect(init.body).toBe(JSON.stringify({ name: "A" }))
        return jsonResponse(201, { data: { id: "l1" } })
      },
    })
    await expect(apiData("/leads", { method: "POST", body: { name: "A" } })).resolves.toEqual({
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
    await expect(apiFetch("/leads/l1", { method: "DELETE" })).resolves.toBeUndefined()
  })

  it("401 → refresh một lần → gửi lại với token mới", async () => {
    setAccessToken("old")
    const { calls } = mockFetch({
      "GET /auth/me": (init) =>
        bearer(init) === "Bearer new"
          ? jsonResponse(200, { data: { ok: true } })
          : jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "Hết hạn" } }),
      "POST /auth/refresh": () => jsonResponse(200, { data: { accessToken: "new", user } }),
    })
    await expect(apiData("/auth/me")).resolves.toEqual({ ok: true })
    expect(calls.map((c) => c.key)).toEqual(["GET /auth/me", "POST /auth/refresh", "GET /auth/me"])
    expect(getAccessToken()).toBe("new")
  })

  it("nhiều request 401 cùng lúc chỉ refresh một lần", async () => {
    setAccessToken("old")
    let refreshes = 0
    const { calls } = mockFetch({
      "GET /x": (init) =>
        bearer(init) === "Bearer new"
          ? jsonResponse(200, { data: 1 })
          : jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "Hết hạn" } }),
      "POST /auth/refresh": async () => {
        refreshes += 1
        await new Promise((resolve) => setTimeout(resolve, 10))
        return jsonResponse(200, { data: { accessToken: "new", user } })
      },
    })
    const results = await Promise.all([apiData("/x"), apiData("/x"), apiData("/x")])
    expect(results).toEqual([1, 1, 1])
    expect(refreshes).toBe(1)
    expect(calls.filter((c) => c.key === "GET /x")).toHaveLength(6)
  })

  it("refresh thất bại → báo hết phiên và ném 401", async () => {
    setAccessToken("old")
    const expired = vi.fn()
    const off = onSessionExpired(expired)
    mockFetch({
      "GET /x": () => jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "Hết hạn" } }),
      "POST /auth/refresh": () =>
        jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "Phiên hết hạn" } }),
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
      "GET /x": () => jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "Hết hạn" } }),
      "POST /auth/refresh": () => jsonResponse(200, { data: { accessToken: "new", user } }),
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
          error: { code: "UNAUTHORIZED", message: "Tài khoản hoặc mật khẩu không đúng" },
        }),
      "GET /x": () => jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "Cần đăng nhập" } }),
    })
    await expect(
      apiFetch("/auth/login", { method: "POST", body: { identifier: "a", password: "b" } })
    ).rejects.toMatchObject({ status: 401, message: "Tài khoản hoặc mật khẩu không đúng" })
    await expect(apiFetch("/x")).rejects.toMatchObject({ status: 401 })
    expect(calls.map((c) => c.key)).toEqual(["POST /auth/login", "GET /x"])
  })

  it("request khác đã refresh xong → gửi lại bằng token hiện tại, không refresh nữa", async () => {
    setAccessToken("old")
    const { calls } = mockFetch({
      "GET /x": [
        () => {
          setAccessToken("new")
          return jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "Hết hạn" } })
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
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")))
    await expect(apiFetch("/x")).rejects.toMatchObject({ status: 0, code: "NETWORK_ERROR" })
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
    const error = await apiFetch("/leads", { method: "POST", body: {} }).catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.details).toEqual([{ path: "body.phone", message: "Sai" }])
  })

  it("refresh chạy trong navigator.locks khi trình duyệt hỗ trợ", async () => {
    setAccessToken("old")
    const request = vi.fn((_name: string, callback: () => Promise<unknown>) => callback())
    Object.defineProperty(navigator, "locks", { value: { request }, configurable: true })
    mockFetch({
      "GET /x": (init) =>
        bearer(init) === "Bearer new"
          ? jsonResponse(200, { data: 1 })
          : jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "Hết hạn" } }),
      "POST /auth/refresh": () => jsonResponse(200, { data: { accessToken: "new", user } }),
    })
    await apiData("/x")
    expect(request).toHaveBeenCalledWith("gt-refresh", expect.any(Function))
    Reflect.deleteProperty(navigator, "locks")
  })
})
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx vitest run lib/api/client.test.ts`
Expected: FAIL — không tìm thấy module `@/lib/api/client`.

- [ ] **Step 8: Implement session** — `front-end/lib/api/session.ts`

```ts
import { API_URL } from "@/lib/api/config"
import { networkError, toApiError } from "@/lib/api/errors"
import type { SessionUser } from "@/lib/auth/user"

export type RefreshResult = { accessToken: string; user: SessionUser }

// Access token chỉ nằm trong bộ nhớ; refresh token là cookie httpOnly gt_refresh.
let accessToken: string | null = null
let inflight: Promise<RefreshResult | null> | null = null
const expiredListeners = new Set<() => void>()

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function onSessionExpired(listener: () => void): () => void {
  expiredListeners.add(listener)
  return () => {
    expiredListeners.delete(listener)
  }
}

export function expireSession(): void {
  accessToken = null
  for (const listener of expiredListeners) listener()
}

async function requestRefresh(): Promise<RefreshResult | null> {
  let res: Response
  try {
    res = await fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" })
  } catch {
    throw networkError()
  }
  if (res.status >= 500) throw await toApiError(res)
  if (!res.ok) {
    accessToken = null
    return null
  }
  const body = (await res.json()) as { data: RefreshResult }
  accessToken = body.data.accessToken
  return body.data
}

// Refresh xoay vòng token: một tab chỉ refresh một lần cho mọi request đang chờ,
// và các tab xếp hàng qua Web Locks để không gửi cùng một refresh token.
export function refreshSession(): Promise<RefreshResult | null> {
  if (!inflight) {
    const locks = typeof navigator === "undefined" ? undefined : navigator.locks
    const run = locks ? locks.request("gt-refresh", requestRefresh) : requestRefresh()
    inflight = run.finally(() => {
      inflight = null
    })
  }
  return inflight
}
```

- [ ] **Step 9: Implement client** — `front-end/lib/api/client.ts`

```ts
import { API_URL } from "@/lib/api/config"
import { networkError, toApiError } from "@/lib/api/errors"
import { expireSession, getAccessToken, refreshSession } from "@/lib/api/session"

type QueryValue = string | number | boolean | null | undefined

export type ApiRequest = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: unknown
  query?: Record<string, QueryValue>
  signal?: AbortSignal
}

const NO_REFRESH = new Set(["/auth/login", "/auth/refresh", "/auth/logout"])

export function buildUrl(path: string, query?: ApiRequest["query"]): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") params.append(key, String(value))
  }
  const search = params.toString()
  return `${API_URL}${path}${search ? `?${search}` : ""}`
}

async function send(path: string, request: ApiRequest, token: string | null): Promise<Response> {
  const headers = new Headers()
  let body: BodyInit | undefined
  if (request.body instanceof FormData) {
    body = request.body
  } else if (request.body !== undefined) {
    headers.set("Content-Type", "application/json")
    body = JSON.stringify(request.body)
  }
  if (token) headers.set("Authorization", `Bearer ${token}`)
  try {
    return await fetch(buildUrl(path, request.query), {
      method: request.method ?? "GET",
      headers,
      body,
      credentials: "include",
      signal: request.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    throw networkError()
  }
}

export async function apiFetch<T>(path: string, request: ApiRequest = {}): Promise<T> {
  const token = getAccessToken()
  let res = await send(path, request, token)

  if (res.status === 401 && token && !NO_REFRESH.has(path)) {
    const current = getAccessToken()
    // Request khác đã refresh trong lúc chờ: dùng luôn token mới
    const nextToken =
      current && current !== token ? current : (await refreshSession())?.accessToken
    if (!nextToken) {
      expireSession()
      throw await toApiError(res)
    }
    res = await send(path, request, nextToken)
    if (res.status === 401) {
      expireSession()
      throw await toApiError(res)
    }
  }

  if (!res.ok) throw await toApiError(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export async function apiData<T>(path: string, request?: ApiRequest): Promise<T> {
  return (await apiFetch<{ data: T }>(path, request)).data
}
```

- [ ] **Step 10: Run tests to verify they pass**

Run: `npx vitest run lib/api`
Expected: PASS (config, errors, client).

- [ ] **Step 11: Verify and commit**

Run: `npm run typecheck && npm run lint`
Expected: không lỗi.

```bash
git add front-end/lib/api front-end/lib/auth/permissions.ts front-end/lib/auth/user.ts
git commit -m "feat(fe): apiFetch với refresh token một lần, phiên trong bộ nhớ, xử lý lỗi API

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Quyền, bảng route admin, thông tin người dùng

**Files:**
- Modify: `front-end/lib/auth/permissions.ts`, `front-end/lib/auth/user.ts`
- Create: `front-end/lib/auth/routes.ts`, `front-end/lib/auth/auth.test.ts`

**Interfaces:**
- Consumes: `Role`, `SessionUser` (Task 3).
- Produces:
  - `hasPermission(permissions: readonly string[], required: string | null): boolean` (`null` = mọi nhân viên).
  - `ROLE_LABELS: Record<Role, string>`, `initials(name: string): string` (`@/lib/auth/user`).
  - `@/lib/auth/routes`: `type AdminRoute = { href: string; permission: string | null }`, `ADMIN_ROUTES: AdminRoute[]` (theo thứ tự menu), `LOGIN_PATH = "/admin/dang-nhap"`, `routeFor(pathname: string): AdminRoute | undefined`, `canAccess(pathname: string, permissions: readonly string[]): boolean`, `firstAllowedPath(permissions: readonly string[]): string`, `safeNext(next: string | null | undefined): string | null`, `loginUrl(currentPath: string): string`.

- [ ] **Step 1: Write the failing test** — `front-end/lib/auth/auth.test.ts`

```ts
import { describe, expect, it } from "vitest"

import { hasPermission } from "@/lib/auth/permissions"
import {
  canAccess,
  firstAllowedPath,
  loginUrl,
  routeFor,
  safeNext,
} from "@/lib/auth/routes"
import { initials, ROLE_LABELS } from "@/lib/auth/user"

const editor = ["branch.read", "setting.read", "course.read", "media.read", "media.upload", "category.manage", "post.manage"]
const instructor = ["branch.read", "setting.read", "course.read", "media.read", "class.read", "student.read", "exam.read"]
const manager = ["branch.read", "lead.*", "tuition.*", "dashboard.read", "user.manage"]

describe("hasPermission", () => {
  it("cùng luật với backend", () => {
    expect(hasPermission(["*"], "tuition.read")).toBe(true)
    expect(hasPermission(["lead.read"], "lead.read")).toBe(true)
    expect(hasPermission(["lead.*"], "lead.delete")).toBe(true)
    expect(hasPermission(["lead.read"], "lead.delete")).toBe(false)
    expect(hasPermission(["leads.*"], "lead.read")).toBe(false)
    expect(hasPermission([], null)).toBe(true)
  })
})

describe("routeFor", () => {
  it("khớp tiền tố dài nhất, /admin chỉ khớp đúng", () => {
    expect(routeFor("/admin")?.permission).toBe("dashboard.read")
    expect(routeFor("/admin/bai-viet/tao-moi")?.href).toBe("/admin/bai-viet")
    expect(routeFor("/admin/hoc-phi")?.permission).toBe("tuition.read")
    expect(routeFor("/admin/hoc-phi-cu")).toBeUndefined()
    expect(routeFor("/admin/khong-co")).toBeUndefined()
  })
})

describe("canAccess / firstAllowedPath", () => {
  it("editor chỉ vào bài viết và trang chung", () => {
    expect(canAccess("/admin/bai-viet/tao-moi", editor)).toBe(true)
    expect(canAccess("/admin/hoc-phi", editor)).toBe(false)
    expect(canAccess("/admin", editor)).toBe(false)
    expect(canAccess("/admin/tai-khoan", editor)).toBe(true)
    expect(canAccess("/admin/chi-nhanh", [])).toBe(true)
    expect(firstAllowedPath(editor)).toBe("/admin/bai-viet")
  })

  it("giáo viên về lớp học, quản lý về tổng quan", () => {
    expect(firstAllowedPath(instructor)).toBe("/admin/lop-hoc")
    expect(firstAllowedPath(manager)).toBe("/admin")
    expect(firstAllowedPath(["*"])).toBe("/admin")
    expect(firstAllowedPath([])).toBe("/admin/chi-nhanh")
  })
})

describe("safeNext", () => {
  it("chỉ nhận đường dẫn trong /admin", () => {
    expect(safeNext("/admin/hoc-phi?page=2")).toBe("/admin/hoc-phi?page=2")
    expect(safeNext("/admin")).toBe("/admin")
    expect(safeNext(null)).toBeNull()
    expect(safeNext("")).toBeNull()
    expect(safeNext("//evil.com")).toBeNull()
    expect(safeNext("/\\evil.com")).toBeNull()
    expect(safeNext("https://evil.com/admin")).toBeNull()
    expect(safeNext("/administrator")).toBeNull()
    expect(safeNext("/admin/dang-nhap")).toBeNull()
    expect(safeNext("/admin/dang-nhap?next=/admin")).toBeNull()
  })

  it("loginUrl mã hoá đường dẫn hiện tại", () => {
    expect(loginUrl("/admin/hoc-phi?page=2")).toBe(
      "/admin/dang-nhap?next=%2Fadmin%2Fhoc-phi%3Fpage%3D2"
    )
  })
})

describe("user", () => {
  it("nhãn vai trò và chữ viết tắt", () => {
    expect(ROLE_LABELS.branch_manager).toBe("Quản lý chi nhánh")
    expect(initials("Trần Mỹ Duyên")).toBe("TD")
    expect(initials("  admin ")).toBe("AD")
    expect(initials("")).toBe("?")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/auth/auth.test.ts`
Expected: FAIL — `hasPermission` không được export / không tìm thấy `@/lib/auth/routes`.

- [ ] **Step 3: Implement permissions** — thêm vào cuối `front-end/lib/auth/permissions.ts`:

```ts
// Cùng luật với back-end/src/config/roles.ts: "*", trùng khớp, hoặc "<tài nguyên>.*"
export function hasPermission(
  permissions: readonly string[],
  required: string | null
): boolean {
  if (required === null) return true
  const [resource] = required.split(".")
  return permissions.some(
    (granted) => granted === "*" || granted === required || granted === `${resource}.*`
  )
}
```

- [ ] **Step 4: Implement user helpers** — thêm vào cuối `front-end/lib/auth/user.ts`:

```ts
export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Quản trị viên",
  branch_manager: "Quản lý chi nhánh",
  consultant: "Tư vấn viên",
  editor: "Biên tập viên",
  instructor: "Giáo viên",
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
}
```

- [ ] **Step 5: Implement routes** — `front-end/lib/auth/routes.ts`

```ts
import { hasPermission } from "@/lib/auth/permissions"

export type AdminRoute = { href: string; permission: string | null }

export const LOGIN_PATH = "/admin/dang-nhap"

// Thứ tự = thứ tự menu; dùng chung cho menu, chặn trang và trang mặc định sau đăng nhập.
// permission null: mọi nhân viên đã đăng nhập.
export const ADMIN_ROUTES: AdminRoute[] = [
  { href: "/admin", permission: "dashboard.read" },
  { href: "/admin/lich-dang-ky", permission: "lead.read" },
  { href: "/admin/lop-hoc", permission: "class.read" },
  { href: "/admin/lich-thi", permission: "exam.read" },
  { href: "/admin/nguoi-dung", permission: "user.manage" },
  { href: "/admin/chi-nhanh", permission: null },
  { href: "/admin/giao-vien", permission: "instructor.read" },
  { href: "/admin/xe-tap-lai", permission: "vehicle.read" },
  { href: "/admin/hoc-phi", permission: "tuition.read" },
  { href: "/admin/bai-viet", permission: "post.manage" },
  { href: "/admin/cai-dat", permission: null },
  { href: "/admin/tro-giup", permission: null },
  { href: "/admin/tai-khoan", permission: null },
]

function matches(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function routeFor(pathname: string): AdminRoute | undefined {
  return ADMIN_ROUTES.filter((route) => matches(pathname, route.href)).sort(
    (a, b) => b.href.length - a.href.length
  )[0]
}

// Đường dẫn không có trong bảng (vd. trang 404) để Next.js tự xử lý
export function canAccess(pathname: string, permissions: readonly string[]): boolean {
  const route = routeFor(pathname)
  return route ? hasPermission(permissions, route.permission) : true
}

export function firstAllowedPath(permissions: readonly string[]): string {
  return (
    ADMIN_ROUTES.find((route) => hasPermission(permissions, route.permission))?.href ??
    "/admin/tai-khoan"
  )
}

export function safeNext(next: string | null | undefined): string | null {
  if (!next || next.startsWith("//") || next.startsWith("/\\")) return null
  const path = next.split(/[?#]/)[0]
  if (path !== "/admin" && !path.startsWith("/admin/")) return null
  if (path === LOGIN_PATH || path.startsWith(`${LOGIN_PATH}/`)) return null
  return next
}

export function loginUrl(currentPath: string): string {
  return `${LOGIN_PATH}?next=${encodeURIComponent(currentPath)}`
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run lib/auth`
Expected: PASS.

- [ ] **Step 7: Verify and commit**

Run: `npm run typecheck && npm run lint`

```bash
git add front-end/lib/auth
git commit -m "feat(fe): bảng quyền route admin, kiểm tra next, nhãn vai trò

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: QueryProvider và AuthProvider

**Files:**
- Create: `front-end/components/providers/query-provider.tsx`
- Create: `front-end/components/admin/auth-provider.tsx`, `front-end/components/admin/auth-provider.test.tsx`

**Interfaces:**
- Consumes: `apiData`, `apiFetch` (Task 3); `refreshSession`, `setAccessToken`, `getAccessToken`, `onSessionExpired`, `expireSession` (Task 3); `ApiError`, `errorMessage` (Task 3); `SessionUser` (Task 3); `Toaster` (Task 2).
- Produces:
  - `makeQueryClient(): QueryClient`, `QueryProvider({ children })` — render kèm `<Toaster />`. Mutation có `meta: { silent: true }` thì không tự toast lỗi.
  - `AuthProvider({ children })`, `useAuth(): AuthContextValue` với
    `type AuthStatus = "loading" | "authenticated" | "anonymous" | "offline"` và
    `AuthContextValue = { status: AuthStatus; user: SessionUser | null; permissions: string[]; signedOut: boolean; login(identifier: string, password: string): Promise<void>; logout(): Promise<void>; changePassword(currentPassword: string, newPassword: string): Promise<void>; setUser(user: SessionUser): void; retry(): void }`.
    `signedOut = true` chỉ sau khi người dùng bấm đăng xuất (guard về trang đăng nhập không kèm `next`).

- [ ] **Step 1: QueryProvider** — `front-end/components/providers/query-provider.tsx`

```tsx
"use client"

import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { Toaster } from "@/components/ui/sonner"
import { ApiError, errorMessage } from "@/lib/api/errors"

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: { silent?: boolean }
  }
}

function retryOnce(failureCount: number, error: unknown): boolean {
  const transient = error instanceof ApiError && (error.status === 0 || error.status >= 500)
  return transient && failureCount < 1
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    mutationCache: new MutationCache({
      onError: (error, _variables, _result, mutation) => {
        if (mutation.meta?.silent) return
        toast.error(errorMessage(error))
      },
    }),
    defaultOptions: {
      queries: { retry: retryOnce, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeQueryClient)
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster />
    </QueryClientProvider>
  )
}
```

- [ ] **Step 2: Write the failing test** — `front-end/components/admin/auth-provider.test.tsx`

```tsx
import { act, render, screen, waitFor } from "@testing-library/react"
import { QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it } from "vitest"

import { AuthProvider, useAuth } from "@/components/admin/auth-provider"
import { makeQueryClient } from "@/components/providers/query-provider"
import { expireSession, getAccessToken, setAccessToken } from "@/lib/api/session"
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
const unauthorized = { error: { code: "UNAUTHORIZED", message: "Phiên hết hạn" } }

let auth: ReturnType<typeof useAuth>

function Probe() {
  auth = useAuth()
  return (
    <p>
      {auth.status}|{auth.user?.name ?? "-"}|{auth.permissions.join(",")}|
      {auth.signedOut ? "signedOut" : ""}
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
      "POST /auth/refresh": () => jsonResponse(200, { data: { accessToken: "t1", user } }),
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
        expect(JSON.parse(String(init.body))).toEqual({ identifier: "duyen", password: "Matkhau123" })
        return jsonResponse(200, { data: { accessToken: "t2", user } })
      },
      "GET /auth/me": () => jsonResponse(200, me),
    })
    renderAuth()
    await screen.findByText("anonymous|-||")
    await act(() => auth.login("duyen", "Matkhau123"))
    expect(screen.getByText("authenticated|Trần Mỹ Duyên|lead.read|")).toBeInTheDocument()
    expect(getAccessToken()).toBe("t2")
  })

  it("logout gọi API, xoá token, đánh dấu signedOut kể cả khi API lỗi", async () => {
    const { calls } = mockFetch({
      "POST /auth/refresh": () => jsonResponse(200, { data: { accessToken: "t1", user } }),
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
      "POST /auth/refresh": () => jsonResponse(200, { data: { accessToken: "t1", user } }),
      "GET /auth/me": () => jsonResponse(200, me),
      "POST /auth/change-password": () => jsonResponse(204),
      "POST /auth/login": (init) => {
        expect(JSON.parse(String(init.body))).toEqual({ identifier: "duyen", password: "Moimatkhau1" })
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
      "POST /auth/refresh": () => jsonResponse(200, { data: { accessToken: "t1", user } }),
      "GET /auth/me": () => jsonResponse(200, me),
    })
    renderAuth()
    await screen.findByText(/^authenticated/)
    act(() => expireSession())
    await waitFor(() => expect(screen.getByText("anonymous|-||")).toBeInTheDocument())
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run components/admin/auth-provider.test.tsx`
Expected: FAIL — không tìm thấy module `@/components/admin/auth-provider`.

- [ ] **Step 4: Implement** — `front-end/components/admin/auth-provider.tsx`

```tsx
"use client"

import { useQueryClient } from "@tanstack/react-query"
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

import { apiData, apiFetch } from "@/lib/api/client"
import { ApiError } from "@/lib/api/errors"
import { onSessionExpired, refreshSession, setAccessToken } from "@/lib/api/session"
import type { SessionUser } from "@/lib/auth/user"

export type AuthStatus = "loading" | "authenticated" | "anonymous" | "offline"

type AuthState = {
  status: AuthStatus
  user: SessionUser | null
  permissions: string[]
  signedOut: boolean
}

type AuthContextValue = AuthState & {
  login: (identifier: string, password: string) => Promise<void>
  logout: () => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  setUser: (user: SessionUser) => void
  retry: () => void
}

type Me = { user: SessionUser; permissions: string[] }

const ANONYMOUS: AuthState = { status: "anonymous", user: null, permissions: [], signedOut: false }

const AuthContext = createContext<AuthContextValue | null>(null)

function isUnreachable(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 0 || error.status >= 500)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>({ ...ANONYMOUS, status: "loading" })

  const loadMe = useCallback(async () => {
    const me = await apiData<Me>("/auth/me")
    setState({ status: "authenticated", user: me.user, permissions: me.permissions, signedOut: false })
  }, [])

  const bootstrap = useCallback(async () => {
    try {
      const session = await refreshSession()
      if (!session) {
        setState(ANONYMOUS)
        return
      }
      await loadMe()
    } catch (error) {
      setState(isUnreachable(error) ? { ...ANONYMOUS, status: "offline" } : ANONYMOUS)
    }
  }, [loadMe])

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  useEffect(
    () =>
      onSessionExpired(() => {
        queryClient.clear()
        setState(ANONYMOUS)
      }),
    [queryClient]
  )

  const login = useCallback(
    async (identifier: string, password: string) => {
      const session = await apiData<{ accessToken: string; user: SessionUser }>("/auth/login", {
        method: "POST",
        body: { identifier, password },
      })
      setAccessToken(session.accessToken)
      await loadMe()
    },
    [loadMe]
  )

  const logout = useCallback(async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" })
    } catch {
      // Lỗi mạng vẫn đăng xuất phía trình duyệt
    }
    setAccessToken(null)
    queryClient.clear()
    setState({ ...ANONYMOUS, signedOut: true })
  }, [queryClient])

  const username = state.user?.username
  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: { currentPassword, newPassword },
      })
      // Backend huỷ mọi refresh token (kể cả phiên này) → đăng nhập lại bằng mật khẩu mới
      try {
        await login(username ?? "", newPassword)
      } catch {
        await logout()
      }
    },
    [login, logout, username]
  )

  const setUser = useCallback((user: SessionUser) => {
    setState((current) => ({ ...current, user }))
  }, [])

  const retry = useCallback(() => {
    setState((current) => ({ ...current, status: "loading" }))
    void bootstrap()
  }, [bootstrap])

  const value = useMemo(
    () => ({ ...state, login, logout, changePassword, setUser, retry }),
    [state, login, logout, changePassword, setUser, retry]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth phải nằm trong AuthProvider")
  return context
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run components/admin/auth-provider.test.tsx`
Expected: PASS (7 tests). Nếu `npm run lint` báo `react-hooks/set-state-in-effect` cho `bootstrap`, giữ nguyên cấu trúc: mọi `setState` trong `bootstrap` đều nằm sau `await` (không đồng bộ trong effect); không thêm `setState` đồng bộ vào effect.

- [ ] **Step 6: Verify and commit**

Run: `npm test && npm run typecheck && npm run lint`

```bash
git add front-end/components/providers/query-provider.tsx front-end/components/admin/auth-provider.tsx front-end/components/admin/auth-provider.test.tsx
git commit -m "feat(fe): AuthProvider giữ phiên đăng nhập và QueryProvider

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Route group, chặn trang, menu theo quyền, header người dùng thật

**Files:**
- Move: `front-end/app/admin/{page.tsx,bai-viet,cai-dat,chi-nhanh,giao-vien,hoc-phi,lich-dang-ky,lich-thi,lop-hoc,nguoi-dung,tro-giup,xe-tap-lai}` → `front-end/app/admin/(panel)/`
- Modify: `front-end/app/admin/layout.tsx`
- Create: `front-end/app/admin/(panel)/layout.tsx`
- Create: `front-end/components/admin/admin-status.tsx`, `front-end/components/admin/admin-guard.tsx`, `front-end/components/admin/admin-guard.test.tsx`
- Modify: `front-end/components/admin/admin-shell.tsx`

**Interfaces:**
- Consumes: `useAuth` (Task 5), `QueryProvider` (Task 5), `canAccess`, `firstAllowedPath`, `loginUrl`, `LOGIN_PATH` (Task 4), `hasPermission` (Task 4), `ROLE_LABELS`, `initials` (Task 4).
- Produces: `AdminGuard({ children })`; `AdminStatus({ title, description?, action? })`, `Forbidden({ home })`. URL các trang admin không đổi.

- [ ] **Step 1: Move pages** (trong `front-end/`)

```bash
mkdir -p "app/admin/(panel)"
for p in page.tsx bai-viet cai-dat chi-nhanh giao-vien hoc-phi lich-dang-ky lich-thi lop-hoc nguoi-dung tro-giup xe-tap-lai; do git mv "app/admin/$p" "app/admin/(panel)/$p"; done
grep -rn 'from "\.\.\?/' "app/admin/(panel)" || echo "không có import tương đối"
```

Expected: in ra "không có import tương đối" (các trang chỉ dùng `@/...`).

- [ ] **Step 2: Layouts**

`front-end/app/admin/layout.tsx` (thay toàn bộ):

```tsx
import type { Metadata } from "next"

import { AuthProvider } from "@/components/admin/auth-provider"
import { QueryProvider } from "@/components/providers/query-provider"

export const metadata: Metadata = {
  title: {
    default: "Tổng quan quản trị | Gia Thịnh",
    template: "%s | Quản trị Gia Thịnh",
  },
  description: "Khu vực quản lý học viên, lịch đăng ký và nội dung Gia Thịnh.",
  robots: {
    index: false,
    follow: false,
  },
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <QueryProvider>
      <AuthProvider>{children}</AuthProvider>
    </QueryProvider>
  )
}
```

`front-end/app/admin/(panel)/layout.tsx`:

```tsx
import { AdminGuard } from "@/components/admin/admin-guard"

export default function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminGuard>{children}</AdminGuard>
}
```

- [ ] **Step 3: Status screens** — `front-end/components/admin/admin-status.tsx`

```tsx
import Link from "next/link"
import { ShieldAlert } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"

// data-admin-shell: globals.css ẩn footer website trên các màn admin
export function AdminStatus({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div
      data-admin-shell
      role="status"
      className="grid min-h-svh place-items-center bg-muted/60 p-6 text-center text-[13px]"
    >
      <div className="flex max-w-sm flex-col items-center gap-3">
        <p className="text-base font-semibold text-navy">{title}</p>
        {description ? <p className="text-muted-foreground">{description}</p> : null}
        {action}
      </div>
    </div>
  )
}

export function Forbidden({ home }: { home: string }) {
  return (
    <main id="admin-content" className="grid place-items-center p-10 text-center">
      <div className="flex max-w-sm flex-col items-center gap-3">
        <ShieldAlert aria-hidden="true" className="size-10 text-muted-foreground" />
        <h1 className="text-lg font-bold text-navy">Không có quyền truy cập</h1>
        <p className="text-muted-foreground">
          Tài khoản của bạn không được xem trang này. Liên hệ quản trị viên nếu cần cấp quyền.
        </p>
        <Link href={home} className={buttonVariants({ size: "sm" })}>
          Về trang của tôi
        </Link>
      </div>
    </main>
  )
}
```

Trước khi dùng, kiểm tra `buttonVariants` nhận `size: "sm"`: `grep -n "size:" -A8 components/ui/button.tsx`. Nếu không có `sm`, bỏ tham số `size`.

- [ ] **Step 4: Write the failing test** — `front-end/components/admin/admin-guard.test.tsx`

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AdminGuard } from "@/components/admin/admin-guard"

const replace = vi.fn()
let pathname = "/admin/hoc-phi"
let auth: Record<string, unknown>

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => pathname,
}))
vi.mock("@/components/admin/auth-provider", () => ({ useAuth: () => auth }))

const editor = {
  status: "authenticated",
  signedOut: false,
  user: { id: "u2", name: "Lê Biên Tập", username: "bt", phone: "0900000000", role: "editor", branchIds: [], status: "active" },
  permissions: ["branch.read", "post.manage"],
  logout: vi.fn(),
  retry: vi.fn(),
}

beforeEach(() => {
  replace.mockClear()
  pathname = "/admin/hoc-phi"
  window.history.replaceState(null, "", "/admin/hoc-phi?page=2")
})

describe("AdminGuard", () => {
  it("chưa đăng nhập → về trang đăng nhập kèm next (gồm query)", () => {
    auth = { ...editor, status: "anonymous", user: null, permissions: [] }
    render(<AdminGuard><p>nội dung</p></AdminGuard>)
    expect(replace).toHaveBeenCalledWith("/admin/dang-nhap?next=%2Fadmin%2Fhoc-phi%3Fpage%3D2")
    expect(screen.queryByText("nội dung")).not.toBeInTheDocument()
  })

  it("vừa bấm đăng xuất → về trang đăng nhập không kèm next", () => {
    auth = { ...editor, status: "anonymous", signedOut: true, user: null, permissions: [] }
    render(<AdminGuard><p>nội dung</p></AdminGuard>)
    expect(replace).toHaveBeenCalledWith("/admin/dang-nhap")
  })

  it("đang tải → không render nội dung", () => {
    auth = { ...editor, status: "loading", user: null, permissions: [] }
    render(<AdminGuard><p>nội dung</p></AdminGuard>)
    expect(screen.getByText("Đang tải…")).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it("mất kết nối → nút Thử lại gọi retry", async () => {
    const retry = vi.fn()
    auth = { ...editor, status: "offline", user: null, permissions: [], retry }
    render(<AdminGuard><p>nội dung</p></AdminGuard>)
    expect(screen.getByText("Không kết nối được máy chủ")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }))
    expect(retry).toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })

  it("thiếu quyền → màn không có quyền, menu chỉ hiện mục được phép, header là người thật", () => {
    auth = editor
    render(<AdminGuard><p>nội dung</p></AdminGuard>)
    expect(screen.getByText("Không có quyền truy cập")).toBeInTheDocument()
    expect(screen.queryByText("nội dung")).not.toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "Bài viết" }).length).toBeGreaterThan(0)
    expect(screen.queryByRole("link", { name: "Học phí" })).not.toBeInTheDocument()
    expect(screen.queryByText("Tài chính")).not.toBeInTheDocument()
    expect(screen.getByText("Lê Biên Tập")).toBeInTheDocument()
    expect(screen.getByText("Biên tập viên")).toBeInTheDocument()
    expect(screen.getAllByText("LT").length).toBeGreaterThan(0)
  })

  it("có quyền → render nội dung trong khung admin", () => {
    auth = editor
    pathname = "/admin/bai-viet/tao-moi"
    render(<AdminGuard><p>nội dung</p></AdminGuard>)
    expect(screen.getByText("nội dung")).toBeInTheDocument()
  })

  it("/admin mà không có dashboard.read → chuyển tới mục đầu tiên được phép", () => {
    auth = editor
    pathname = "/admin"
    render(<AdminGuard><p>tổng quan</p></AdminGuard>)
    expect(replace).toHaveBeenCalledWith("/admin/bai-viet")
    expect(screen.queryByText("tổng quan")).not.toBeInTheDocument()
    expect(screen.queryByText("Không có quyền truy cập")).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npx vitest run components/admin/admin-guard.test.tsx`
Expected: FAIL — không tìm thấy module `@/components/admin/admin-guard`.

- [ ] **Step 6: Implement guard** — `front-end/components/admin/admin-guard.tsx`

```tsx
"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"

import { AdminShell } from "@/components/admin/admin-shell"
import { AdminStatus, Forbidden } from "@/components/admin/admin-status"
import { useAuth } from "@/components/admin/auth-provider"
import { Button } from "@/components/ui/button"
import { hasPermission } from "@/lib/auth/permissions"
import { canAccess, firstAllowedPath, LOGIN_PATH, loginUrl } from "@/lib/auth/routes"

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { status, permissions, signedOut, retry } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const needsHome =
    status === "authenticated" &&
    pathname === "/admin" &&
    !hasPermission(permissions, "dashboard.read")

  useEffect(() => {
    if (status === "anonymous") {
      router.replace(signedOut ? LOGIN_PATH : loginUrl(`${pathname}${window.location.search}`))
    } else if (needsHome) {
      router.replace(firstAllowedPath(permissions))
    }
  }, [status, signedOut, needsHome, pathname, permissions, router])

  if (status === "offline") {
    return (
      <AdminStatus
        title="Không kết nối được máy chủ"
        description="Kiểm tra kết nối mạng rồi thử lại."
        action={<Button onClick={retry}>Thử lại</Button>}
      />
    )
  }
  if (status !== "authenticated" || needsHome) return <AdminStatus title="Đang tải…" />

  return (
    <AdminShell>
      {canAccess(pathname, permissions) ? (
        children
      ) : (
        <Forbidden home={firstAllowedPath(permissions)} />
      )}
    </AdminShell>
  )
}
```

- [ ] **Step 7: Update shell** — sửa `front-end/components/admin/admin-shell.tsx`:

1. Imports: thêm `UserCircle` vào danh sách icon của `lucide-react`; thêm

```tsx
import { useAuth } from "@/components/admin/auth-provider"
import { canAccess } from "@/lib/auth/routes"
import { initials, ROLE_LABELS } from "@/lib/auth/user"
```

2. Xoá dòng `const navItems: NavItem[] = navGroups.flatMap((group) => group.items)` ở cấp module.

3. Trong `AdminShell`, thay

```tsx
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)

  function logOut() {
    router.push("/")
  }
```

bằng

```tsx
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const { user, permissions, logout } = useAuth()
  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccess(item.href, permissions)),
    }))
    .filter((group) => group.items.length > 0)
  const navItems = visibleGroups.flatMap((group) => group.items)
  const displayName = user?.name ?? ""
  const roleLabel = user ? ROLE_LABELS[user.role] : ""
  const avatar = initials(displayName)

  function logOut() {
    void logout()
  }
```

4. Trong sidebar đổi `{navGroups.map((group) => (` thành `{visibleGroups.map((group) => (`.

5. Nút mở menu tài khoản: đổi `aria-label="Mở menu tài khoản quản trị viên"` thành `aria-label="Mở menu tài khoản"`; trong trigger thay nội dung avatar `AD` bằng `{avatar}`, dòng `Quản trị viên` bằng `{displayName}`, dòng `Gia Thịnh` bằng `{roleLabel}`.

6. Trong `DropdownMenuLabel`: avatar `AD` → `{avatar}`, `Quản trị viên` → `{displayName}`, `Trung tâm Gia Thịnh` → `{roleLabel}`.

7. Thêm mục "Tài khoản" làm mục đầu tiên sau `<DropdownMenuSeparator />` thứ nhất (trước "Tổng quan quản trị"):

```tsx
                  <DropdownMenuItem
                    onSelect={() => router.push("/admin/tai-khoan")}
                    className="min-h-9 gap-2 px-2 text-[13px] focus:bg-muted focus:text-foreground"
                  >
                    <UserCircle aria-hidden="true" className="size-4" />
                    Tài khoản
                  </DropdownMenuItem>
```

Trang tài khoản không thêm vào menu bên: chỉ vào từ menu tài khoản trên header.

Sau khi sửa: `grep -n "AD\b\|Quản trị viên\|Trung tâm Gia Thịnh" components/admin/admin-shell.tsx` → không còn chữ cứng của người dùng (chữ "Trung tâm quản trị" ở logo giữ nguyên).

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run components/admin`
Expected: PASS. Nếu `next/image` báo lỗi trong jsdom, thêm vào `vitest.setup.ts`:

```ts
vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}))
```

(và đổi tên `vitest.setup.ts` → `vitest.setup.tsx`, cập nhật `setupFiles`).

- [ ] **Step 9: Verify build**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: tất cả PASS; output build liệt kê `/admin`, `/admin/hoc-phi`, … như trước (URL không đổi).

- [ ] **Step 10: Commit**

```bash
git add -A front-end/app/admin front-end/components/admin front-end/vitest.setup.* front-end/vitest.config.ts
git commit -m "feat(fe): chặn /admin theo đăng nhập và quyền, menu và header theo người dùng

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Trang đăng nhập

**Files:**
- Create: `front-end/components/admin/login-form.tsx`, `front-end/components/admin/login-form.test.tsx`
- Create: `front-end/app/admin/dang-nhap/page.tsx`

**Interfaces:**
- Consumes: `useAuth` (Task 5); `ApiError`, `errorMessage`, `fieldErrors` (Task 3); `safeNext`, `firstAllowedPath` (Task 4).
- Produces: route `/admin/dang-nhap` (ngoài khung admin).

- [ ] **Step 1: Write the failing test** — `front-end/components/admin/login-form.test.tsx`

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { LoginForm } from "@/components/admin/login-form"
import { ApiError } from "@/lib/api/errors"

const replace = vi.fn()
let search = ""
let auth: Record<string, unknown>

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}))
vi.mock("@/components/admin/auth-provider", () => ({ useAuth: () => auth }))

beforeEach(() => {
  replace.mockClear()
  search = ""
  auth = { status: "anonymous", permissions: [], login: vi.fn() }
})

async function fillAndSubmit(identifier: string, password: string) {
  if (identifier) await userEvent.type(screen.getByLabelText("Số điện thoại hoặc tên đăng nhập"), identifier)
  if (password) await userEvent.type(screen.getByLabelText("Mật khẩu"), password)
  await userEvent.click(screen.getByRole("button", { name: "Đăng nhập" }))
}

describe("LoginForm", () => {
  it("gọi login với identifier đã bỏ khoảng trắng", async () => {
    const login = vi.fn().mockResolvedValue(undefined)
    auth = { ...auth, login }
    render(<LoginForm />)
    await fillAndSubmit("  admin  ", "Admin@123#")
    expect(login).toHaveBeenCalledWith("admin", "Admin@123#")
  })

  it("bỏ trống → báo lỗi tại ô, không gọi API", async () => {
    const login = vi.fn()
    auth = { ...auth, login }
    render(<LoginForm />)
    await fillAndSubmit("", "")
    expect(screen.getByText("Vui lòng nhập số điện thoại hoặc tên đăng nhập")).toBeInTheDocument()
    expect(screen.getByText("Vui lòng nhập mật khẩu")).toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
  })

  it("sai mật khẩu → hiện thông báo của backend trên form", async () => {
    auth = {
      ...auth,
      login: vi.fn().mockRejectedValue(
        new ApiError(401, "UNAUTHORIZED", "Tài khoản hoặc mật khẩu không đúng")
      ),
    }
    render(<LoginForm />)
    await fillAndSubmit("admin", "sai")
    expect(await screen.findByRole("alert")).toHaveTextContent("Tài khoản hoặc mật khẩu không đúng")
  })

  it("bị giới hạn → báo thời gian chờ", async () => {
    auth = {
      ...auth,
      login: vi.fn().mockRejectedValue(new ApiError(429, "RATE_LIMITED", "x", [], 875)),
    }
    render(<LoginForm />)
    await fillAndSubmit("admin", "sai")
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Thao tác quá nhiều lần, thử lại sau 15 phút"
    )
  })

  it("nút hiện/ẩn mật khẩu", async () => {
    render(<LoginForm />)
    const input = screen.getByLabelText("Mật khẩu")
    expect(input).toHaveAttribute("type", "password")
    await userEvent.click(screen.getByRole("button", { name: "Hiện mật khẩu" }))
    expect(input).toHaveAttribute("type", "text")
  })

  it("đã đăng nhập → chuyển tới next hợp lệ", () => {
    search = "next=%2Fadmin%2Fhoc-phi%3Fpage%3D2"
    auth = { ...auth, status: "authenticated", permissions: ["*"] }
    render(<LoginForm />)
    expect(replace).toHaveBeenCalledWith("/admin/hoc-phi?page=2")
  })

  it("next không hợp lệ → về trang đầu tiên được phép", () => {
    search = "next=%2F%2Fevil.com"
    auth = { ...auth, status: "authenticated", permissions: ["post.manage"] }
    render(<LoginForm />)
    expect(replace).toHaveBeenCalledWith("/admin/bai-viet")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/admin/login-form.test.tsx`
Expected: FAIL — không tìm thấy module `@/components/admin/login-form`.

- [ ] **Step 3: Implement form** — `front-end/components/admin/login-form.tsx`

```tsx
"use client"

import { Eye, EyeOff, LoaderCircle } from "lucide-react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

import { useAuth } from "@/components/admin/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiError, errorMessage, fieldErrors } from "@/lib/api/errors"
import { firstAllowedPath, safeNext } from "@/lib/auth/routes"

export function LoginForm() {
  const { status, permissions, login } = useAuth()
  const router = useRouter()
  const next = safeNext(useSearchParams().get("next"))
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (status === "authenticated") router.replace(next ?? firstAllowedPath(permissions))
  }, [status, next, permissions, router])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const id = identifier.trim()
    const nextErrors: Record<string, string> = {}
    if (!id) nextErrors.identifier = "Vui lòng nhập số điện thoại hoặc tên đăng nhập"
    if (!password) nextErrors.password = "Vui lòng nhập mật khẩu"
    setErrors(nextErrors)
    setFormError(null)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    try {
      await login(id, password)
    } catch (error) {
      const fields = error instanceof ApiError ? fieldErrors(error.details) : {}
      if (Object.keys(fields).length > 0) setErrors(fields)
      else setFormError(errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main
      data-admin-shell
      className="grid min-h-svh place-items-center bg-muted/60 p-4 text-[13px]"
    >
      <div className="w-full max-w-sm rounded-lg border border-border/70 bg-background p-6 shadow-sm">
        <div className="flex flex-col items-center gap-2 text-center">
          <Image
            src="/giathinh-logo.png"
            alt=""
            width={56}
            height={56}
            className="size-14 object-contain"
          />
          <h1 className="text-lg font-bold tracking-tight text-navy">Đăng nhập quản trị</h1>
          <p className="text-muted-foreground">Trường lái Gia Thịnh</p>
        </div>

        <form noValidate onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          {formError ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive"
            >
              {formError}
            </p>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="identifier">Số điện thoại hoặc tên đăng nhập</Label>
            <Input
              id="identifier"
              name="identifier"
              autoComplete="username"
              autoFocus
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              aria-invalid={errors.identifier ? true : undefined}
              aria-describedby={errors.identifier ? "identifier-error" : undefined}
            />
            {errors.identifier ? (
              <p id="identifier-error" className="text-destructive">
                {errors.identifier}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Mật khẩu</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password ? "password-error" : undefined}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff aria-hidden="true" className="size-4" />
                ) : (
                  <Eye aria-hidden="true" className="size-4" />
                )}
              </button>
            </div>
            {errors.password ? (
              <p id="password-error" className="text-destructive">
                {errors.password}
              </p>
            ) : null}
          </div>

          <Button type="submit" disabled={submitting || status === "loading"}>
            {submitting ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
            Đăng nhập
          </Button>

          <p className="text-center text-muted-foreground">
            Quên mật khẩu? Liên hệ quản trị viên để được cấp mật khẩu tạm.
          </p>
        </form>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Page** — `front-end/app/admin/dang-nhap/page.tsx`

```tsx
import type { Metadata } from "next"
import { Suspense } from "react"

import { LoginForm } from "@/components/admin/login-form"

export const metadata: Metadata = {
  title: "Đăng nhập",
}

// useSearchParams trong LoginForm cần Suspense để build tĩnh được
export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run components/admin/login-form.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 6: Verify and commit**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: PASS; build có route `/admin/dang-nhap`.

```bash
git add front-end/components/admin/login-form.tsx front-end/components/admin/login-form.test.tsx front-end/app/admin/dang-nhap
git commit -m "feat(fe): trang đăng nhập quản trị

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Trang tài khoản — hồ sơ và đổi mật khẩu

**Files:**
- Create: `front-end/components/admin/account-forms.tsx`, `front-end/components/admin/account-forms.test.tsx`
- Create: `front-end/app/admin/(panel)/tai-khoan/page.tsx`

**Interfaces:**
- Consumes: `useAuth` (Task 5: `user`, `setUser`, `changePassword`); `apiData` (Task 3); `ApiError`, `errorMessage`, `fieldErrors` (Task 3); `SessionUser` (Task 3); `makeQueryClient` (Task 5); `AdminPageHeader` (`@/components/admin/admin-ui`).
- Produces: route `/admin/tai-khoan`; `ProfileForm`, `PasswordForm`.

- [ ] **Step 1: Write the failing test** — `front-end/components/admin/account-forms.test.tsx`

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PasswordForm, ProfileForm } from "@/components/admin/account-forms"
import { makeQueryClient } from "@/components/providers/query-provider"
import { ApiError } from "@/lib/api/errors"
import { setAccessToken } from "@/lib/api/session"
import { jsonResponse, mockFetch } from "@/test/fetch-mock"

// vi.mock được đưa lên đầu file: biến dùng trong factory phải tạo bằng vi.hoisted
const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: vi.fn() } }))

const user = {
  id: "u1",
  name: "Trần Mỹ Duyên",
  username: "duyen",
  phone: "0779666664",
  role: "consultant",
  branchIds: [],
  status: "active",
}
let auth: Record<string, unknown>
vi.mock("@/components/admin/auth-provider", () => ({ useAuth: () => auth }))

function renderWithQuery(ui: React.ReactNode) {
  return render(<QueryClientProvider client={makeQueryClient()}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  toastSuccess.mockClear()
  setAccessToken("t1")
  auth = { user, setUser: vi.fn(), changePassword: vi.fn() }
})

describe("ProfileForm", () => {
  it("lưu tên và SĐT qua PATCH /auth/me rồi cập nhật người dùng", async () => {
    const updated = { ...user, name: "Trần Duyên" }
    mockFetch({
      "PATCH /auth/me": (init) => {
        expect(JSON.parse(String(init.body))).toEqual({ name: "Trần Duyên", phone: "0779666664" })
        return jsonResponse(200, { data: { user: updated, permissions: [] } })
      },
    })
    renderWithQuery(<ProfileForm />)
    expect(screen.getByLabelText("Tên đăng nhập")).toHaveValue("duyen")
    expect(screen.getByLabelText("Tên đăng nhập")).toHaveAttribute("readonly")
    const name = screen.getByLabelText("Họ và tên")
    await userEvent.clear(name)
    await userEvent.type(name, "Trần Duyên")
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }))
    await vi.waitFor(() => expect(auth.setUser).toHaveBeenCalledWith(updated))
    expect(toastSuccess).toHaveBeenCalledWith("Đã lưu hồ sơ")
  })

  it("lỗi trường từ backend hiện dưới ô", async () => {
    mockFetch({
      "PATCH /auth/me": () =>
        jsonResponse(400, {
          error: {
            code: "VALIDATION_ERROR",
            message: "Dữ liệu không hợp lệ",
            details: [{ path: "body.phone", message: "Số điện thoại phải có 10 chữ số, bắt đầu bằng 0" }],
          },
        }),
    })
    renderWithQuery(<ProfileForm />)
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }))
    expect(
      await screen.findByText("Số điện thoại phải có 10 chữ số, bắt đầu bằng 0")
    ).toBeInTheDocument()
  })
})

describe("PasswordForm", () => {
  async function fill(current: string, next: string, confirm: string) {
    await userEvent.type(screen.getByLabelText("Mật khẩu hiện tại"), current)
    await userEvent.type(screen.getByLabelText("Mật khẩu mới"), next)
    await userEvent.type(screen.getByLabelText("Nhập lại mật khẩu mới"), confirm)
    await userEvent.click(screen.getByRole("button", { name: "Đổi mật khẩu" }))
  }

  it("nhập lại không khớp → báo lỗi, không gọi API", async () => {
    renderWithQuery(<PasswordForm />)
    await fill("Matkhau123", "Moimatkhau1", "Moimatkhau2")
    expect(screen.getByText("Mật khẩu nhập lại không khớp")).toBeInTheDocument()
    expect(auth.changePassword).not.toHaveBeenCalled()
  })

  it("mật khẩu mới quá ngắn → báo lỗi", async () => {
    renderWithQuery(<PasswordForm />)
    await fill("Matkhau123", "abc1", "abc1")
    expect(screen.getByText("Mật khẩu tối thiểu 8 ký tự")).toBeInTheDocument()
    expect(auth.changePassword).not.toHaveBeenCalled()
  })

  it("thành công → gọi changePassword, xoá các ô, báo thành công", async () => {
    const changePassword = vi.fn().mockResolvedValue(undefined)
    auth = { ...auth, changePassword }
    renderWithQuery(<PasswordForm />)
    await fill("Matkhau123", "Moimatkhau1", "Moimatkhau1")
    await vi.waitFor(() => expect(changePassword).toHaveBeenCalledWith("Matkhau123", "Moimatkhau1"))
    await vi.waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Đã đổi mật khẩu"))
    expect(screen.getByLabelText("Mật khẩu hiện tại")).toHaveValue("")
  })

  it("sai mật khẩu hiện tại → lỗi dưới ô", async () => {
    auth = {
      ...auth,
      changePassword: vi.fn().mockRejectedValue(
        new ApiError(400, "VALIDATION_ERROR", "Mật khẩu hiện tại không đúng", [
          { path: "body.currentPassword", message: "Không đúng" },
        ])
      ),
    }
    renderWithQuery(<PasswordForm />)
    await fill("Saimatkhau1", "Moimatkhau1", "Moimatkhau1")
    expect(await screen.findByText("Không đúng")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/admin/account-forms.test.tsx`
Expected: FAIL — không tìm thấy module `@/components/admin/account-forms`.

- [ ] **Step 3: Implement** — `front-end/components/admin/account-forms.tsx`

```tsx
"use client"

import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { useAuth } from "@/components/admin/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiData } from "@/lib/api/client"
import { ApiError, errorMessage, fieldErrors } from "@/lib/api/errors"
import type { SessionUser } from "@/lib/auth/user"

function TextField({
  id,
  label,
  error,
  ...props
}: React.ComponentProps<typeof Input> & { id: string; label: string; error?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function handleError(error: unknown, setErrors: (errors: Record<string, string>) => void) {
  const fields = error instanceof ApiError ? fieldErrors(error.details) : {}
  setErrors(fields)
  if (Object.keys(fields).length === 0) toast.error(errorMessage(error))
}

export function ProfileForm() {
  const { user, setUser } = useAuth()
  const [name, setName] = useState(user?.name ?? "")
  const [phone, setPhone] = useState(user?.phone ?? "")
  const [errors, setErrors] = useState<Record<string, string>>({})

  const mutation = useMutation({
    mutationFn: (body: { name: string; phone: string }) =>
      apiData<{ user: SessionUser; permissions: string[] }>("/auth/me", {
        method: "PATCH",
        body,
      }),
    meta: { silent: true },
    onSuccess: (data) => {
      setUser(data.user)
      setErrors({})
      toast.success("Đã lưu hồ sơ")
    },
    onError: (error) => handleError(error, setErrors),
  })

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    mutation.mutate({ name: name.trim(), phone: phone.trim() })
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <TextField id="username" label="Tên đăng nhập" value={user?.username ?? ""} readOnly />
      <TextField
        id="name"
        label="Họ và tên"
        autoComplete="name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={errors.name}
      />
      <TextField
        id="phone"
        label="Số điện thoại"
        type="tel"
        autoComplete="tel"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        error={errors.phone}
      />
      <Button type="submit" disabled={mutation.isPending} className="self-start">
        Lưu hồ sơ
      </Button>
    </form>
  )
}

export function PasswordForm() {
  const { changePassword } = useAuth()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  const mutation = useMutation({
    mutationFn: () => changePassword(currentPassword, newPassword),
    meta: { silent: true },
    onSuccess: () => {
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setErrors({})
      toast.success("Đã đổi mật khẩu")
    },
    onError: (error) => handleError(error, setErrors),
  })

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}
    if (!currentPassword) nextErrors.currentPassword = "Vui lòng nhập mật khẩu hiện tại"
    if (newPassword.length < 8) nextErrors.newPassword = "Mật khẩu tối thiểu 8 ký tự"
    if (newPassword !== confirmPassword) nextErrors.confirmPassword = "Mật khẩu nhập lại không khớp"
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    mutation.mutate()
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <TextField
        id="currentPassword"
        label="Mật khẩu hiện tại"
        type="password"
        autoComplete="current-password"
        value={currentPassword}
        onChange={(event) => setCurrentPassword(event.target.value)}
        error={errors.currentPassword}
      />
      <TextField
        id="newPassword"
        label="Mật khẩu mới"
        type="password"
        autoComplete="new-password"
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
        error={errors.newPassword}
      />
      <TextField
        id="confirmPassword"
        label="Nhập lại mật khẩu mới"
        type="password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        error={errors.confirmPassword}
      />
      <p className="text-muted-foreground">
        Tối thiểu 8 ký tự, có chữ cái và chữ số. Các thiết bị khác sẽ phải đăng nhập lại.
      </p>
      <Button type="submit" disabled={mutation.isPending} className="self-start">
        Đổi mật khẩu
      </Button>
    </form>
  )
}
```

- [ ] **Step 4: Page** — `front-end/app/admin/(panel)/tai-khoan/page.tsx`

```tsx
import type { Metadata } from "next"
import { KeyRound, UserCircle } from "lucide-react"

import { PasswordForm, ProfileForm } from "@/components/admin/account-forms"
import { AdminPageHeader, SectionHeading } from "@/components/admin/admin-ui"

export const metadata: Metadata = {
  title: "Tài khoản",
}

export default function AccountPage() {
  return (
    <main id="admin-content" className="p-4">
      <AdminPageHeader title="Tài khoản của tôi" />
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border/70 bg-background p-4">
          <SectionHeading title="Hồ sơ" description="Tên và số điện thoại dùng để đăng nhập." icon={UserCircle} />
          <div className="mt-4">
            <ProfileForm />
          </div>
        </section>
        <section className="rounded-lg border border-border/70 bg-background p-4">
          <SectionHeading title="Đổi mật khẩu" icon={KeyRound} />
          <div className="mt-4">
            <PasswordForm />
          </div>
        </section>
      </div>
    </main>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run components/admin/account-forms.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 6: Verify and commit**

Run: `npm test && npm run typecheck && npm run lint && npm run build`

```bash
git add front-end/components/admin/account-forms.tsx front-end/components/admin/account-forms.test.tsx "front-end/app/admin/(panel)/tai-khoan"
git commit -m "feat(fe): trang tài khoản — sửa hồ sơ và đổi mật khẩu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Chạy thật với backend và tài liệu

**Files:**
- Modify: `front-end/README.md` (thay nội dung template shadcn)

**Interfaces:**
- Consumes: toàn bộ Task 1–8.
- Produces: tài liệu chạy front-end cùng backend; biên bản kiểm thử thủ công trong báo cáo task.

- [ ] **Step 1: README** — thay toàn bộ `front-end/README.md`:

```markdown
# Gia Thịnh — Front-end

Website và trang quản trị Trường lái Gia Thịnh (Next.js 16). Quy ước dự án: `AGENT.md`.

## Chạy ở máy dev

1. Chạy backend (`../back-end`, xem README ở đó) tại `http://localhost:4000`.
2. Cấu hình và chạy front-end:

   ```bash
   cp .env.example .env.local   # NEXT_PUBLIC_API_URL=/api/v1, API_ORIGIN=http://localhost:4000
   npm install
   npm run dev                  # http://localhost:3000
   ```

3. Đăng nhập quản trị: http://localhost:3000/admin/dang-nhap bằng tài khoản `SEED_ADMIN_*` của backend.

## Địa chỉ API

| Môi trường | `NEXT_PUBLIC_API_URL` | `API_ORIGIN` |
|---|---|---|
| Dev | `/api/v1` | `http://localhost:4000` |
| Preview Vercel (`*.vercel.app`) | `/api/v1` | `https://api.giathinh.vn` |
| Production (`giathinh.vn`) | `https://api.giathinh.vn/api/v1` | không cần |

- Đường dẫn tương đối: Next.js chuyển tiếp `/api/v1/*` và `/uploads/*` tới `API_ORIGIN` (bắt buộc cho preview vì `vercel.app` khác site với `api.giathinh.vn`, cookie đăng nhập sẽ không được gửi).
- Đường dẫn tuyệt đối: trình duyệt gọi thẳng; backend phải có `CORS_ORIGINS` chứa domain front-end.
- Cả hai biến được đọc lúc build: đổi giá trị thì build/deploy lại.

## Đăng nhập quản trị

- Access token chỉ giữ trong bộ nhớ; cookie `gt_refresh` (httpOnly) giữ phiên. Mở `/admin` sẽ tự cấp lại token; hết phiên thì về `/admin/dang-nhap`.
- Menu và trang hiện theo quyền của vai trò (`lib/auth/routes.ts`). Backend vẫn kiểm quyền cho mọi API.
- Quên mật khẩu: quản trị viên cấp mật khẩu tạm ở màn Người dùng; nhân viên đổi lại ở `/admin/tai-khoan`.

## Lệnh

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Chạy dev |
| `npm test` | Test (Vitest + Testing Library) |
| `npm run typecheck` / `npm run lint` | Kiểm tra kiểu / lint |
| `npm run build` && `npm start` | Build và chạy bản production |
```

- [ ] **Step 2: Chạy thật** (backend ở `back-end/` với `.env` dev có đủ `SEED_ADMIN_*`, đã `npm run seed`; front-end `.env.local` như README)

Chạy `npm run dev` ở cả hai thư mục, rồi kiểm tra bằng trình duyệt (hoặc công cụ tự động hoá trình duyệt), ghi kết quả từng mục vào báo cáo:

1. Mở `http://localhost:3000/admin/hoc-phi` khi chưa đăng nhập → về `/admin/dang-nhap?next=%2Fadmin%2Fhoc-phi`.
2. Đăng nhập bằng username → về `/admin/hoc-phi`; header hiện tên thật và "Quản trị viên".
3. Đăng xuất → về `/admin/dang-nhap`; đăng nhập lại bằng **số điện thoại** → vào `/admin`.
4. Tải lại trang (F5) → vẫn đăng nhập.
5. Hết hạn token: backend đặt `JWT_ACCESS_EXPIRES_MIN=1`, khởi động lại, đăng nhập, đợi 70 giây, mở trang tài khoản và lưu hồ sơ → thành công, tab Network có đúng một `POST /api/v1/auth/refresh` trước khi `PATCH /auth/me` gửi lại.
6. Mở hai tab `/admin`, đợi token hết hạn, tải lại cả hai gần như cùng lúc → cả hai vẫn đăng nhập (không bị đá ra).
7. Đổi mật khẩu ở `/admin/tai-khoan` → toast "Đã đổi mật khẩu", vẫn ở lại trang; đăng xuất rồi đăng nhập bằng mật khẩu mới được. (Đổi lại mật khẩu cũ sau khi thử.)
8. Tạo nhân viên vai trò `editor` (Postman: `POST /users`), đăng nhập bằng tài khoản đó → menu chỉ có Chi nhánh, Bài viết, Cài đặt, Trợ giúp; mở `/admin` → chuyển `/admin/bai-viet`; mở `/admin/hoc-phi` → màn "Không có quyền truy cập".
9. Tắt backend, tải lại `/admin` → màn "Không kết nối được máy chủ" + "Thử lại"; bật backend, bấm "Thử lại" → vào lại.
10. Mở `/admin/dang-nhap?next=//evil.com` khi đã đăng nhập → về `/admin`, không rời khỏi site.

Trả `JWT_ACCESS_EXPIRES_MIN` về 15 sau khi thử.

- [ ] **Step 3: Kiểm tra cuối**

Run (trong `front-end/`): `npm test && npm run typecheck && npm run lint && npm run build`
Run (trong `back-end/`): `npm test`
Expected: tất cả PASS.

- [ ] **Step 4: Commit**

```bash
git add front-end/README.md
git commit -m "docs(fe): hướng dẫn chạy front-end cùng backend và đăng nhập quản trị

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
