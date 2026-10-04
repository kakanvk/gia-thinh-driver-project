# Front-end đợt B — Website công khai lấy dữ liệu thật — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trang chủ, `/tu-van`, `/dien-dan`, `/dien-dan/[slug]`, header và footer lấy dữ liệu từ `/api/v1/public/*` (ISR 5 phút); form tư vấn tạo lead thật; bài viết hiển thị nội dung Plate; lượt xem đếm bằng endpoint riêng.

**Architecture:** Lớp dữ liệu server `lib/api/public.ts` (`fetch` tới `API_ORIGIN` với `next.revalidate = 300`, hàm `OrNull` cho khối có dự phòng) + các hàm thuần trong `lib/public/*` (kiểu, định dạng, liên hệ, form) và `lib/news.ts` (chuyển bài viết). Server Component lấy dữ liệu rồi truyền props cho client component (header, bảng giá có tab, form, explorer). Trình duyệt gọi API qua `apiFetch` (đợt A) cho form và lượt xem.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript strict, Tailwind 4, shadcn `base-nova`, Plate 53 (`platejs/static`), Vitest 4 + Testing Library. Backend Express 5 + Mongoose.

**Spec:** `back-end/docs/superpowers/specs/2026-10-04-fe-dot-b-website-cong-khai-design.md`

## Global Constraints

- Code front-end trong `front-end/`, backend trong `back-end/`; lệnh npm chạy trong đúng thư mục.
- Theo `front-end/AGENT.md`: mặc định Server Component, `"use client"` chỉ khi cần state/effect/event/browser API; không sửa `.next/`, `node_modules/`, `cpanel-deploy/`, `next-env.d.ts`; giữ block quy tắc trong `AGENTS.md`. Next 16 khác bản cũ: đọc `front-end/node_modules/next/dist/docs/` trước khi dùng API framework (vd. `revalidate`, `searchParams`, `fetch` options).
- Style front-end: không chấm phẩy, nháy kép, 2 space. Không chạy prettier cho cả project.
- ISR: mọi fetch công khai phía server dùng `next: { revalidate: 300 }`; trang dùng dữ liệu công khai khai báo `export const revalidate = 300` (nếu docs Next 16 vẫn hỗ trợ route segment config này; nếu không, dựa vào revalidate của fetch).
- Hotline mặc định khi settings thiếu: `0779 666 664`. Zalo = `https://zalo.me/` + chữ số hotline.
- Định dạng tiền `1.750.000đ`; ngày `dd/MM/yyyy` cắt từ chuỗi ISO (không phụ thuộc múi giờ).
- "Sắp đủ lớp" khi `seatsLeft <= 5`. Hiện tối đa 8 lớp và 8 ca thi trên trang chủ.
- Ảnh từ API: `next/image` với `unoptimized`; ảnh bìa null → khung `bg-mist` có logo `/giathinh-logo.png`.
- Diễn đàn `thao-luan`, TikTok, `/thu-vien`, `/san-tap` giữ dữ liệu tĩnh (chỉ đổi `StickyHeader` → `SiteHeader`).
- Không commit `.env`/`.env.local`/secret. Commit message tiếng Việt, kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Mọi task kết thúc với front-end `npm test && npm run typecheck && npm run lint` sạch (và `npm run build` khi sửa `app/` hoặc component dùng trong trang), backend `npm test && npm run typecheck && npm run lint` khi sửa backend.

## Review Focus

1. Backend tắt hoặc `API_ORIGIN` thiếu lúc build/render → mọi trang công khai vẫn render với khối dự phòng có hotline, `npm run build` không lỗi (test ở Task 2 cho lớp dữ liệu; Task 7 kiểm tra build/chạy thật khi backend tắt).
2. Trang chi tiết bài viết khi API lỗi 5xx tạm thời → không trả 404 (không cache 404 sai); slug không tồn tại → 404 (test ở Task 2 `getPost`).
3. Form tư vấn chọn "Chưa xác định" → không gửi `courseCode`; ô honeypot không bị người dùng hay trình đọc màn hình thấy; bấm gửi hai lần nhanh → chỉ một request (test ở Task 5).
4. Chi nhánh chưa có giá riêng hoặc không có gói nào → tab vẫn hiển thị, không vỡ layout; `pricing` null → khối dự phòng (test ở Task 4).
5. Nội dung Plate có node lạ hoặc ảnh không chú thích → trang chi tiết vẫn render phần còn lại (test ở Task 6).

---

## File Structure

| File | Trách nhiệm |
|---|---|
| `back-end/src/modules/posts/posts.public.ts` (sửa) | GET chi tiết không tăng lượt xem; `recordPublicView`, controller `recordView` |
| `back-end/src/modules/public/public.routes.ts` (sửa) | `POST /posts/:slug/view` + rate limit 30/giờ/IP |
| `back-end/src/docs/openapi.ts`, `back-end/docs/postman/*` (sửa) | Tài liệu endpoint mới |
| `back-end/tests/integration/public-content.test.ts` (sửa) | Test lượt xem |
| `front-end/lib/public/types.ts` | Kiểu phản hồi API công khai |
| `front-end/lib/public/format.ts` | Định dạng tiền/phí/ngày/lớp/ca thi, link tư vấn |
| `front-end/lib/public/contact.ts` | `SiteContact`, `toSiteContact`, giá trị mặc định |
| `front-end/lib/public/lead.ts` | `courseOptions`, `buildLeadBody`, `readUtm`, `NO_COURSE` |
| `front-end/lib/api/public.ts` | `publicGet`, `publicGetOrNull`, các hàm lấy dữ liệu |
| `front-end/components/site-header.tsx` | Server wrapper lấy liên hệ cho `StickyHeader` |
| `front-end/components/sticky-header.tsx`, `site-footer.tsx` (sửa) | Liên hệ/chi nhánh động |
| `front-end/components/pricing-section.tsx` | Bảng giá có tab chi nhánh (client) |
| `front-end/components/class-schedule.tsx`, `exam-schedule.tsx` | Lịch khai giảng, lịch thi (server) |
| `front-end/components/consultation-form.tsx` (viết lại) | Form gửi lead |
| `front-end/lib/news.ts` (sửa) | Kiểu `NewsPost`/`NewsCategory`, `toNewsPost`, hàm tìm kiếm/sắp xếp |
| `front-end/components/news-explorer.tsx`, `news-card.tsx` (sửa) | Chuyên mục động, ảnh null |
| `front-end/components/post-content.tsx`, `ui/image-node-static.tsx` | Render nội dung Plate |
| `front-end/components/post-view-tracker.tsx` | Gọi đếm lượt xem |
| `front-end/app/page.tsx`, `app/tu-van/page.tsx`, `app/dien-dan/page.tsx`, `app/dien-dan/[slug]/page.tsx`, các trang dùng header (sửa) | Lấy dữ liệu, ghép component |
| `front-end/lib/contact.ts` (xoá) | Thay bằng API |

---

### Task 1: Backend — đếm lượt xem bằng endpoint riêng

**Files:**
- Modify: `back-end/src/modules/posts/posts.public.ts:85-91`
- Modify: `back-end/src/modules/public/public.routes.ts`
- Modify: `back-end/src/docs/openapi.ts` (mục `'/public/posts/{slug}'`)
- Modify: `back-end/tests/integration/public-content.test.ts` (test "chi tiết: trả content, tăng lượt xem…")
- Regenerate: `back-end/docs/postman/gia-thinh-api.postman_collection.json`

**Interfaces:**
- Produces: `POST /api/v1/public/posts/:slug/view` → 204; 404 khi bài không công khai; 429 sau 30 lần/giờ/IP. `GET /api/v1/public/posts/:slug` không đổi `views`.

- [ ] **Step 1: Update the test** — trong `back-end/tests/integration/public-content.test.ts`, thay test `'chi tiết: trả content, tăng lượt xem; bài nháp/hẹn giờ/đã xóa → 404'` bằng:

```ts
  it('chi tiết: trả content, không tăng lượt xem; bài nháp/hẹn giờ/đã xóa → 404', async () => {
    const cat = await createCategory();
    await post(cat.id, { slug: 'xem' });
    await post(cat.id, { slug: 'nhap', status: 'draft' });
    await post(cat.id, { slug: 'tuong-lai', publishedAt: new Date(Date.now() + 86_400_000) });
    await post(cat.id, { slug: 'da-xoa', deletedAt: new Date() });
    const app = createApp();
    const first = await request(app).get('/api/v1/public/posts/xem');
    expect(first.status).toBe(200);
    expect(first.body.data.content).toEqual(content);
    await request(app).get('/api/v1/public/posts/xem');
    expect((await Post.findOne({ slug: 'xem' }))?.views).toBe(0);
    for (const slug of ['nhap', 'tuong-lai', 'da-xoa', 'khong-co']) {
      expect((await request(app).get(`/api/v1/public/posts/${slug}`)).status).toBe(404);
    }
  });

  it('POST /view tăng lượt xem bài công khai, 404 với bài không công khai, giới hạn 30 lần/giờ', async () => {
    const cat = await createCategory();
    await post(cat.id, { slug: 'xem' });
    await post(cat.id, { slug: 'nhap', status: 'draft' });
    await post(cat.id, { slug: 'da-xoa', deletedAt: new Date() });
    const app = createApp();
    expect((await request(app).post('/api/v1/public/posts/xem/view')).status).toBe(204);
    expect((await request(app).post('/api/v1/public/posts/xem/view')).status).toBe(204);
    expect((await Post.findOne({ slug: 'xem' }))?.views).toBe(2);
    expect((await request(app).post('/api/v1/public/posts/nhap/view')).status).toBe(404);
    expect((await request(app).post('/api/v1/public/posts/da-xoa/view')).status).toBe(404);
    expect((await request(app).post('/api/v1/public/posts/khong-co/view')).status).toBe(404);
    for (let i = 0; i < 25; i += 1) await request(app).post('/api/v1/public/posts/xem/view');
    const limited = await request(app).post('/api/v1/public/posts/xem/view');
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
  });
```

(Đếm: 2 + 3 lỗi 404 + 25 = 30 request trong giới hạn; request thứ 31 bị 429. Nếu `post()` helper trong file dùng `deletedAt` khác, giữ đúng cách file đang tạo bài đã xoá.)

- [ ] **Step 2: Run to verify fail**

Run (trong `back-end/`): `npx vitest run tests/integration/public-content.test.ts`
Expected: FAIL — `views` là 2 thay vì 0; `/view` trả 404.

- [ ] **Step 3: Implement service** — trong `back-end/src/modules/posts/posts.public.ts` thay `getPublicPost` và thêm hàm mới ngay dưới:

```ts
export async function getPublicPost(slug: string) {
  const post = await Post.findOne({ ...visibleFilter(), slug });
  if (!post) throw ApiError.notFound('Không tìm thấy bài viết');
  const categories = await categoryMap();
  return { ...summarize(post, categories), content: post.content };
}

// Lượt xem đếm riêng: GET chi tiết được website gọi khi render/ISR nên không dùng để đếm
export async function recordPublicView(slug: string): Promise<void> {
  const result = await Post.updateOne({ ...visibleFilter(), slug, deletedAt: null }, { $inc: { views: 1 } });
  if (result.matchedCount === 0) throw ApiError.notFound('Không tìm thấy bài viết');
}
```

và thêm controller cạnh `getPost`:

```ts
export async function recordView(req: Request, res: Response): Promise<void> {
  await recordPublicView(validated<{ slug: string }>(req, 'params').slug);
  res.status(204).end();
}
```

(Kiểm tra `summarize()` đã trả `views: post.views`; nếu có, bỏ dòng `views: post.views + 1` cũ là đủ.)

- [ ] **Step 4: Route** — trong `back-end/src/modules/public/public.routes.ts`, ngay sau dòng `router.get('/posts/:slug', ...)` thêm:

```ts
  const viewLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    limit: 30,
    message: 'Quá nhiều lượt xem từ địa chỉ này, vui lòng thử lại sau',
  });
  router.post('/posts/:slug/view', viewLimiter, validate({ params: publicSlugParamsSchema }), publicPosts.recordView);
```

- [ ] **Step 5: OpenAPI** — trong `back-end/src/docs/openapi.ts`: đổi summary `'Chi tiết tin (+1 lượt xem)'` thành `'Chi tiết tin'`, và thêm mục mới ngay sau khối `'/public/posts/{slug}'`:

```ts
    '/public/posts/{slug}/view': {
      post: op(
        'Công khai',
        'Ghi một lượt xem tin (giới hạn 30 lần/giờ/IP)',
        {
          parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        },
        false,
      ),
    },
```

Rồi `npm run postman` để sinh lại collection.

- [ ] **Step 6: Verify**

Run: `npx vitest run tests/integration/public-content.test.ts tests/unit/postman.test.ts` → PASS; `npm run typecheck && npm run lint && npm test` → PASS.

- [ ] **Step 7: Commit**

```bash
git add back-end/src/modules/posts/posts.public.ts back-end/src/modules/public/public.routes.ts back-end/src/docs/openapi.ts back-end/docs/postman back-end/tests/integration/public-content.test.ts
git commit -m "feat(be): đếm lượt xem tin bằng POST /public/posts/:slug/view

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Front-end — lớp dữ liệu công khai

**Files:**
- Create: `front-end/lib/public/types.ts`, `front-end/lib/public/format.ts`, `front-end/lib/public/contact.ts`, `front-end/lib/public/lead.ts`, `front-end/lib/api/public.ts`
- Test: `front-end/lib/public/public.test.ts`, `front-end/lib/api/public.test.ts`

**Interfaces:**
- Consumes: `mockFetch`, `jsonResponse` (`@/test/fetch-mock`, đợt A).
- Produces (exact names, later tasks import these):
  - `@/lib/public/types`: `PublicImage`, `PublicSettings`, `PublicBranch`, `VehicleType`, `PricingItem`, `PricingCourse`, `BranchPricing`, `UpcomingClass`, `UpcomingExam`, `PublicCategory`, `PostSummary`, `PostDetail`, `PageMeta`.
  - `@/lib/public/format`: `formatVnd(n)`, `formatPricingItem(item)`, `formatDate(iso)`, `readTimeLabel(minutes)`, `VEHICLE_LABELS`, `transmissionLabel(t)`, `classTitle(c)`, `classStatus(c): { label: string; urgent: boolean }`, `seatsLabel(n)`, `EXAM_TYPE_LABELS`, `consultHref(branchSlug, courseCode?)`.
  - `@/lib/public/contact`: `type SiteContact = { hotline: string; telHref: string; zaloHref: string; contactTimes: { label: string; value: string }[]; registerNotes: string[] }`, `DEFAULT_HOTLINE`, `DEFAULT_CONTACT_TIMES`, `DEFAULT_REGISTER_NOTES`, `toSiteContact(settings: PublicSettings | null): SiteContact`.
  - `@/lib/public/lead`: `NO_COURSE = "none"`, `type CourseOption = { code: string; name: string }`, `courseOptions(pricing: BranchPricing[] | null): CourseOption[]`, `type LeadFields`, `readUtm(search: string)`, `buildLeadBody(fields: LeadFields, search: string): Record<string, unknown>`.
  - `@/lib/api/public`: `PUBLIC_REVALIDATE = 300`, `class PublicApiError { status }`, `publicFetch<T>(path, query?)`, `publicGet<T>(path, query?)`, `publicGetOrNull<T>(path, query?)`, `getSettings()`, `getSiteContact(): Promise<SiteContact>`, `getBranches()`, `getPricing()`, `getUpcomingClasses()`, `getUpcomingExams()`, `getCategories()`, `getLatestPosts(limit)`, `getAllPosts(maxPages?)`, `getPost(slug): Promise<PostDetail | null>`, `getRelatedPosts(categorySlug: string | null, excludeSlug: string): Promise<PostSummary[]>`.

- [ ] **Step 1: Types** — `front-end/lib/public/types.ts`

```ts
// Kiểu phản hồi của /api/v1/public/* (back-end/src/modules/public)
export type PublicImage = { url: string; alt: string }

export type PublicSettings = Partial<{
  hotline: string
  zaloOa: string
  supportEmail: string
  socials: { label: string; url: string }[]
  registerNotes: string[]
  consultationContactTimes: { label: string; value: string }[]
}>

export type PublicBranch = {
  id: string
  name: string
  slug: string
  officeName: string
  address: string
  mapUrl?: string | null
  phone?: string | null
  openingHours?: string | null
  order: number
}

export type VehicleType = "moto" | "car" | "truck"

export type PricingItem = {
  key: string
  label: string
  amount: number | null
  amountMax: number | null
  unit: string | null
  note: string | null
}

// API không trả `order`: các gói đã được sắp theo thứ tự hiển thị trong từng chi nhánh
export type PricingCourse = {
  code: string
  name: string
  vehicleType: VehicleType
  description: string | null
  duration: string | null
  image: PublicImage | null
  price: number
  priceNote: string | null
  fees: PricingItem[]
  discounts: PricingItem[]
}

export type BranchPricing = {
  branch: { name: string; slug: string; officeName: string; address: string }
  courses: PricingCourse[]
}

export type UpcomingClass = {
  code: string
  course: { code: string; name: string }
  transmission: "manual" | "automatic" | null
  branch: { name: string; slug: string }
  startDate: string
  endDate: string | null
  scheduleText: string | null
  seatsLeft: number
  status: "enrolling" | "upcoming"
}

export type UpcomingExam = {
  type: "graduation" | "official"
  course: { code: string; name: string }
  branch: { name: string; slug: string }
  date: string
  location: string | null
}

export type PublicCategory = {
  name: string
  slug: string
  description: string | null
  isAnnouncement: boolean
  postCount: number
}

export type PostSummary = {
  slug: string
  title: string
  excerpt: string
  cover: PublicImage | null
  tags: string[]
  authorName: string
  publishedAt: string
  readTimeMinutes: number
  views: number
  category: { name: string; slug: string; isAnnouncement: boolean } | null
}

export type PostDetail = PostSummary & { content: unknown[] }

export type PageMeta = { page: number; limit: number; total: number }
```

Trước khi tiếp, đối chiếu nhanh với backend (`back-end/src/modules/branches/branches.service.ts` hàm public, `pricing.service.ts`, `classes.public.ts`, `exams.public.ts`, `posts.public.ts` hàm `summarize`): nếu trường nào khác tên/kiểu (vd. `scheduleText` luôn là string), sửa kiểu cho khớp backend và ghi vào báo cáo.

- [ ] **Step 2: Write the failing test** — `front-end/lib/public/public.test.ts`

```ts
import { describe, expect, it } from "vitest"

import { toSiteContact, DEFAULT_CONTACT_TIMES, DEFAULT_REGISTER_NOTES } from "@/lib/public/contact"
import {
  classStatus,
  classTitle,
  consultHref,
  formatDate,
  formatPricingItem,
  formatVnd,
  readTimeLabel,
  seatsLabel,
} from "@/lib/public/format"
import { buildLeadBody, courseOptions, NO_COURSE, readUtm } from "@/lib/public/lead"
import type { BranchPricing, PricingItem, UpcomingClass } from "@/lib/public/types"

const item = (over: Partial<PricingItem>): PricingItem => ({
  key: "k",
  label: "Thuê xe cảm biến",
  amount: null,
  amountMax: null,
  unit: null,
  note: null,
  ...over,
})

const upcoming = (over: Partial<UpcomingClass>): UpcomingClass => ({
  code: "L1",
  course: { code: "B", name: "Hạng B" },
  transmission: "automatic",
  branch: { name: "Tân Ngãi", slug: "tan-ngai" },
  startDate: "2026-10-21T00:00:00+07:00",
  endDate: null,
  scheduleText: "T2–T6",
  seatsLeft: 12,
  status: "enrolling",
  ...over,
})

describe("format", () => {
  it("tiền và mục phí", () => {
    expect(formatVnd(1750000)).toBe("1.750.000đ")
    expect(formatPricingItem(item({ amount: 300000, amountMax: 600000, unit: "giờ" }))).toBe(
      "Thuê xe cảm biến: 300.000–600.000đ/giờ"
    )
    expect(formatPricingItem(item({ amount: 70000, unit: "vòng", note: "xe A" }))).toBe(
      "Thuê xe cảm biến: 70.000đ/vòng (xe A)"
    )
    expect(formatPricingItem(item({ amount: 50000, amountMax: 50000 }))).toBe("Thuê xe cảm biến: 50.000đ")
    expect(formatPricingItem(item({ note: "tuỳ nhu cầu" }))).toBe("Thuê xe cảm biến (tuỳ nhu cầu)")
  })

  it("ngày và thời gian đọc không phụ thuộc múi giờ", () => {
    expect(formatDate("2026-10-21T00:00:00+07:00")).toBe("21/10/2026")
    expect(formatDate("không phải ngày")).toBe("không phải ngày")
    expect(readTimeLabel(0)).toBe("1 phút đọc")
    expect(readTimeLabel(4)).toBe("4 phút đọc")
  })

  it("lớp khai giảng", () => {
    expect(classTitle(upcoming({}))).toBe("Hạng B (số tự động)")
    expect(classTitle(upcoming({ transmission: null }))).toBe("Hạng B")
    expect(classStatus(upcoming({ seatsLeft: 5 }))).toEqual({ label: "Sắp đủ lớp", urgent: true })
    expect(classStatus(upcoming({}))).toEqual({ label: "Đang nhận hồ sơ", urgent: false })
    expect(classStatus(upcoming({ status: "upcoming" }))).toEqual({ label: "Sắp khai giảng", urgent: false })
    expect(seatsLabel(0)).toBe("Hết chỗ")
    expect(seatsLabel(8)).toBe("Còn 8 chỗ")
  })

  it("link tư vấn", () => {
    expect(consultHref("tan-ngai", "B")).toBe("/tu-van?branch=tan-ngai&course=B")
    expect(consultHref("tan-ngai")).toBe("/tu-van?branch=tan-ngai")
  })
})

describe("toSiteContact", () => {
  it("dùng settings khi có", () => {
    const contact = toSiteContact({
      hotline: "0909 123 456",
      consultationContactTimes: [{ label: "Sáng", value: "Sáng" }],
      registerNotes: ["Mang CCCD"],
    })
    expect(contact).toEqual({
      hotline: "0909 123 456",
      telHref: "tel:0909123456",
      zaloHref: "https://zalo.me/0909123456",
      contactTimes: [{ label: "Sáng", value: "Sáng" }],
      registerNotes: ["Mang CCCD"],
    })
  })

  it("thiếu settings → mặc định", () => {
    const contact = toSiteContact(null)
    expect(contact.hotline).toBe("0779 666 664")
    expect(contact.telHref).toBe("tel:0779666664")
    expect(contact.contactTimes).toBe(DEFAULT_CONTACT_TIMES)
    expect(contact.registerNotes).toBe(DEFAULT_REGISTER_NOTES)
    expect(toSiteContact({ hotline: "  ", registerNotes: [] }).registerNotes).toBe(DEFAULT_REGISTER_NOTES)
  })
})

describe("lead", () => {
  // API trả gói đã sắp theo thứ tự hiển thị trong từng chi nhánh (không có trường order)
  const pricing = [
    { branch: { name: "A", slug: "a", officeName: "VP A", address: "" }, courses: [
      { code: "A1", name: "Hạng A1" },
      { code: "B", name: "Hạng B" },
    ] },
    { branch: { name: "C", slug: "c", officeName: "VP C", address: "" }, courses: [
      { code: "A1", name: "Hạng A1" },
      { code: "C1", name: "Hạng C1" },
    ] },
  ] as unknown as BranchPricing[]

  it("danh sách gói duy nhất theo thứ tự", () => {
    expect(courseOptions(pricing)).toEqual([
      { code: "A1", name: "Hạng A1" },
      { code: "B", name: "Hạng B" },
      { code: "C1", name: "Hạng C1" },
    ])
    expect(courseOptions(null)).toEqual([])
  })

  it("utm từ URL", () => {
    expect(readUtm("?utm_source=fb&utm_campaign=%20thang10%20&x=1")).toEqual({
      source: "fb",
      campaign: "thang10",
    })
    expect(readUtm("")).toBeUndefined()
  })

  it("body gửi lead", () => {
    const fields = {
      name: " An ",
      phone: " 0909123456 ",
      branch: "tan-ngai",
      courseCode: "B",
      preferredContactTime: "Buổi sáng",
      note: "  ",
      website: "",
    }
    expect(buildLeadBody(fields, "?utm_source=fb")).toEqual({
      name: "An",
      phone: "0909123456",
      branch: "tan-ngai",
      courseCode: "B",
      preferredContactTime: "Buổi sáng",
      consent: true,
      website: "",
      utm: { source: "fb" },
    })
    expect(buildLeadBody({ ...fields, courseCode: NO_COURSE, note: "Học tối" }, "")).toEqual({
      name: "An",
      phone: "0909123456",
      branch: "tan-ngai",
      preferredContactTime: "Buổi sáng",
      note: "Học tối",
      consent: true,
      website: "",
    })
  })
})
```

- [ ] **Step 3: Run to verify fail**

Run (trong `front-end/`): `npx vitest run lib/public/public.test.ts`
Expected: FAIL — không tìm thấy module.

- [ ] **Step 4: Implement format** — `front-end/lib/public/format.ts`

```ts
import type { PricingItem, UpcomingClass, UpcomingExam, VehicleType } from "@/lib/public/types"

const vnd = new Intl.NumberFormat("vi-VN")

export function formatVnd(amount: number): string {
  return `${vnd.format(amount)}đ`
}

export function formatPricingItem(item: PricingItem): string {
  const note = item.note ? ` (${item.note})` : ""
  if (item.amount === null) return `${item.label}${note}`
  const amount =
    item.amountMax !== null && item.amountMax !== item.amount
      ? `${vnd.format(item.amount)}–${formatVnd(item.amountMax)}`
      : formatVnd(item.amount)
  const unit = item.unit ? `/${item.unit}` : ""
  return `${item.label}: ${amount}${unit}${note}`
}

// API trả ISO có offset +07:00: cắt yyyy-mm-dd để không lệch ngày theo múi giờ máy chủ
export function formatDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso
}

export function readTimeLabel(minutes: number): string {
  return `${Math.max(1, Math.round(minutes))} phút đọc`
}

export const VEHICLE_LABELS: Record<VehicleType, string> = {
  moto: "Xe máy",
  car: "Ô tô",
  truck: "Ô tô tải",
}

export function transmissionLabel(transmission: UpcomingClass["transmission"]): string | null {
  if (transmission === "manual") return "số sàn"
  if (transmission === "automatic") return "số tự động"
  return null
}

export function classTitle(item: UpcomingClass): string {
  const transmission = transmissionLabel(item.transmission)
  return transmission ? `${item.course.name} (${transmission})` : item.course.name
}

export function classStatus(item: UpcomingClass): { label: string; urgent: boolean } {
  if (item.seatsLeft <= 5) return { label: "Sắp đủ lớp", urgent: true }
  if (item.status === "enrolling") return { label: "Đang nhận hồ sơ", urgent: false }
  return { label: "Sắp khai giảng", urgent: false }
}

export function seatsLabel(seatsLeft: number): string {
  return seatsLeft <= 0 ? "Hết chỗ" : `Còn ${seatsLeft} chỗ`
}

export const EXAM_TYPE_LABELS: Record<UpcomingExam["type"], string> = {
  graduation: "Thi tốt nghiệp",
  official: "Thi sát hạch",
}

export function consultHref(branchSlug: string, courseCode?: string): string {
  const params = new URLSearchParams({ branch: branchSlug })
  if (courseCode) params.set("course", courseCode)
  return `/tu-van?${params.toString()}`
}
```

- [ ] **Step 5: Implement contact** — `front-end/lib/public/contact.ts`

```ts
import type { PublicSettings } from "@/lib/public/types"

export type SiteContact = {
  hotline: string
  telHref: string
  zaloHref: string
  contactTimes: { label: string; value: string }[]
  registerNotes: string[]
}

export const DEFAULT_HOTLINE = "0779 666 664"

export const DEFAULT_CONTACT_TIMES = [
  { label: "Buổi sáng, 07:00–11:30", value: "Buổi sáng (07:00–11:30)" },
  { label: "Buổi chiều, 13:00–17:30", value: "Buổi chiều (13:00–17:30)" },
  { label: "Buổi tối, 18:00–21:00", value: "Buổi tối (18:00–21:00)" },
  { label: "Liên hệ lúc nào cũng được", value: "Bất kỳ thời gian nào" },
]

export const DEFAULT_REGISTER_NOTES = [
  "Học phí công khai giá gốc — nên đến trực tiếp văn phòng Gia Thịnh để đăng ký.",
  "Đã có GPLX trước đây phải trình báo cho nhân viên tư vấn khi đăng ký.",
  "Đăng ký xong nhớ lấy biên lai và liên hệ Gia Thịnh để vào nhóm Zalo nhận lịch ôn, thi.",
  "Có hỗ trợ ôn kèm luật 1:1 (phí riêng) nếu có nhu cầu.",
]

export function toSiteContact(settings: PublicSettings | null): SiteContact {
  const hotline = settings?.hotline?.trim() || DEFAULT_HOTLINE
  const digits = hotline.replace(/\D/g, "")
  return {
    hotline,
    telHref: `tel:${digits}`,
    // zaloOa là tên OA, không phải đường dẫn: Zalo cá nhân theo số hotline
    zaloHref: `https://zalo.me/${digits}`,
    contactTimes: settings?.consultationContactTimes?.length
      ? settings.consultationContactTimes
      : DEFAULT_CONTACT_TIMES,
    registerNotes: settings?.registerNotes?.length ? settings.registerNotes : DEFAULT_REGISTER_NOTES,
  }
}
```

- [ ] **Step 6: Implement lead** — `front-end/lib/public/lead.ts`

```ts
import type { BranchPricing } from "@/lib/public/types"

export const NO_COURSE = "none"

export type CourseOption = { code: string; name: string }

// API trả gói đã sắp theo thứ tự hiển thị trong từng chi nhánh: giữ thứ tự gặp đầu tiên
export function courseOptions(pricing: BranchPricing[] | null): CourseOption[] {
  const byCode = new Map<string, CourseOption>()
  for (const branch of pricing ?? []) {
    for (const course of branch.courses) {
      if (!byCode.has(course.code)) byCode.set(course.code, { code: course.code, name: course.name })
    }
  }
  return [...byCode.values()]
}

export type LeadFields = {
  name: string
  phone: string
  branch: string
  courseCode: string
  preferredContactTime: string
  note: string
  website: string
}

const UTM_KEYS = ["source", "medium", "campaign", "term", "content"] as const

export function readUtm(search: string): Record<string, string> | undefined {
  const params = new URLSearchParams(search)
  const utm: Record<string, string> = {}
  for (const key of UTM_KEYS) {
    const value = params.get(`utm_${key}`)?.trim()
    if (value) utm[key] = value.slice(0, 100)
  }
  return Object.keys(utm).length > 0 ? utm : undefined
}

export function buildLeadBody(fields: LeadFields, search: string): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: fields.name.trim(),
    phone: fields.phone.trim(),
    branch: fields.branch,
  }
  if (fields.courseCode && fields.courseCode !== NO_COURSE) body.courseCode = fields.courseCode
  if (fields.preferredContactTime) body.preferredContactTime = fields.preferredContactTime
  const note = fields.note.trim()
  if (note) body.note = note
  body.consent = true
  body.website = fields.website
  const utm = readUtm(search)
  if (utm) body.utm = utm
  return body
}
```

Đối chiếu `utmSchema` trong `back-end/src/modules/leads/leads.validation.ts`: nếu độ dài tối đa mỗi trường khác 100, đổi `slice(0, 100)` cho khớp.

- [ ] **Step 7: Run** `npx vitest run lib/public/public.test.ts` → PASS.

- [ ] **Step 8: Write the failing test** — `front-end/lib/api/public.test.ts`

```ts
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
```

- [ ] **Step 9: Run to verify fail** — `npx vitest run lib/api/public.test.ts` → FAIL (module missing).

- [ ] **Step 10: Implement** — `front-end/lib/api/public.ts`

```ts
import { toSiteContact, type SiteContact } from "@/lib/public/contact"
import type {
  BranchPricing,
  PageMeta,
  PostDetail,
  PostSummary,
  PublicBranch,
  PublicCategory,
  PublicSettings,
  UpcomingClass,
  UpcomingExam,
} from "@/lib/public/types"

// Dữ liệu công khai đọc phía server (Server Component), cache ISR 5 phút.
export const PUBLIC_REVALIDATE = 300

export class PublicApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = "PublicApiError"
  }
}

type Query = Record<string, string | number | undefined>

function publicUrl(path: string, query?: Query): string {
  const origin = process.env.API_ORIGIN?.replace(/\/+$/, "")
  if (!origin) throw new PublicApiError(0, "Thiếu API_ORIGIN")
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") params.append(key, String(value))
  }
  const search = params.toString()
  return `${origin}/api/v1/public${path}${search ? `?${search}` : ""}`
}

export async function publicFetch<T>(path: string, query?: Query): Promise<T> {
  const url = publicUrl(path, query)
  let res: Response
  try {
    res = await fetch(url, { next: { revalidate: PUBLIC_REVALIDATE } })
  } catch {
    throw new PublicApiError(0, `Không kết nối được API (${path})`)
  }
  if (!res.ok) throw new PublicApiError(res.status, `API ${path} trả ${res.status}`)
  return (await res.json()) as T
}

export async function publicGet<T>(path: string, query?: Query): Promise<T> {
  return (await publicFetch<{ data: T }>(path, query)).data
}

// Khối có dự phòng trên trang: lỗi API không làm hỏng trang
export async function publicGetOrNull<T>(path: string, query?: Query): Promise<T | null> {
  try {
    return await publicGet<T>(path, query)
  } catch (error) {
    console.error(`[public-api] ${path}`, error)
    return null
  }
}

export const getSettings = () => publicGetOrNull<PublicSettings>("/settings")
export const getBranches = () => publicGetOrNull<PublicBranch[]>("/branches")
export const getPricing = () => publicGetOrNull<BranchPricing[]>("/pricing")
export const getUpcomingClasses = () => publicGetOrNull<UpcomingClass[]>("/classes/upcoming")
export const getUpcomingExams = () => publicGetOrNull<UpcomingExam[]>("/exams/upcoming")
export const getCategories = () => publicGetOrNull<PublicCategory[]>("/categories")

export async function getSiteContact(): Promise<SiteContact> {
  return toSiteContact(await getSettings())
}

export function getLatestPosts(limit: number) {
  return publicGetOrNull<PostSummary[]>("/posts", { limit })
}

export async function getAllPosts(maxPages = 10): Promise<PostSummary[] | null> {
  const posts: PostSummary[] = []
  for (let page = 1; page <= maxPages; page += 1) {
    let body: { data: PostSummary[]; meta: PageMeta }
    try {
      body = await publicFetch<{ data: PostSummary[]; meta: PageMeta }>("/posts", { page, limit: 50 })
    } catch (error) {
      console.error("[public-api] /posts", error)
      return page === 1 ? null : posts
    }
    posts.push(...body.data)
    if (body.data.length === 0 || posts.length >= body.meta.total) break
  }
  return posts
}

// 404 → null (trang gọi notFound); lỗi khác ném ra để ISR giữ bản đã cache
export async function getPost(slug: string): Promise<PostDetail | null> {
  try {
    return await publicGet<PostDetail>(`/posts/${encodeURIComponent(slug)}`)
  } catch (error) {
    if (error instanceof PublicApiError && error.status === 404) return null
    throw error
  }
}

export async function getRelatedPosts(
  categorySlug: string | null,
  excludeSlug: string
): Promise<PostSummary[]> {
  const list = await publicGetOrNull<PostSummary[]>(
    "/posts",
    categorySlug ? { category: categorySlug, limit: 5 } : { limit: 5 }
  )
  return (list ?? []).filter((post) => post.slug !== excludeSlug).slice(0, 4)
}
```

(`RequestInit.next` có kiểu nhờ Next.js; nếu typecheck báo lỗi, xem `node_modules/next/dist/docs` mục `fetch` và dùng đúng kiểu.)

- [ ] **Step 11: Run** `npx vitest run lib/public lib/api/public.test.ts` → PASS; `npm test && npm run typecheck && npm run lint` → PASS.

- [ ] **Step 12: Commit**

```bash
git add front-end/lib/public front-end/lib/api/public.ts front-end/lib/api/public.test.ts
git commit -m "feat(fe): lớp dữ liệu công khai — gọi API phía server với ISR, định dạng, liên hệ, form

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Liên hệ và chi nhánh — header, footer, trang chủ, `/tu-van`

**Files:**
- Create: `front-end/components/site-header.tsx`
- Modify: `front-end/components/sticky-header.tsx`, `front-end/components/site-footer.tsx`
- Modify: các trang đang render `<StickyHeader />`: `app/page.tsx`, `app/san-tap/page.tsx`, `app/thao-luan/page.tsx`, `app/thao-luan/[slug]/page.tsx`, `app/thao-luan/dang-bai/page.tsx`, `app/dien-dan/page.tsx`, `app/tu-van/page.tsx`, `app/dien-dan/[slug]/page.tsx`
- Modify: `app/page.tsx` (khối văn phòng + khối `#lien-he`), `app/tu-van/page.tsx` (`supportDetails`, link Zalo)
- Test: `front-end/components/site-chrome.test.tsx`

**Interfaces:**
- Consumes: `getSiteContact`, `getBranches` (Task 2), `SiteContact`, `PublicBranch`.
- Produces: `SiteHeader()` (async Server Component, không props); `StickyHeader({ contact }: { contact: { hotline: string; telHref: string } })`; `SiteFooter()` async; `OfficeList({ branches }: { branches: PublicBranch[] | null })` (Server Component trong `components/office-list.tsx`, dùng ở trang chủ).

- [ ] **Step 1: Write the failing test** — `front-end/components/site-chrome.test.tsx`

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { OfficeList } from "@/components/office-list"
import { StickyHeader } from "@/components/sticky-header"

vi.mock("next/navigation", () => ({ usePathname: () => "/" }))
vi.mock("motion/react", () => ({ useScroll: () => ({ scrollY: 0 }), useMotionValueEvent: () => undefined }))

describe("StickyHeader", () => {
  it("dùng hotline được truyền vào", () => {
    render(<StickyHeader contact={{ hotline: "0909 123 456", telHref: "tel:0909123456" }} />)
    const links = screen.getAllByRole("link").filter((a) => a.getAttribute("href") === "tel:0909123456")
    expect(links.length).toBeGreaterThan(0)
    expect(screen.queryByText(/0779 666 664/)).not.toBeInTheDocument()
  })
})

describe("OfficeList", () => {
  it("liệt kê mọi chi nhánh; có mapUrl thì là link", () => {
    render(
      <OfficeList
        branches={[
          { id: "1", name: "Tân Ngãi", slug: "tan-ngai", officeName: "VP1 — Tân Ngãi", address: "331A", mapUrl: "https://maps.example/1", order: 1 },
          { id: "2", name: "Vũng Liêm", slug: "vung-liem", officeName: "VP Vũng Liêm", address: "QL 53", mapUrl: null, order: 2 },
        ]}
      />
    )
    expect(screen.getByRole("link", { name: /VP1 — Tân Ngãi/ })).toHaveAttribute("href", "https://maps.example/1")
    expect(screen.getByText("VP Vũng Liêm")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /VP Vũng Liêm/ })).not.toBeInTheDocument()
  })

  it("không có dữ liệu → thông báo dự phòng", () => {
    render(<OfficeList branches={null} />)
    expect(screen.getByText(/đang được cập nhật/)).toBeInTheDocument()
  })
})
```

(Nếu mock `motion/react` không khớp cách `StickyHeader` dùng `useScroll`/`useMotionValueEvent`, chỉnh mock tối thiểu cho chạy được; không đổi hành vi component.)

- [ ] **Step 2: Run to verify fail** — `npx vitest run components/site-chrome.test.tsx` → FAIL.

- [ ] **Step 3: StickyHeader nhận props** — trong `components/sticky-header.tsx`:
  - Đổi chữ ký: `export function StickyHeader({ contact }: { contact: { hotline: string; telHref: string } })`.
  - Thay mọi `href="tel:0779666664"` bằng `href={contact.telHref}`, mọi chữ `0779 666 664` bằng `{contact.hotline}`, `aria-label="Gọi ngay 0779 666 664"` bằng ``aria-label={`Gọi ngay ${contact.hotline}`}``.
  - `grep -n "0779" components/sticky-header.tsx` phải không còn kết quả.

- [ ] **Step 4: SiteHeader** — `components/site-header.tsx`

```tsx
import { StickyHeader } from "@/components/sticky-header"
import { getSiteContact } from "@/lib/api/public"

// Header client cần hotline: lấy ở server (ISR) rồi truyền xuống
export async function SiteHeader() {
  const contact = await getSiteContact()
  return <StickyHeader contact={{ hotline: contact.hotline, telHref: contact.telHref }} />
}
```

Ở 8 trang trong danh sách Files: đổi `import { StickyHeader } from "@/components/sticky-header"` → `import { SiteHeader } from "@/components/site-header"` và `<StickyHeader />` → `<SiteHeader />`. Kiểm tra: `grep -rn "<StickyHeader" app` không còn kết quả.

- [ ] **Step 5: OfficeList** — `components/office-list.tsx` (lấy markup thẻ văn phòng ở cột phải khối "Hệ thống văn phòng" của `app/page.tsx` hiện tại):

```tsx
import { Building2, ChevronRight } from "lucide-react"

import type { PublicBranch } from "@/lib/public/types"

function OfficeBody({ branch }: { branch: PublicBranch }) {
  return (
    <>
      <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <Building2 aria-hidden="true" className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold text-navy">{branch.officeName}</span>
        <span className="mt-1.5 block text-sm leading-6 text-muted-foreground">{branch.address}</span>
      </span>
    </>
  )
}

const cardClass =
  "group flex flex-1 items-center gap-4 rounded-md border border-primary/15 bg-background px-5 py-4"

export function OfficeList({ branches }: { branches: PublicBranch[] | null }) {
  if (!branches?.length) {
    return (
      <p className="rounded-md border border-primary/15 bg-background px-5 py-4 text-sm text-muted-foreground">
        Danh sách văn phòng đang được cập nhật, vui lòng gọi hotline để được hướng dẫn.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      {branches.map((branch) =>
        branch.mapUrl ? (
          <a
            key={branch.slug}
            href={branch.mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Xem bản đồ ${branch.officeName}`}
            className={`${cardClass} transition-colors hover:border-primary/40 hover:bg-primary/[0.04]`}
          >
            <OfficeBody branch={branch} />
            <ChevronRight
              aria-hidden="true"
              className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-1"
            />
          </a>
        ) : (
          <div key={branch.slug} className={cardClass}>
            <OfficeBody branch={branch} />
          </div>
        )
      )}
    </div>
  )
}
```

(Test dùng `getByRole("link", { name: /VP1 — Tân Ngãi/ })`: tên truy cập của link lấy từ `aria-label`, vẫn khớp.)

- [ ] **Step 6: Trang chủ** — `app/page.tsx`:
  - `export default async function Page()`; đầu hàm: `const [contact, branches] = await Promise.all([getSiteContact(), getBranches()])` (import từ `@/lib/api/public`). Thêm `export const revalidate = 300` ở cấp module.
  - Khối "Hệ thống văn phòng": thay `<div className="flex flex-col gap-4">{offices.slice(0, 4).map(...)}</div>` bằng `<OfficeList branches={branches} />`. Giữ iframe + thẻ Vũng Liêm bên trái như cũ.
  - Khối `#lien-he`: `href="tel:0779666664"` → `href={contact.telHref}`, chữ `0779 666 664` → `{contact.hotline}`, `href="https://zalo.me/0779666664"` → `href={contact.zaloHref}`.
  - Bỏ `import { offices } from "@/lib/contact"`.

- [ ] **Step 7: Footer** — `components/site-footer.tsx` thành async:

```tsx
export async function SiteFooter() {
  const [contact, branches] = await Promise.all([getSiteContact(), getBranches()])
  const list = branches ?? []
  const half = Math.ceil(list.length / 2)
  const officeColumns = [list.slice(0, half), list.slice(half)].filter((column) => column.length > 0)
  // ... giữ nguyên markup hiện tại, chỉ đổi:
  //  - map cột: column.map((branch) => <p key={branch.slug}><strong ...>{branch.officeName}:</strong>{" "}{branch.address}</p>)
  //  - list rỗng: thay khối cột bằng <p>Gọi hotline để được hướng dẫn đường đến văn phòng gần nhất.</p>
  //  - tel: href={contact.telHref}, chữ `{contact.hotline} (Zalo)`
  //  - dòng bản quyền: "© 2026 Trung tâm đào tạo lái xe Gia Thịnh." (bỏ "Thông tin trên trang là dữ liệu mẫu.")
}
```

Viết lại đầy đủ file theo mô tả trên (giữ nguyên class/markup hiện có), import `getBranches`, `getSiteContact` từ `@/lib/api/public`, bỏ import `offices`.

- [ ] **Step 8: `/tu-van`** — `app/tu-van/page.tsx` thành async (form vẫn cũ ở task này): lấy `contact` và `branches`; `supportDetails` tạo trong hàm: Hotline & Zalo → `contact.hotline`; Cơ sở → `branches?.length ? `${branches.length} điểm tư vấn tại Vĩnh Long` : "Các điểm tư vấn tại Vĩnh Long"`; link "Hoặc nhắn Zalo ngay" → `contact.zaloHref`. Thêm `export const revalidate = 300`.

- [ ] **Step 9: Sidebar bài viết** — `app/dien-dan/[slug]/page.tsx`: lấy `const contact = await getSiteContact()` trong component, nút gọi dùng `contact.telHref` / `contact.hotline` (phần còn lại của trang làm ở Task 6).

- [ ] **Step 10: Verify** — `npx vitest run components/site-chrome.test.tsx` → PASS; `grep -rn "0779" app components --include=*.tsx | grep -v consultation-form` → không còn (form làm ở Task 5); `npm test && npm run typecheck && npm run lint && npm run build` → PASS. Build không có backend phải vẫn thành công (khối dự phòng).

- [ ] **Step 11: Commit**

```bash
git add front-end/components front-end/app
git commit -m "feat(fe): hotline, Zalo và văn phòng lấy từ API ở header, footer, trang chủ, tư vấn

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Bảng giá theo chi nhánh, lịch khai giảng, lịch thi (trang chủ)

**Files:**
- Create: `front-end/components/pricing-section.tsx`, `front-end/components/class-schedule.tsx`, `front-end/components/exam-schedule.tsx`
- Modify: `front-end/app/page.tsx`
- Test: `front-end/components/pricing-section.test.tsx`, `front-end/components/schedules.test.tsx`

**Interfaces:**
- Consumes: `getPricing`, `getUpcomingClasses`, `getUpcomingExams`, `getSiteContact` (Task 2); `formatVnd`, `formatPricingItem`, `VEHICLE_LABELS`, `classTitle`, `classStatus`, `seatsLabel`, `formatDate`, `EXAM_TYPE_LABELS`, `consultHref` (Task 2).
- Produces: `PricingSection({ pricing, hotline }: { pricing: BranchPricing[] | null; hotline: { display: string; telHref: string } })` (client); `ClassSchedule({ classes }: { classes: UpcomingClass[] | null })`; `ExamSchedule({ exams }: { exams: UpcomingExam[] | null })`.

- [ ] **Step 1: Write the failing tests**

`front-end/components/pricing-section.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { PricingSection } from "@/components/pricing-section"
import type { BranchPricing, PricingCourse } from "@/lib/public/types"

const course = (over: Partial<PricingCourse>): PricingCourse => ({
  code: "A1",
  name: "Hạng A1",
  vehicleType: "moto",
  description: "Xe đến 125cc",
  duration: "2 ngày lý thuyết",
  image: null,
  price: 620000,
  priceNote: "Đã gồm lệ phí",
  fees: [{ key: "cb", label: "Xe cảm biến", amount: 20000, amountMax: null, unit: "vòng", note: null }],
  discounts: [{ key: "hssv", label: "HSSV giảm", amount: 500000, amountMax: null, unit: null, note: null }],
  ...over,
})

const pricing: BranchPricing[] = [
  {
    branch: { name: "Tân Ngãi", slug: "tan-ngai", officeName: "VP1 — Tân Ngãi", address: "" },
    courses: [course({}), course({ code: "B", name: "Hạng B", vehicleType: "car", price: 16500000 })],
  },
  {
    branch: { name: "Vũng Liêm", slug: "vung-liem", officeName: "VP Vũng Liêm", address: "" },
    courses: [course({ price: 790000 })],
  },
  { branch: { name: "Mới", slug: "moi", officeName: "VP Mới", address: "" }, courses: [] },
]

const hotline = { display: "0779 666 664", telHref: "tel:0779666664" }

describe("PricingSection", () => {
  it("mặc định chi nhánh đầu, đổi tab đổi giá và link tư vấn", async () => {
    render(<PricingSection pricing={pricing} hotline={hotline} />)
    expect(screen.getByText("620.000đ")).toBeInTheDocument()
    expect(screen.getByText("16.500.000đ")).toBeInTheDocument()
    expect(screen.getByText("Xe cảm biến: 20.000đ/vòng")).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: /Tư vấn gói này/ })[0]).toHaveAttribute(
      "href",
      "/tu-van?branch=tan-ngai&course=A1"
    )
    await userEvent.click(screen.getByRole("tab", { name: "VP Vũng Liêm" }))
    expect(screen.getByText("790.000đ")).toBeInTheDocument()
    expect(screen.queryByText("16.500.000đ")).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Tư vấn gói này/ })).toHaveAttribute(
      "href",
      "/tu-van?branch=vung-liem&course=A1"
    )
  })

  it("chi nhánh không có gói → thông báo, không vỡ", async () => {
    render(<PricingSection pricing={pricing} hotline={hotline} />)
    await userEvent.click(screen.getByRole("tab", { name: "VP Mới" }))
    expect(screen.getByText(/chưa công bố học phí/)).toBeInTheDocument()
  })

  it("không có dữ liệu → khối dự phòng có hotline", () => {
    render(<PricingSection pricing={null} hotline={hotline} />)
    expect(screen.getByRole("link", { name: /0779 666 664/ })).toHaveAttribute("href", "tel:0779666664")
  })
})
```

`front-end/components/schedules.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ClassSchedule } from "@/components/class-schedule"
import { ExamSchedule } from "@/components/exam-schedule"
import type { UpcomingClass, UpcomingExam } from "@/lib/public/types"

const cls = (i: number, over: Partial<UpcomingClass> = {}): UpcomingClass => ({
  code: `L${i}`,
  course: { code: "B", name: "Hạng B" },
  transmission: "manual",
  branch: { name: "Tân Ngãi", slug: "tan-ngai" },
  startDate: "2026-10-21T00:00:00+07:00",
  endDate: null,
  scheduleText: "Tối T2–T6",
  seatsLeft: 12,
  status: "enrolling",
  ...over,
})

describe("ClassSchedule", () => {
  it("hiện tối đa 8 lớp với trạng thái và link giữ chỗ", () => {
    const classes = Array.from({ length: 10 }, (_, i) => cls(i, i === 0 ? { seatsLeft: 3 } : {}))
    render(<ClassSchedule classes={classes} />)
    expect(screen.getAllByRole("link", { name: /Giữ chỗ lớp này/ })).toHaveLength(8)
    expect(screen.getAllByText("Hạng B (số sàn)")).toHaveLength(8)
    expect(screen.getByText("Sắp đủ lớp")).toBeInTheDocument()
    expect(screen.getByText("Còn 3 chỗ")).toBeInTheDocument()
    expect(screen.getAllByText("21/10/2026").length).toBeGreaterThan(0)
    expect(screen.getAllByRole("link", { name: /Giữ chỗ lớp này/ })[0]).toHaveAttribute(
      "href",
      "/tu-van?branch=tan-ngai&course=B"
    )
  })

  it("rỗng hoặc lỗi → thông báo", () => {
    render(<ClassSchedule classes={[]} />)
    expect(screen.getByText(/Chưa có lớp sắp khai giảng/)).toBeInTheDocument()
  })
})

describe("ExamSchedule", () => {
  it("hiện loại thi, gói, chi nhánh, ngày, địa điểm", () => {
    const exams: UpcomingExam[] = [
      { type: "official", course: { code: "A1", name: "Hạng A1" }, branch: { name: "Vũng Liêm", slug: "vung-liem" }, date: "2026-11-02T07:30:00+07:00", location: "Sân thi Vũng Liêm" },
    ]
    render(<ExamSchedule exams={exams} />)
    expect(screen.getByText("Thi sát hạch")).toBeInTheDocument()
    expect(screen.getByText("Hạng A1")).toBeInTheDocument()
    expect(screen.getByText("02/11/2026")).toBeInTheDocument()
    expect(screen.getByText(/Sân thi Vũng Liêm/)).toBeInTheDocument()
  })

  it("rỗng → thông báo", () => {
    render(<ExamSchedule exams={null} />)
    expect(screen.getByText(/Chưa có lịch thi mới/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify fail** — `npx vitest run components/pricing-section.test.tsx components/schedules.test.tsx` → FAIL.

- [ ] **Step 3: PricingSection** — `components/pricing-section.tsx` (client). Yêu cầu:
  - `"use client"`; state `activeSlug` mặc định `pricing?.[0]?.branch.slug`.
  - Thanh tab: `<div role="tablist" aria-label="Chọn chi nhánh">` với mỗi chi nhánh một `<button role="tab" aria-selected={...} type="button">{branch.officeName || branch.name}</button>`; style giống pill: chọn → `bg-primary text-primary-foreground`, còn lại `bg-background text-navy border border-primary/15`; cuộn ngang trên mobile (`overflow-x-auto`).
  - Lưới thẻ `grid gap-6 lg:grid-cols-2` (`role="tabpanel"`), hiển thị `courses` đúng thứ tự API trả (API đã sắp theo thứ tự hiển thị, `PricingCourse` không có `order` — không tự sắp lại). Mỗi gói một `<article>` theo markup thẻ khoá học hiện tại trong `app/page.tsx` (đoạn `courses.map` ở `#khoa-hoc`), với ánh xạ:
    - `isDark = course.vehicleType !== "moto"`.
    - Badge loại xe `VEHICLE_LABELS[course.vehicleType]`, badge chi nhánh `activeBranch.branch.name`.
    - Tiêu đề `course.name`; mô tả `course.description` (nếu có); ảnh `course.image` → `<Image src={image.url} alt={image.alt || course.name} width={352} height={352} unoptimized …>` (không có thì bỏ ảnh).
    - Hộp giá: một dòng nhãn "Học phí" + `formatVnd(course.price)`; `priceNote` và `duration` (nếu có, `duration` dạng "Thời lượng: …") dưới đường kẻ.
    - "Chi phí phát sinh": `course.fees.map(formatPricingItem)`; "Ưu đãi": `course.discounts.map(formatPricingItem)`; danh sách rỗng thì ẩn cả cột.
    - Nút `<Link href={consultHref(activeBranch.branch.slug, course.code)}>` nội dung "Tư vấn gói này" (giữ class nút hiện tại).
  - Chi nhánh có `courses.length === 0` → `<p>` "Chi nhánh này chưa công bố học phí trực tuyến, vui lòng gọi hotline để được báo giá."
  - `pricing` null/rỗng → khối viền `rounded-md border border-primary/15 bg-background p-7` với câu "Học phí đang được cập nhật. Gọi" + `<a href={hotline.telHref}>{hotline.display}</a>` + "để được báo giá mới nhất."
  - Không dùng `ScrollReveal` bên trong (component client riêng); trang chủ có thể bọc ngoài.

- [ ] **Step 4: ClassSchedule** — `components/class-schedule.tsx` (Server Component, không `"use client"`): lấy markup bảng hiện tại ở `#lich-khai-giang` (phần `schedules.map`) với 4 cột: "Lớp" (`classTitle(item)` đậm + dòng phụ `item.branch.name` · `item.scheduleText`), "Khai giảng" (`formatDate(item.startDate)`), "Tình trạng" (Badge `classStatus(item).label`, `variant={urgent ? "destructive" : "secondary"}`, dòng phụ `seatsLabel(item.seatsLeft)`), link `<Link href={consultHref(item.branch.slug, item.course.code)}>Giữ chỗ lớp này</Link>`. Hiện `classes.slice(0, 8)`. Rỗng/null → khối có câu "Chưa có lớp sắp khai giảng, để lại thông tin để được báo lịch sớm." + link `/tu-van`. Key: `item.code`.

- [ ] **Step 5: ExamSchedule** — `components/exam-schedule.tsx` (Server Component): danh sách `exams.slice(0, 8)`, mỗi dòng: Badge `EXAM_TYPE_LABELS[exam.type]`, `exam.course.name` (đậm), `exam.branch.name`, `formatDate(exam.date)`, `exam.location` nếu có (dạng "Địa điểm: …"). Cùng phong cách bảng với `ClassSchedule` (`rounded-md border border-border`, `Separator` giữa dòng). Rỗng/null → "Chưa có lịch thi mới. Lịch thi sẽ được báo qua nhóm Zalo của lớp." Key: `${exam.type}-${exam.course.code}-${exam.branch.slug}-${exam.date}`.

- [ ] **Step 6: Trang chủ** — `app/page.tsx`:
  - Mở rộng `Promise.all` ở đầu `Page`: `const [contact, branches, pricing, classes, exams] = await Promise.all([getSiteContact(), getBranches(), getPricing(), getUpcomingClasses(), getUpcomingExams()])`.
  - Xoá hằng `courses`, `registerNotes`, `schedules` và các import chỉ chúng dùng (`Bike`, `CarFront`, … nếu không còn dùng). Giữ `motoExtras` và khối "Lưu ý chung cho hạng A & A1".
  - Trong `#khoa-hoc`: thay `ScrollReveal` chứa `courses.map(...)` bằng `<ScrollReveal className="mt-12" delay={0.08} amount="some"><PricingSection pricing={pricing} hotline={{ display: contact.hotline, telHref: contact.telHref }} /></ScrollReveal>`.
  - Khối "Trước khi đăng ký": `registerNotes` → `contact.registerNotes`.
  - `#lich-khai-giang`: thay `ScrollReveal` chứa bảng `schedules.map` bằng `<ScrollReveal delay={0.08}><ClassSchedule classes={classes} /></ScrollReveal>` (giữ cột tiêu đề bên trái).
  - Ngay sau section `#lich-khai-giang` thêm section mới:

```tsx
      <section id="lich-thi" className="bg-mist py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
            <ScrollReveal>
              <p className="mb-4 font-hand text-3xl font-bold text-primary sm:text-4xl">Lịch thi</p>
              <h2 className="text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">Các ca thi sắp tới</h2>
              <p className="mt-5 leading-7 text-muted-foreground">
                Học viên nhận lịch chính thức qua nhóm Zalo của lớp. Bảng dưới để theo dõi nhanh.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={0.08}>
              <ExamSchedule exams={exams} />
            </ScrollReveal>
          </div>
        </div>
      </section>
```

- [ ] **Step 7: Verify** — `npx vitest run components/pricing-section.test.tsx components/schedules.test.tsx` → PASS; `npm test && npm run typecheck && npm run lint && npm run build` → PASS.

- [ ] **Step 8: Commit**

```bash
git add front-end/components front-end/app/page.tsx
git commit -m "feat(fe): bảng giá theo chi nhánh, lịch khai giảng và lịch thi từ API

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Form tư vấn gửi lead thật

**Files:**
- Modify (viết lại logic): `front-end/components/consultation-form.tsx`
- Modify: `front-end/app/tu-van/page.tsx`
- Delete: `front-end/lib/contact.ts` (và sửa comment nhắc tới nó trong `lib/admin-data.ts` nếu có)
- Test: `front-end/components/consultation-form.test.tsx`

**Interfaces:**
- Consumes: `apiFetch` (`@/lib/api/client`, đợt A), `ApiError`, `errorMessage`, `fieldErrors` (đợt A); `buildLeadBody`, `NO_COURSE`, `CourseOption` (Task 2); `getBranches`, `getPricing`, `getSiteContact` (Task 2); `courseOptions` (Task 2).
- Produces: `ConsultationForm(props: { branches: { slug: string; label: string }[]; courses: CourseOption[]; contactTimes: { label: string; value: string }[]; contact: { hotline: string; telHref: string; zaloHref: string }; initialBranch?: string; initialCourse?: string })`.

- [ ] **Step 1: Write the failing test** — `front-end/components/consultation-form.test.tsx`

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import { ConsultationForm } from "@/components/consultation-form"
import { setAccessToken } from "@/lib/api/session"
import { jsonResponse, mockFetch } from "@/test/fetch-mock"

const props = {
  branches: [
    { slug: "tan-ngai", label: "VP1 — Tân Ngãi" },
    { slug: "vung-liem", label: "VP Vũng Liêm" },
  ],
  courses: [
    { code: "A1", name: "Hạng A1" },
    { code: "B", name: "Hạng B" },
  ],
  contactTimes: [{ label: "Buổi sáng", value: "Buổi sáng (07:00–11:30)" }],
  contact: { hotline: "0779 666 664", telHref: "tel:0779666664", zaloHref: "https://zalo.me/0779666664" },
}

async function fillRequired() {
  await userEvent.type(screen.getByLabelText("Họ và tên"), "Nguyễn Văn An")
  await userEvent.type(screen.getByLabelText("Số điện thoại"), "0909123456")
  await userEvent.click(screen.getByLabelText(/Tôi đồng ý/))
}

beforeEach(() => {
  setAccessToken(null)
  window.history.replaceState(null, "", "/tu-van?utm_source=facebook")
})

describe("ConsultationForm", () => {
  it("gửi lead với chi nhánh/gói điền sẵn, consent, honeypot rỗng và utm", async () => {
    const { calls } = mockFetch({ "POST /public/leads": () => jsonResponse(201, { data: { received: true } }) })
    render(<ConsultationForm {...props} initialBranch="vung-liem" initialCourse="B" />)
    await fillRequired()
    await userEvent.click(screen.getByRole("button", { name: /Gửi thông tin tư vấn/ }))
    expect(await screen.findByText(/Đã nhận thông tin/)).toBeInTheDocument()
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      name: "Nguyễn Văn An",
      phone: "0909123456",
      branch: "vung-liem",
      courseCode: "B",
      preferredContactTime: "Buổi sáng (07:00–11:30)",
      consent: true,
      website: "",
      utm: { source: "facebook" },
    })
  })

  it("không có gói điền sẵn → mặc định 'Chưa xác định', không gửi courseCode", async () => {
    const { calls } = mockFetch({ "POST /public/leads": () => jsonResponse(201, { data: { received: true } }) })
    render(<ConsultationForm {...props} initialCourse="KHONG-CO" />)
    await fillRequired()
    await userEvent.click(screen.getByRole("button", { name: /Gửi thông tin tư vấn/ }))
    await screen.findByText(/Đã nhận thông tin/)
    const body = JSON.parse(String(calls[0].init.body))
    expect(body.courseCode).toBeUndefined()
    expect(body.branch).toBe("tan-ngai")
  })

  it("ô honeypot bị ẩn khỏi người dùng", () => {
    render(<ConsultationForm {...props} />)
    const honeypot = document.querySelector('input[name="website"]') as HTMLInputElement
    expect(honeypot).not.toBeNull()
    expect(honeypot.tabIndex).toBe(-1)
    expect(honeypot.closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it("lỗi trường từ backend hiện dưới ô", async () => {
    mockFetch({
      "POST /public/leads": () =>
        jsonResponse(400, {
          error: {
            code: "VALIDATION_ERROR",
            message: "Dữ liệu không hợp lệ",
            details: [{ path: "body.phone", message: "Số điện thoại phải có 10 chữ số, bắt đầu bằng 0" }],
          },
        }),
    })
    render(<ConsultationForm {...props} />)
    await fillRequired()
    await userEvent.click(screen.getByRole("button", { name: /Gửi thông tin tư vấn/ }))
    expect(await screen.findByText("Số điện thoại phải có 10 chữ số, bắt đầu bằng 0")).toBeInTheDocument()
  })

  it("429 → báo gửi quá nhiều kèm hotline", async () => {
    mockFetch({
      "POST /public/leads": () =>
        jsonResponse(429, { error: { code: "RATE_LIMITED", message: "Bạn đã gửi quá nhiều yêu cầu" } }),
    })
    render(<ConsultationForm {...props} />)
    await fillRequired()
    await userEvent.click(screen.getByRole("button", { name: /Gửi thông tin tư vấn/ }))
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("quá nhiều")
    expect(alert).toHaveTextContent("0779 666 664")
  })

  it("bấm gửi hai lần nhanh chỉ gửi một request", async () => {
    let resolve: (r: Response) => void = () => undefined
    const { calls } = mockFetch({
      "POST /public/leads": () => new Promise<Response>((r) => (resolve = r)),
    })
    render(<ConsultationForm {...props} />)
    await fillRequired()
    const button = screen.getByRole("button", { name: /Gửi thông tin tư vấn/ })
    await userEvent.click(button)
    await userEvent.click(button)
    resolve(jsonResponse(201, { data: { received: true } }))
    await screen.findByText(/Đã nhận thông tin/)
    expect(calls).toHaveLength(1)
  })

  it("không có chi nhánh → báo gọi hotline thay vì form", () => {
    render(<ConsultationForm {...props} branches={[]} />)
    expect(screen.getByText(/gọi hotline/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Gửi thông tin tư vấn/ })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify fail** — `npx vitest run components/consultation-form.test.tsx` → FAIL.

- [ ] **Step 3: Implement** — viết lại `components/consultation-form.tsx`, giữ bộ khung UI hiện có (Field, Input, Select, Textarea, Checkbox, Button, tiêu đề "Thông tin cần tư vấn", class), thay logic:
  - Props theo Interfaces. State: `branch` (= `initialBranch` nếu có trong `branches`, không thì `branches[0]?.slug ?? ""`), `courseCode` (= `initialCourse` nếu có trong `courses`, không thì `NO_COURSE`), `contactTime` (= `contactTimes[0]?.value ?? ""`), `consent`, `submitting`, `submitted`, `errors: Record<string,string>`, `formError: string | null`.
  - Select gói học: `courses.map(c => ({ label: c.name, value: c.code }))` + `{ label: "Chưa xác định, cần tư vấn", value: NO_COURSE }` ở cuối.
  - Select cơ sở: `branches.map(b => ({ label: b.label, value: b.slug }))`.
  - Ô honeypot ngay trong `<form>`:

```tsx
      {/* Bẫy spam: người thật không thấy ô này */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="consultation-website">Website</label>
        <input id="consultation-website" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
```

  (đặt `className="relative"` cho `<form>` nếu cần.)
  - `handleSubmit`: `event.preventDefault()`; nếu `submitting` → return (chặn gửi đôi; đặt cờ bằng `useRef` để chặn cả hai click trong cùng một tick); đọc `FormData` (`name`, `phone`, `note`, `website`); `const body = buildLeadBody({ name, phone, branch, courseCode, preferredContactTime: contactTime, note, website }, window.location.search)`; `await apiFetch("/public/leads", { method: "POST", body })`; thành công → `setSubmitted(true)`; lỗi:
    - `ApiError` 400 có `details` → `setErrors(fieldErrors(error.details))` (khoá `name`, `phone`, `note`, `branch`, `courseCode`), không có details → `formError = error.message`;
    - 429 → `formError = \`${error.message}. Vui lòng gọi hotline ${contact.hotline} để được hỗ trợ ngay.\`` (backend message đã chứa "quá nhiều");
    - khác → `formError = \`${errorMessage(error)} Hoặc gọi hotline ${contact.hotline}.\``.
    - `formError` hiển thị `<p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">`.
  - Lỗi trường hiển thị dưới ô bằng `FieldError` (`components/ui/field.tsx`) hoặc `<p className="text-sm text-destructive">`, và `aria-invalid` trên ô.
  - Nút gửi: `disabled={!consent || submitting}`, nội dung "Gửi thông tin tư vấn" (đang gửi: thêm `LoaderCircle animate-spin`).
  - Màn thành công (`submitted`): giữ khung hiện tại (icon `CheckCircle2`) với tiêu đề "Đã nhận thông tin", mô tả "Tư vấn viên Gia Thịnh sẽ gọi lại cho bạn trong giờ làm việc. Cần gấp, hãy gọi hotline.", nút `<a href={contact.telHref}>Gọi {contact.hotline}</a>`, `<a href={contact.zaloHref} target="_blank" rel="noopener noreferrer">Nhắn Zalo</a>`, nút "Gửi yêu cầu khác" (reset `submitted`, `errors`, `formError`, `consent`).
  - `branches.length === 0` → không render form; render khối: "Hiện chưa gửi được yêu cầu trực tuyến. Vui lòng gọi hotline" + `<a href={contact.telHref}>{contact.hotline}</a>` + "hoặc nhắn Zalo."
  - Bỏ hẳn `navigator.share`, clipboard, `offices`, `licenseOptions`, `contactTimeOptions` cứng.

- [ ] **Step 4: Trang `/tu-van`** — `app/tu-van/page.tsx`:

```tsx
export default async function ConsultationPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string | string[]; course?: string | string[] }>
}) {
  const [params, contact, branches, pricing] = await Promise.all([
    searchParams,
    getSiteContact(),
    getBranches(),
    getPricing(),
  ])
  const pick = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
  // ... supportDetails như Task 3 ...
  // <ConsultationForm
  //   branches={(branches ?? []).map((b) => ({ slug: b.slug, label: b.officeName || b.name }))}
  //   courses={courseOptions(pricing)}
  //   contactTimes={contact.contactTimes}
  //   contact={{ hotline: contact.hotline, telHref: contact.telHref, zaloHref: contact.zaloHref }}
  //   initialBranch={pick(params.branch)}
  //   initialCourse={pick(params.course)?.toUpperCase()}
  // />
}
```

  Đọc `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` mục `searchParams` để dùng đúng kiểu Next 16. Dùng `searchParams` làm trang render động — chấp nhận; bỏ `export const revalidate` nếu Next báo xung đột (fetch vẫn cache 300 giây).

- [ ] **Step 5: Xoá `lib/contact.ts`** — `grep -rn "lib/contact" app components lib` phải rỗng (sửa comment trong `lib/admin-data.ts` nếu nhắc tới), rồi `git rm front-end/lib/contact.ts`.

- [ ] **Step 6: Verify** — `npx vitest run components/consultation-form.test.tsx` → PASS; `grep -rn "0779" app components --include=*.tsx` → không còn; `npm test && npm run typecheck && npm run lint && npm run build` → PASS.

- [ ] **Step 7: Commit**

```bash
git add -A front-end/components/consultation-form.tsx front-end/components/consultation-form.test.tsx front-end/app/tu-van front-end/lib
git commit -m "feat(fe): form tư vấn gửi lead thật vào CRM

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Tin tức — danh sách, chi tiết với nội dung Plate, lượt xem

**Files:**
- Modify: `front-end/lib/news.ts`, `front-end/components/news-explorer.tsx`, `front-end/components/news-card.tsx`
- Modify: `front-end/app/dien-dan/page.tsx`, `front-end/app/dien-dan/[slug]/page.tsx`, `front-end/app/page.tsx` (khối tin tức)
- Create: `front-end/components/ui/image-node-static.tsx`, `front-end/components/post-content.tsx`, `front-end/components/post-view-tracker.tsx`
- Test: `front-end/lib/news.test.ts`, `front-end/components/news.test.tsx`

**Interfaces:**
- Consumes: `getAllPosts`, `getCategories`, `getLatestPosts`, `getPost`, `getRelatedPosts`, `getSiteContact` (Task 2); `formatDate`, `readTimeLabel` (Task 2); `PostSummary`, `PublicCategory` (Task 2); `apiFetch` (đợt A).
- Produces:
  - `@/lib/news`: `type NewsCategory = PublicCategory`, `type NewsPost = { slug: string; title: string; excerpt: string; category: string | null; categorySlug: string | null; isAnnouncement: boolean; date: string; publishedAt: string; readTime: string; image: string | null; imageAlt: string }`, `toNewsPost(post: PostSummary): NewsPost`, giữ `normalizeForSearch`, `newsMatchesQuery`, `TextSegment`, `splitByQuery`, `NewsSortKey`, `sortNewsPosts`, `countPostsByCategory(posts): Record<string, number>`.
  - `NewsExplorer({ posts, categories }: { posts: NewsPost[]; categories: NewsCategory[] })`, `NewsCard({ post, query? })` (ảnh null → placeholder).
  - `PostContent({ value }: { value: unknown[] })`, `PostViewTracker({ slug }: { slug: string })`.

- [ ] **Step 1: Write the failing tests**

`front-end/lib/news.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { countPostsByCategory, newsMatchesQuery, sortNewsPosts, toNewsPost } from "@/lib/news"
import type { PostSummary } from "@/lib/public/types"

const summary = (over: Partial<PostSummary>): PostSummary => ({
  slug: "meo-thi",
  title: "Mẹo thi sa hình",
  excerpt: "Vòng số 8",
  cover: { url: "https://cdn/a.webp", alt: "" },
  tags: [],
  authorName: "Gia Thịnh",
  publishedAt: "2026-10-01T08:00:00+07:00",
  readTimeMinutes: 4,
  views: 0,
  category: { name: "Kinh nghiệm thi", slug: "kinh-nghiem-thi", isAnnouncement: false },
  ...over,
})

describe("toNewsPost", () => {
  it("chuyển dữ liệu API sang dạng hiển thị", () => {
    expect(toNewsPost(summary({}))).toEqual({
      slug: "meo-thi",
      title: "Mẹo thi sa hình",
      excerpt: "Vòng số 8",
      category: "Kinh nghiệm thi",
      categorySlug: "kinh-nghiem-thi",
      isAnnouncement: false,
      date: "01/10/2026",
      publishedAt: "2026-10-01T08:00:00+07:00",
      readTime: "4 phút đọc",
      image: "https://cdn/a.webp",
      imageAlt: "Mẹo thi sa hình",
    })
    expect(toNewsPost(summary({ cover: null, category: null }))).toMatchObject({
      image: null,
      category: null,
      categorySlug: null,
      isAnnouncement: false,
    })
  })
})

describe("tìm kiếm, sắp xếp, đếm", () => {
  const a = toNewsPost(summary({ slug: "a", title: "Ôn lý thuyết", publishedAt: "2026-09-01T08:00:00+07:00" }))
  const b = toNewsPost(summary({ slug: "b", title: "Bằng lái B", publishedAt: "2026-10-05T08:00:00+07:00", category: null }))

  it("tìm không dấu", () => {
    expect(newsMatchesQuery(a, "on ly thuyet")).toBe(true)
    expect(newsMatchesQuery(b, "kinh nghiem")).toBe(false)
  })

  it("sắp xếp theo publishedAt", () => {
    expect(sortNewsPosts([a, b], "newest").map((p) => p.slug)).toEqual(["b", "a"])
    expect(sortNewsPosts([b, a], "oldest").map((p) => p.slug)).toEqual(["a", "b"])
  })

  it("đếm theo chuyên mục, bỏ bài không có chuyên mục", () => {
    expect(countPostsByCategory([a, b])).toEqual({ "kinh-nghiem-thi": 1 })
  })
})
```

`front-end/components/news.test.tsx`:

```tsx
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
          { type: "p", children: [{ type: "a", url: "https://giathinh.vn", children: [{ text: "Trang chủ" }] }] },
          { type: "img", url: "https://cdn/x.webp", caption: [{ text: "Sân thi" }], children: [{ text: "" }] },
          { type: "khong-ton-tai", children: [{ text: "Vẫn hiện" }] },
        ]}
      />
    )
    expect(screen.getByRole("heading", { name: "Chuẩn bị giấy tờ" })).toBeInTheDocument()
    expect(screen.getByText("CCCD").closest("strong")).not.toBeNull()
    expect(screen.getByText("Ý một")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Trang chủ" })).toHaveAttribute("href", "https://giathinh.vn")
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
```

(Bộ lọc chuyên mục trong `NewsExplorer` hiện dùng `ToggleGroup`/`Select`; nếu nút lọc không có role `button` với tên chuyên mục, chỉnh truy vấn trong test cho đúng phần tử lọc đang có — giữ nguyên ý: chọn "Học phí" thì chỉ còn bài học phí.)

- [ ] **Step 2: Run to verify fail** — `npx vitest run lib/news.test.ts components/news.test.tsx` → FAIL.

- [ ] **Step 3: `lib/news.ts`** — xoá `newsCategories`, `NewsCategory`/`NewsCategorySlug`/`NewsCategoryName` cũ, `announcementCategorySlug`, `newsPosts`, `getPost`, `toTimestamp`. Thêm/đổi:

```ts
import { formatDate, readTimeLabel } from "@/lib/public/format"
import type { PostSummary, PublicCategory } from "@/lib/public/types"

export type NewsCategory = PublicCategory

export type NewsPost = {
  slug: string
  title: string
  excerpt: string
  category: string | null
  categorySlug: string | null
  isAnnouncement: boolean
  date: string
  publishedAt: string
  readTime: string
  image: string | null
  imageAlt: string
}

export function toNewsPost(post: PostSummary): NewsPost {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    category: post.category?.name ?? null,
    categorySlug: post.category?.slug ?? null,
    isAnnouncement: post.category?.isAnnouncement ?? false,
    date: formatDate(post.publishedAt),
    publishedAt: post.publishedAt,
    readTime: readTimeLabel(post.readTimeMinutes),
    image: post.cover?.url ?? null,
    imageAlt: post.cover?.alt || post.title,
  }
}
```

`newsMatchesQuery`: các trường tìm `[post.title, post.excerpt, post.category ?? ""]`. `sortNewsPosts`: so sánh `Date.parse(publishedAt)`. `countPostsByCategory(posts): Record<string, number>` bỏ bài `categorySlug === null`. Giữ nguyên `normalizeForSearch`, `splitByQuery`, `TextSegment`, `NewsSortKey`.

- [ ] **Step 4: NewsCard** — `components/news-card.tsx`: ảnh

```tsx
      <span className="relative block aspect-[16/10] overflow-hidden bg-mist">
        {post.image ? (
          <Image
            src={post.image}
            alt={post.imageAlt}
            fill
            unoptimized
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            loading="lazy"
            className="object-cover"
          />
        ) : (
          <Image src="/giathinh-logo.png" alt="" fill sizes="25vw" className="object-contain p-10 opacity-60" />
        )}
      </span>
```

Badge chuyên mục chỉ hiện khi `post.category` khác null.

- [ ] **Step 5: NewsExplorer** — `components/news-explorer.tsx`:
  - Props `{ posts, categories }`. Kiểu state chuyên mục đổi từ `NewsCategorySlug | "all"` sang `string` (giữ giá trị "tất cả" hiện dùng).
  - Mọi chỗ dùng `newsCategories` → `categories.filter((c) => !c.isAnnouncement)` (biến `filterCategories`); `activeCategory = categories.find((c) => c.slug === category)`; mô tả chuyên mục dùng `activeCategory?.description` (null → không hiện).
  - Tách thông báo: `filtered.filter((p) => p.isAnnouncement)` / `filtered.filter((p) => !p.isAnnouncement)`.
  - `counts` kiểu `Record<string, number>`.
  - Ảnh trong `AnnouncementList` (nếu có) xử lý `image` null như `NewsCard`.
  - Không còn import từ `@/lib/news` các tên đã xoá.

- [ ] **Step 6: Ảnh static** — `components/ui/image-node-static.tsx`

```tsx
import type { SlateElementProps, TCaptionProps, TImageElement } from "platejs"
import { NodeApi, SlateElement } from "platejs/static"

export function ImageElementStatic(props: SlateElementProps<TImageElement & TCaptionProps>) {
  const { caption, url, width } = props.element
  const captionText = caption?.length ? caption.map((node) => NodeApi.string(node)).join("") : ""
  return (
    <SlateElement {...props} className="py-2.5">
      <figure className="mx-auto my-0 max-w-full" style={{ width: width ?? undefined }}>
        {/* Ảnh trong bài từ API (đã nén webp): thẻ img thường vì kích thước ảnh không biết trước */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={captionText} loading="lazy" className="w-full max-w-full rounded-md object-cover" />
        {captionText ? (
          <figcaption className="mt-2 text-center text-sm text-muted-foreground">{captionText}</figcaption>
        ) : null}
      </figure>
      {props.children}
    </SlateElement>
  )
}
```

Đối chiếu kiểu `TImageElement`/`TCaptionProps` trong `node_modules/platejs` và `@platejs/media`; nếu tên kiểu khác ở bản 53, dùng đúng tên và ghi lại.

- [ ] **Step 7: PostContent** — `components/post-content.tsx` (Server Component)

```tsx
import { BaseTextAlignPlugin } from "@platejs/basic-styles"
import { BaseCaptionPlugin } from "@platejs/caption"
import { BaseLinkPlugin } from "@platejs/link"
import { BaseListPlugin } from "@platejs/list"
import { BaseImagePlugin } from "@platejs/media"
import { KEYS, type Value } from "platejs"
import { createStaticEditor, PlateStatic } from "platejs/static"

import { BaseBasicBlocksKit } from "@/components/editor/plugins/basic-blocks-base-kit"
import { BaseBasicMarksKit } from "@/components/editor/plugins/basic-marks-base-kit"
import { BlockListStatic } from "@/components/ui/block-list-static"
import { ImageElementStatic } from "@/components/ui/image-node-static"
import { LinkElementStatic } from "@/components/ui/link-node-static"

// Plugin render tĩnh cho nội dung bài viết soạn ở admin (Plate JSON từ API)
const plugins = [
  ...BaseBasicBlocksKit,
  ...BaseBasicMarksKit,
  BaseTextAlignPlugin.configure({
    inject: { nodeProps: { defaultNodeValue: "start", nodeKey: "align" }, targetPlugins: [...KEYS.heading, KEYS.p, KEYS.img] },
  }),
  BaseListPlugin.configure({
    inject: { targetPlugins: [...KEYS.heading, KEYS.p, KEYS.blockquote] },
    render: { belowNodes: BlockListStatic },
  }),
  BaseLinkPlugin.withComponent(LinkElementStatic),
  BaseImagePlugin.withComponent(ImageElementStatic),
  BaseCaptionPlugin.configure({ options: { query: { allow: [KEYS.img] } } }),
]

export function PostContent({ value }: { value: unknown[] }) {
  const editor = createStaticEditor({ plugins, value: value as Value })
  return <PlateStatic editor={editor} className="flex flex-col gap-5 leading-7 text-foreground/85 sm:leading-8" />
}
```

Bắt buộc kiểm tra theo node_modules thực tế (Plate 53): tên export (`BaseListPlugin`, `BaseTextAlignPlugin`, `BaseImagePlugin`, `BaseCaptionPlugin`, `BaseLinkPlugin`, `createStaticEditor`, `PlateStatic`, `KEYS.*`), cách cấu hình `inject` và `render.belowNodes` (xem cách các kit `*-base-kit` trong registry shadcn/plate làm: `grep -rn "belowNodes" node_modules/@platejs/list` và tài liệu trong `node_modules/@platejs/*/README.md`). Nếu cách cấu hình khác, sửa theo API thật nhưng giữ đủ các loại node trong test. Node lạ: Plate render mặc định thành `div` chứa con — test "Vẫn hiện" xác nhận.

- [ ] **Step 8: PostViewTracker** — `components/post-view-tracker.tsx`

```tsx
"use client"

import { useEffect } from "react"

import { apiFetch } from "@/lib/api/client"

// Đếm lượt xem một lần mỗi phiên trình duyệt; lỗi không ảnh hưởng trang
export function PostViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `gt-viewed:${slug}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, "1")
    } catch {
      // sessionStorage bị chặn: vẫn đếm
    }
    apiFetch(`/public/posts/${encodeURIComponent(slug)}/view`, { method: "POST" }).catch(() => undefined)
  }, [slug])
  return null
}
```

- [ ] **Step 9: Trang `/dien-dan`** — `app/dien-dan/page.tsx`:

```tsx
export const revalidate = 300

export default async function NewsPage() {
  const [posts, categories] = await Promise.all([getAllPosts(), getCategories()])
  return (
    <main className="min-h-svh bg-background">
      <SiteHeader />
      <NewsExplorer posts={(posts ?? []).map(toNewsPost)} categories={categories ?? []} />
    </main>
  )
}
```

(Giữ `metadata`. `NewsExplorer` với danh sách rỗng phải hiện trạng thái trống hiện có; nếu chưa có, thêm câu "Chưa có bài viết.")

- [ ] **Step 10: Trang chi tiết** — `app/dien-dan/[slug]/page.tsx`:
  - Xoá `generateStaticParams`. `export const revalidate = 300`.
  - `generateMetadata`: `const post = await getPost(slug)`; null → `{}`; có → `{ title: \`${post.title} | Tin tức Gia Thịnh\`, description: post.excerpt, openGraph: post.cover ? { images: [post.cover.url] } : undefined }`.
  - Component: `const post = await getPost(slug); if (!post) notFound()`; `const view = toNewsPost(post)`; `const [related, contact] = await Promise.all([getRelatedPosts(view.categorySlug, slug), getSiteContact()])`; `relatedPosts = related.map(toNewsPost)`.
  - Header bài: Badge `view.category` (nếu có), `view.date`, `view.readTime`, thêm "Tác giả: `post.authorName`" (cỡ chữ `text-xs text-muted-foreground`).
  - Ảnh bìa: chỉ render khối ảnh khi `view.image` có, `<Image … unoptimized>`.
  - Nội dung: thay `post.content.map(<p>)` bằng `<PostContent value={post.content} />` trong `ScrollReveal`.
  - Bài liên quan: dùng `relatedPosts`; ảnh null → khung `bg-mist` có logo như `NewsCard`.
  - Cuối `<main>`: `<PostViewTracker slug={post.slug} />`.
  - Nút hotline ở sidebar giữ như Task 3.

- [ ] **Step 11: Trang chủ** — `app/page.tsx`: thêm `getLatestPosts(4)` vào `Promise.all`; khối `#tin-tuc` dùng `(latest ?? []).map(toNewsPost)`; rỗng → `<p className="mt-12 text-muted-foreground">Chưa có bài viết mới.</p>`. Bỏ `import { newsPosts }`.

- [ ] **Step 12: Verify** — `grep -rn "newsPosts\|newsCategories\|announcementCategorySlug\|getPost(" app components lib | grep -v "lib/api/public"` → chỉ còn các chỗ gọi `getPost` từ `lib/api/public`; `npx vitest run lib/news.test.ts components/news.test.tsx` → PASS; `npm test && npm run typecheck && npm run lint && npm run build` → PASS.

- [ ] **Step 13: Commit**

```bash
git add -A front-end/lib/news.ts front-end/lib/news.test.ts front-end/components front-end/app
git commit -m "feat(fe): tin tức lấy bài đã xuất bản, render nội dung Plate, đếm lượt xem

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Tài liệu và chạy thật

**Files:**
- Modify: `front-end/README.md`, `front-end/.env.example`, `back-end/README.md` (mục "Chạy cùng front-end"), `back-end/docs/superpowers/specs/2026-10-04-fe-dot-a-nen-tang-dang-nhap-design.md` (bảng mục 3: production `API_ORIGIN`)

- [ ] **Step 1: Tài liệu `API_ORIGIN` bắt buộc**
  - `front-end/README.md` bảng "Địa chỉ API": hàng Production cột `API_ORIGIN` → `https://api.giathinh.vn`; thêm câu dưới bảng: "`API_ORIGIN` bắt buộc ở mọi môi trường: server Next.js dùng nó để lấy dữ liệu trang công khai (cache 5 phút). Thiếu hoặc backend không phản hồi thì trang vẫn hiện, các khối dữ liệu hiện thông báo dự phòng."
  - Thêm mục "## Website công khai" ngắn: dữ liệu lấy từ `/api/v1/public/*`, cập nhật trễ tối đa 5 phút; form tư vấn tạo khách trong CRM; diễn đàn `/thao-luan` lưu trên trình duyệt (không có backend).
  - `front-end/.env.example`: comment của `API_ORIGIN` sửa thành "Bắt buộc: server Next lấy dữ liệu công khai và chuyển tiếp /api/v1/*, /uploads/* (dev, preview). Dev: http://localhost:4000 · Preview/Production: https://api.giathinh.vn".
  - `back-end/README.md` mục "Chạy cùng front-end": thêm dòng "Server Next.js gọi `/api/v1/public/*` từ `API_ORIGIN` (cache 5 phút); lượt xem tin đếm qua `POST /public/posts/:slug/view`."
  - Spec đợt A, bảng mục 3, cột Production của `API_ORIGIN`: "(không cần)" → "`https://api.giathinh.vn` (bắt buộc từ đợt B: server lấy dữ liệu công khai)".

- [ ] **Step 2: Chạy thật** — không dùng database Atlas của người dùng. Viết script tạm trong `/private/tmp` khởi động backend trên MongoDB trong RAM (import tuyệt đối `back-end/node_modules/mongodb-memory-server` và `mongoose`, đặt `MONGODB_URL`, `JWT_ACCESS_SECRET` (≥32 ký tự), `NODE_ENV=development`, `PORT` trống, `CORS_ORIGINS`, `STORAGE_DRIVER=local` trước khi import động `back-end/src/scripts/seed` (`runSeed` với admin `admin`/`0901234567`/`Matkhau123`) và `back-end/src/app`; `process.chdir` sang thư mục tạm để không nạp `back-end/.env`). Nếu cổng 3000/4000 đang có server của người dùng, dùng cổng khác (vd. 4100/3100) và **không tắt server của người dùng**; Next 16 không cho hai `next dev` trong cùng thư mục → chạy front-end từ bản sao tạm (clone APFS `node_modules`) hoặc `next build && next start -p 3100` với `API_ORIGIN=http://localhost:4100` trong env lệnh.
  Kiểm tra bằng script Node (fetch + đọc HTML), ghi kết quả từng mục vào báo cáo:
  1. `GET /` 200: HTML có giá của seed (vd. chuỗi `đ` của gói đầu), tên văn phòng từ seed, hotline seed `0779 666 664`, khối lịch thi.
  2. Đăng nhập admin qua API, tạo một lớp sắp khai giảng và một ca thi (theo `back-end/src/docs/openapi.ts` / Postman), tạo một bài viết có nội dung Plate (đoạn văn + tiêu đề + danh sách + liên kết) rồi xuất bản. Vì ISR 5 phút, kiểm tra trên bản `next dev` (không cache) hoặc khởi động lại `next start` sau khi tạo dữ liệu: trang chủ hiện lớp/ca thi; `/dien-dan` có bài; `/dien-dan/<slug>` có tiêu đề và đoạn văn từ Plate; `GET /api/v1/public/posts/<slug>` không làm tăng `views`; `POST .../view` tăng 1.
  3. Gửi lead qua proxy `POST http://localhost:3100/api/v1/public/leads` với body giống form (slug chi nhánh, courseCode, consent, website rỗng, utm) → 201; `GET /api/v1/leads` (token admin) thấy khách mới có `utm`.
  4. `/tu-van?branch=<slug thứ hai>&course=<code>` render HTML có chi nhánh/gói điền sẵn (kiểm tra giá trị đã chọn trong HTML nếu render phía server, hoặc ghi chú là chỉ kiểm bằng component test).
  5. Tắt backend, `next build` (bản sao tạm, `API_ORIGIN` trỏ cổng không có server) → build thành công; `next start` → `/`, `/tu-van`, `/dien-dan` trả 200 với khối dự phòng (có hotline mặc định).
  Dừng mọi server tạm, xoá thư mục tạm.

- [ ] **Step 3: Kiểm tra cuối**

Run (front-end): `npm test && npm run typecheck && npm run lint && npm run build`
Run (back-end): `npm test && npm run typecheck && npm run lint`
Expected: tất cả PASS.

- [ ] **Step 4: Commit**

```bash
git add front-end/README.md front-end/.env.example back-end/README.md back-end/docs/superpowers/specs/2026-10-04-fe-dot-a-nen-tang-dang-nhap-design.md
git commit -m "docs(fe): API_ORIGIN bắt buộc, hướng dẫn website công khai

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
