# Backend Đợt 2 — Gói học, bảng giá theo chi nhánh, chuyên mục & bài viết: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin chỉnh được gói học, giá mặc định, giá ghi đè và phụ phí/ưu đãi theo từng chi nhánh, quản lý chuyên mục và bài viết (gồm mẹo học, thông báo); website lấy bảng giá và tin tức qua API công khai.

**Architecture:** Thêm 4 module feature-based vào `back-end/src/modules/`: `courses`, `pricing`, `categories`, `posts`, cùng route công khai trong `public`. Giá cuối cùng tính bằng một hàm thuần `resolveBranchPricing` (dễ test), service chỉ nạp dữ liệu rồi gọi hàm này. Nội dung bài viết là Plate JSON, được kiểm tra cấu trúc + URL an toàn, đồng thời sinh `contentText` và thời gian đọc.

**Tech Stack:** giữ nguyên đợt 1 — Node ≥ 20.9, TypeScript strict, Express 5, Mongoose 8, zod 4, Vitest + Supertest + mongodb-memory-server.

**Spec:** `docs/superpowers/specs/2026-10-03-backend-api-design.md` (mục 6 "Gói học & giá", "Nội dung"; mục 7 các endpoint `courses`, `pricing`, `categories`, `posts`, `/public/pricing|categories|posts`; mục 12 đợt 2).

## Global Constraints

- Mọi lệnh chạy trong `back-end/`. **KHÔNG commit, KHÔNG stage** (yêu cầu của người dùng) — bỏ qua mọi bước commit; kiểm tra bằng `npm run typecheck && npm run lint && npx vitest run`.
- Dùng lại hạ tầng đợt 1, không viết lại: `validate/validated`, `authenticate`, `authorize(perm, { branchScoped })`, `assertBranchAccess`, `ApiError`, `sendData/sendList`, `paginate/listQuerySchema`, `objectIdSchema/idParamsSchema/zDateTime`, `schemaOptions<T>()` (không cast), `softDeletePlugin/WITH_DELETED`, `slugify`, `escapeRegex`, `recordAudit/snapshot`, `getBranch` (branches.service). Xem `.superpowers/sdd/2026-10-03-backend-dot-1-nen-tang/context-notes.md`.
- Response `{ data }` / `{ data, meta }`; lỗi `{ error: { code, message, details? } }`, message tiếng Việt; chỉ 8 mã lỗi đã có.
- Tiền: số nguyên đơn vị đồng, 0 ≤ giá ≤ 1.000.000.000.
- Thời gian JSON: `+07:00` (đã có json replacer). Thời gian nhập không offset hiểu là giờ VN (`zDateTime`).
- Quyền (đã có trong `src/config/roles.ts`, không thêm quyền mới):
  - `course.read`: mọi nhân viên (đọc gói học, xem bảng giá chi nhánh, xem danh sách mục giá).
  - `course.manage`: chỉ `super_admin` (qua `*`) — tạo/sửa gói, **giá mặc định**.
  - `pricing.manage` (branch_manager, super_admin) + `branchScoped`: giá ghi đè & mục giá **của chi nhánh mình**; mục giá áp dụng mọi chi nhánh (`branchId = null`) chỉ `super_admin`.
  - `category.manage`, `post.manage`: editor, branch_manager, super_admin.
- Mỗi thay đổi giá (giá mặc định, ghi đè, mục giá) và mỗi thay đổi trạng thái bài viết đều ghi audit.
- Không thêm thư viện mới.

### Quyết định thiết kế trong đợt này (chi tiết hóa spec, ghi lại để reviewer biết)
- **Phụ phí và ưu đãi gộp một collection `priceItems`** với `kind: 'fee' | 'discount'` (spec ghi 2 collection `courseFees`/`courseDiscounts` có cùng cấu trúc). API admin tương ứng là `/pricing/items` thay cho `/pricing/fees` + `/pricing/discounts`.
- Mục giá có thêm `unit` (vd `vòng`, `giờ`, `lượt`), `amountMax` (khoảng giá "300.000–600.000đ/giờ") và `hidden` (mục riêng của chi nhánh có `hidden: true` cùng `key` sẽ **ẩn** mục chung ở chi nhánh đó).
- Thứ tự ưu tiên khi trùng `key` trong cùng `kind`: chi nhánh + gói > chi nhánh + mọi gói > chung + gói > chung + mọi gói.
- Chi nhánh **luôn hiển thị đủ mọi gói đang `active`**; chưa làm `branchCourseSettings.hidden` (spec ghi "mở rộng sau").
- Mã gói khớp website hiện tại: `A1`, `A`, `B`, `C1` (regex `^[A-Z0-9_]{1,10}$`, tự viết hoa).
- Ảnh gói học và ảnh bìa bài viết lưu nhúng `{ url, alt, mediaId? }` (url có thể là ảnh upload hoặc ảnh tĩnh của front-end như `/vehicles/car-b.png`); chưa cập nhật `media.refs`.
- Bài viết **không** gắn chi nhánh (bỏ `branchId` trong spec cho đợt này) và **người có `post.manage` được xuất bản trực tiếp**; trạng thái `pending` là bước tùy chọn.
- Bài viết công khai = `status: 'published'` **và** `publishedAt ≤ hiện tại` → hỗ trợ hẹn giờ đăng.
- Không render HTML ở server: API trả Plate JSON, front-end tự render; vì vậy kiểm soát XSS bằng việc chặn URL không an toàn trong JSON.

## Review Focus

1. Nội dung Plate có link/ảnh `url: "javascript:alert(1)"` → 400 `VALIDATION_ERROR` (Task 1, Task 6).
2. Bài `published` nhưng `publishedAt` ở tương lai không xuất hiện ở `/public/posts` và `/public/posts/:slug` trả 404 (Task 7).
3. `branch_manager` sửa mục giá chung (`branchId: null`) hoặc giá mặc định của gói → 403; sửa giá chi nhánh khác → 403 `BRANCH_FORBIDDEN` (Task 2, Task 4).
4. Mục chung bị ẩn ở một chi nhánh vẫn hiện ở chi nhánh khác (Task 3, Task 4).
5. Xóa chuyên mục còn bài viết → 409; hai bài trùng tiêu đề tự sinh slug `-2` (Task 6).

---

## File Structure

```
back-end/src/
├── shared/zod.ts                         # + slugSchema, imageInputSchema
├── shared/mongoose/image.ts              # imageSubSchema (url, alt, mediaId)
├── modules/
│   ├── courses/   course.model.ts courses.validation.ts courses.service.ts courses.controller.ts courses.routes.ts
│   ├── pricing/   price-override.model.ts price-item.model.ts pricing.resolve.ts pricing.validation.ts
│   │              pricing.service.ts pricing.controller.ts pricing.routes.ts
│   ├── categories/ category.model.ts categories.validation.ts categories.service.ts categories.controller.ts categories.routes.ts
│   ├── posts/     plate.ts post.model.ts posts.validation.ts posts.service.ts posts.public.ts posts.controller.ts posts.routes.ts
│   └── public/public.routes.ts           # + /pricing, /categories, /posts, /posts/:slug
├── routes/index.ts                       # + /courses, /pricing, /categories, /posts
├── scripts/  seed.ts (+ gọi seedCatalog)  seed-catalog.ts  seed-catalog-data.ts  seed-posts-data.ts
└── docs/openapi.ts                       # + path đợt 2
back-end/tests/
├── helpers/factories.ts                  # + createCourse, createCategory
├── unit/plate.test.ts  unit/pricing-resolve.test.ts
└── integration/courses.test.ts pricing.test.ts categories.test.ts posts.test.ts public-content.test.ts seed-catalog.test.ts
```

---

### Task 1: Plate JSON — kiểm tra cấu trúc, URL an toàn, trích văn bản, thời gian đọc

**Files:**
- Create: `src/modules/posts/plate.ts`
- Test: `tests/unit/plate.test.ts`

**Interfaces:**
- Produces: `plateContentSchema` (zod, mảng node), `type PlateContent = unknown[]`, `plateToText(nodes: unknown[]): string` (mỗi block 1 dòng), `readTimeMinutes(text: string): number` (200 từ/phút, tối thiểu 1), `paragraphsToPlate(paragraphs: string[]): PlateContent`.

- [ ] **Step 1: Viết test (failing)** — `tests/unit/plate.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { paragraphsToPlate, plateContentSchema, plateToText, readTimeMinutes } from '../../src/modules/posts/plate';

const paragraph = (text: string) => ({ type: 'p', children: [{ text }] });

describe('plateContentSchema', () => {
  it('chấp nhận đoạn văn, định dạng chữ, link và ảnh hợp lệ', () => {
    const content = [
      { type: 'h2', children: [{ text: 'Tiêu đề' }] },
      { type: 'p', children: [{ text: 'Đậm', bold: true }, { type: 'a', url: 'https://giathinh.vn', children: [{ text: 'link' }] }] },
      { type: 'img', url: '/media/a.webp', children: [{ text: '' }] },
    ];
    expect(plateContentSchema.safeParse(content).success).toBe(true);
  });

  it.each(['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html;base64,xx', '//evil.com/x'])(
    'từ chối url không an toàn %s',
    (url) => {
      const result = plateContentSchema.safeParse([{ type: 'a', url, children: [{ text: 'x' }] }]);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual([0, 'url']);
    },
  );

  it('từ chối mảng rỗng, node thiếu children, text không phải chuỗi', () => {
    expect(plateContentSchema.safeParse([]).success).toBe(false);
    expect(plateContentSchema.safeParse([{ type: 'p' }]).success).toBe(false);
    expect(plateContentSchema.safeParse([{ type: 'p', children: [{ text: 1 }] }]).success).toBe(false);
  });

  it('từ chối nội dung lồng quá 12 cấp', () => {
    let node: Record<string, unknown> = { text: 'x' };
    for (let i = 0; i < 13; i += 1) node = { type: 'div', children: [node] };
    expect(plateContentSchema.safeParse([node]).success).toBe(false);
  });
});

describe('plateToText / readTimeMinutes / paragraphsToPlate', () => {
  it('ghép chữ trong một block, mỗi block một dòng, bỏ block rỗng', () => {
    const content = [
      { type: 'p', children: [{ text: 'Xin ' }, { text: 'chào', bold: true }] },
      { type: 'p', children: [{ text: '  ' }] },
      { type: 'ul', children: [{ type: 'li', children: [{ text: 'Mục 1' }] }] },
    ];
    expect(plateToText(content)).toBe('Xin chào\nMục 1');
  });

  it('200 từ một phút, tối thiểu 1 phút', () => {
    expect(readTimeMinutes('')).toBe(1);
    expect(readTimeMinutes(Array.from({ length: 401 }, () => 'từ').join(' '))).toBe(3);
  });

  it('paragraphsToPlate tạo đoạn văn Plate hợp lệ', () => {
    const content = paragraphsToPlate(['Một', 'Hai']);
    expect(content).toEqual([paragraph('Một'), paragraph('Hai')]);
    expect(plateContentSchema.safeParse(content).success).toBe(true);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/unit/plate.test.ts`
Expected: FAIL — `Cannot find module '../../src/modules/posts/plate'`

- [ ] **Step 3: Viết `src/modules/posts/plate.ts`**

```ts
import { z } from 'zod';

const MAX_DEPTH = 12;
const MAX_JSON_LENGTH = 500_000;
const SAFE_URL = /^(https?:\/\/|\/(?!\/)|#|mailto:|tel:)/i;

type PlateRecord = Record<string, unknown>;
export type PlateContent = unknown[];

function checkNode(node: unknown, depth: number, path: (string | number)[], ctx: z.RefinementCtx): void {
  if (depth > MAX_DEPTH) {
    ctx.addIssue({ code: 'custom', path, message: 'Nội dung lồng quá sâu' });
    return;
  }
  if (typeof node !== 'object' || node === null || Array.isArray(node)) {
    ctx.addIssue({ code: 'custom', path, message: 'Node nội dung không hợp lệ' });
    return;
  }
  const record = node as PlateRecord;
  if ('text' in record) {
    if (typeof record.text !== 'string') {
      ctx.addIssue({ code: 'custom', path: [...path, 'text'], message: 'text phải là chuỗi' });
    }
    return;
  }
  if (typeof record.type !== 'string' || record.type.length === 0 || record.type.length > 50) {
    ctx.addIssue({ code: 'custom', path: [...path, 'type'], message: 'type không hợp lệ' });
  }
  if ('url' in record && (typeof record.url !== 'string' || !SAFE_URL.test(record.url.trim()))) {
    ctx.addIssue({ code: 'custom', path: [...path, 'url'], message: 'Đường dẫn không an toàn' });
  }
  if (!Array.isArray(record.children) || record.children.length === 0) {
    ctx.addIssue({ code: 'custom', path: [...path, 'children'], message: 'children phải là mảng không rỗng' });
    return;
  }
  record.children.forEach((child, index) => checkNode(child, depth + 1, [...path, 'children', index], ctx));
}

export const plateContentSchema = z
  .array(z.unknown())
  .min(1, 'Nội dung không được để trống')
  .max(2000, 'Nội dung quá nhiều khối')
  .superRefine((nodes, ctx) => {
    if (JSON.stringify(nodes).length > MAX_JSON_LENGTH) {
      ctx.addIssue({ code: 'custom', message: 'Nội dung quá dài' });
      return;
    }
    nodes.forEach((node, index) => checkNode(node, 1, [index], ctx));
  });

function collectText(node: unknown): string {
  if (typeof node !== 'object' || node === null) return '';
  const record = node as PlateRecord;
  if (typeof record.text === 'string') return record.text;
  return Array.isArray(record.children) ? record.children.map(collectText).join('') : '';
}

export function plateToText(nodes: unknown[]): string {
  return nodes
    .map((node) => collectText(node).trim())
    .filter(Boolean)
    .join('\n');
}

export function readTimeMinutes(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export function paragraphsToPlate(paragraphs: string[]): PlateContent {
  return paragraphs.map((text) => ({ type: 'p', children: [{ text }] }));
}
```

Lưu ý: test `plateToText` với `ul > li` trả `'Mục 1'` vì `collectText` ghép chữ lồng trong cùng block gốc.

- [ ] **Step 4: Chạy test**

Run: `npx vitest run tests/unit/plate.test.ts`
Expected: PASS

- [ ] **Step 5: Kiểm tra toàn bộ**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: tất cả pass.

---

### Task 2: Gói học (courses) + helper ảnh và slug dùng chung

**Files:**
- Modify: `src/shared/zod.ts` (thêm `slugSchema`, `imageInputSchema`), `src/routes/index.ts` (mount `/courses`), `tests/helpers/factories.ts` (thêm `createCourse`)
- Create: `src/shared/mongoose/image.ts`, `src/modules/courses/course.model.ts`, `courses.validation.ts`, `courses.service.ts`, `courses.controller.ts`, `courses.routes.ts`
- Test: `tests/integration/courses.test.ts`

**Interfaces:**
- Produces:
  - `slugSchema` (zod: `^[a-z0-9]+(-[a-z0-9]+)*$`, ≤150), `imageInputSchema` (zod: `{ url, alt, mediaId? }`, url bắt đầu `http(s)://` hoặc `/` nhưng không `//`).
  - `IImage`, `imageSubSchema` (Mongoose, `_id: false`).
  - `Course` model, `ICourse`, `CourseDoc`, `VEHICLE_TYPES`.
  - `listCourses(query)`, `getCourse(id)`, `createCourse(actor, input)`, `updateCourse(actor, id, input)`, `removeCourse(actor, id)`, `reorderCourses(actor, ids)`, `createCoursesRouter()`.
  - Test helper `createCourse(overrides?: Partial<{ code; name; vehicleType; defaultPrice; order; active; priceNote }>) → Promise<CourseDoc>`.

- [ ] **Step 1: Thêm helper dùng chung**

Thêm vào cuối `src/shared/zod.ts`:
```ts
export const slugSchema = z
  .string()
  .trim()
  .max(150)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug chỉ gồm chữ thường không dấu, số và dấu gạch ngang');

export const imageInputSchema = z.object({
  url: z
    .string()
    .trim()
    .max(500)
    .regex(/^(https?:\/\/|\/(?!\/))/, 'URL ảnh phải là http(s) hoặc đường dẫn bắt đầu bằng /'),
  alt: z.string().trim().max(200).default(''),
  mediaId: objectIdSchema.optional(),
});
```

`src/shared/mongoose/image.ts`:
```ts
import { Schema, type Types } from 'mongoose';

export interface IImage {
  url: string;
  alt: string;
  mediaId?: Types.ObjectId | null;
}

export const imageSubSchema = new Schema<IImage>(
  {
    url: { type: String, required: true, trim: true },
    alt: { type: String, default: '', trim: true },
    mediaId: { type: Schema.Types.ObjectId, ref: 'Media', default: null },
  },
  { _id: false },
);
```

- [ ] **Step 2: Viết factory và test (failing)**

Thêm vào `tests/helpers/factories.ts`:
```ts
import { Course, type CourseDoc } from '../../src/modules/courses/course.model';

let courseSeq = 0;

export async function createCourse(
  overrides: Partial<{
    code: string;
    name: string;
    vehicleType: 'moto' | 'car' | 'truck';
    defaultPrice: number;
    priceNote: string;
    order: number;
    active: boolean;
  }> = {},
): Promise<CourseDoc> {
  courseSeq += 1;
  return Course.create({
    code: overrides.code ?? `K${courseSeq}`,
    name: overrides.name ?? `Gói ${courseSeq}`,
    vehicleType: overrides.vehicleType ?? 'moto',
    defaultPrice: overrides.defaultPrice ?? 1_000_000,
    priceNote: overrides.priceNote,
    order: overrides.order ?? courseSeq,
    active: overrides.active ?? true,
  });
}
```

`tests/integration/courses.test.ts`:
```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { Course } from '../../src/modules/courses/course.model';
import { authHeader, createBranch, createCourse, createUser } from '../helpers/factories';

const payload = {
  code: 'b',
  name: 'Hạng B (số sàn & tự động)',
  vehicleType: 'car',
  description: 'Giáo viên kèm từ đầu đến lúc lấy bằng.',
  duration: '3–4 tuần',
  defaultPrice: 16_500_000,
  priceNote: 'Đã gồm xăng DAT',
  image: { url: '/vehicles/car-b.png', alt: 'Xe tập lái hạng B' },
};

describe('admin /courses', () => {
  it('super_admin tạo gói: mã tự viết hoa, có ảnh, có audit', async () => {
    const { user: admin } = await createUser();
    const res = await request(createApp()).post('/api/v1/courses').set(authHeader(admin)).send(payload);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ code: 'B', defaultPrice: 16_500_000, active: true, image: { url: '/vehicles/car-b.png' } });
    expect(await AuditLog.countDocuments({ action: 'course.create' })).toBe(1);
  });

  it('400 khi giá không nguyên hoặc âm, ảnh có url nguy hiểm', async () => {
    const { user: admin } = await createUser();
    const app = createApp();
    for (const body of [
      { ...payload, defaultPrice: 1.5 },
      { ...payload, defaultPrice: -1 },
      { ...payload, image: { url: 'javascript:alert(1)', alt: '' } },
    ]) {
      expect((await request(app).post('/api/v1/courses').set(authHeader(admin)).send(body)).status).toBe(400);
    }
  });

  it('409 khi trùng mã', async () => {
    const { user: admin } = await createUser();
    await Course.init();
    await createCourse({ code: 'B' });
    expect((await request(createApp()).post('/api/v1/courses').set(authHeader(admin)).send(payload)).status).toBe(409);
  });

  it('branch_manager không sửa được giá mặc định (403), consultant đọc được danh sách', async () => {
    const branch = await createBranch();
    const course = await createCourse({ defaultPrice: 620_000 });
    const { user: manager } = await createUser({ role: 'branch_manager', branchIds: [branch.id] });
    const { user: consultant } = await createUser({ role: 'consultant', branchIds: [branch.id] });
    const app = createApp();
    const patch = await request(app).patch(`/api/v1/courses/${course.id}`).set(authHeader(manager)).send({ defaultPrice: 1 });
    expect(patch.status).toBe(403);
    const list = await request(app).get('/api/v1/courses').set(authHeader(consultant));
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(1);
  });

  it('sửa giá mặc định ghi audit before/after', async () => {
    const { user: admin } = await createUser();
    const course = await createCourse({ defaultPrice: 620_000 });
    const res = await request(createApp())
      .patch(`/api/v1/courses/${course.id}`)
      .set(authHeader(admin))
      .send({ defaultPrice: 650_000 });
    expect(res.status).toBe(200);
    const log = await AuditLog.findOne({ action: 'course.update' });
    expect(log?.before).toMatchObject({ defaultPrice: 620_000 });
    expect(log?.after).toMatchObject({ defaultPrice: 650_000 });
  });

  it('reorder đặt order theo thứ tự id gửi lên; id lạ → 400', async () => {
    const { user: admin } = await createUser();
    const [a, b, c] = await Promise.all([createCourse(), createCourse(), createCourse()]);
    const app = createApp();
    const res = await request(app)
      .patch('/api/v1/courses/reorder')
      .set(authHeader(admin))
      .send({ ids: [c!.id, a!.id, b!.id] });
    expect(res.status).toBe(200);
    const list = await request(app).get('/api/v1/courses?sort=order').set(authHeader(admin));
    expect(list.body.data.map((x: { id: string }) => x.id)).toEqual([c!.id, a!.id, b!.id]);
    const bad = await request(app)
      .patch('/api/v1/courses/reorder')
      .set(authHeader(admin))
      .send({ ids: ['0123456789abcdef01234567'] });
    expect(bad.status).toBe(400);
  });

  it('lọc active; xóa mềm → 404', async () => {
    const { user: admin } = await createUser();
    await createCourse({ active: false });
    const course = await createCourse();
    const app = createApp();
    expect((await request(app).get('/api/v1/courses?active=true').set(authHeader(admin))).body.meta.total).toBe(1);
    expect((await request(app).delete(`/api/v1/courses/${course.id}`).set(authHeader(admin))).status).toBe(204);
    expect((await request(app).get(`/api/v1/courses/${course.id}`).set(authHeader(admin))).status).toBe(404);
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `npx vitest run tests/integration/courses.test.ts`
Expected: FAIL — module `course.model` không tồn tại.

- [ ] **Step 4: Viết module courses**

`src/modules/courses/course.model.ts`:
```ts
import { model, Schema, type HydratedDocument } from 'mongoose';
import { imageSubSchema, type IImage } from '../../shared/mongoose/image';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';
import { softDeletePlugin } from '../../shared/mongoose/softDelete';

export const VEHICLE_TYPES = ['moto', 'car', 'truck'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export interface ICourse {
  code: string;
  name: string;
  vehicleType: VehicleType;
  description?: string;
  duration?: string;
  defaultPrice: number;
  priceNote?: string;
  image?: IImage | null;
  order: number;
  active: boolean;
  deletedAt?: Date | null;
}

export type CourseDoc = HydratedDocument<ICourse>;

const courseSchema = new Schema<ICourse>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    vehicleType: { type: String, enum: VEHICLE_TYPES, required: true },
    description: { type: String, trim: true },
    duration: { type: String, trim: true },
    defaultPrice: { type: Number, required: true, min: 0 },
    priceNote: { type: String, trim: true },
    image: { type: imageSubSchema, default: null },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  schemaOptions<ICourse>(),
);

courseSchema.plugin(softDeletePlugin);

export const Course = model<ICourse>('Course', courseSchema);
```

`src/modules/courses/courses.validation.ts`:
```ts
import { z } from 'zod';
import { listQuerySchema } from '../../shared/mongoose/paginate';
import { imageInputSchema, objectIdSchema } from '../../shared/zod';
import { VEHICLE_TYPES } from './course.model';

export const moneySchema = z
  .number()
  .int('Số tiền phải là số nguyên (đồng)')
  .min(0, 'Số tiền không được âm')
  .max(1_000_000_000, 'Số tiền quá lớn');

const fields = {
  code: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(z.string().regex(/^[A-Z0-9_]{1,10}$/, 'Mã gói chỉ gồm chữ in hoa, số, gạch dưới (tối đa 10 ký tự)')),
  name: z.string().trim().min(2).max(100),
  vehicleType: z.enum(VEHICLE_TYPES),
  description: z.string().trim().max(1000).optional(),
  duration: z.string().trim().max(100).optional(),
  defaultPrice: moneySchema,
  priceNote: z.string().trim().max(500).optional(),
  image: imageInputSchema.nullable().optional(),
  order: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
};

export const createCourseSchema = z.object(fields);
export const updateCourseSchema = z.object(fields).partial();
export const reorderCoursesSchema = z.object({ ids: z.array(objectIdSchema).min(1).max(100) });
export const listCoursesQuerySchema = listQuerySchema.extend({
  active: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  vehicleType: z.enum(VEHICLE_TYPES).optional(),
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
export type ListCoursesQuery = z.infer<typeof listCoursesQuerySchema>;
```

`src/modules/courses/courses.service.ts`:
```ts
import type { FilterQuery } from 'mongoose';
import { paginate } from '../../shared/mongoose/paginate';
import { WITH_DELETED } from '../../shared/mongoose/softDelete';
import { ApiError } from '../../utils/ApiError';
import { escapeRegex } from '../../utils/regex';
import { recordAudit, snapshot } from '../audit/audit.service';
import { Course, type CourseDoc, type ICourse } from './course.model';
import type { CreateCourseInput, ListCoursesQuery, UpdateCourseInput } from './courses.validation';

type Actor = Express.AuthUser;

export async function listCourses(query: ListCoursesQuery) {
  const filter: FilterQuery<ICourse> = {};
  if (query.active !== undefined) filter.active = query.active;
  if (query.vehicleType) filter.vehicleType = query.vehicleType;
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ code: pattern }, { name: pattern }];
  }
  return paginate(Course, filter, query, 'order');
}

export async function getCourse(id: string): Promise<CourseDoc> {
  const course = await Course.findById(id);
  if (!course) throw ApiError.notFound('Không tìm thấy gói học');
  return course;
}

async function assertCodeFree(code: string, exceptId?: string): Promise<void> {
  const taken = await Course.exists({ code, ...WITH_DELETED, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
  if (taken) throw ApiError.conflict('Mã gói đã tồn tại', [{ path: 'body.code', message: 'Đã tồn tại' }]);
}

export async function createCourse(actor: Actor, input: CreateCourseInput): Promise<CourseDoc> {
  await assertCodeFree(input.code);
  const course = await Course.create(input);
  await recordAudit({ actorId: actor.id, action: 'course.create', entity: 'course', entityId: course.id, after: snapshot(course) });
  return course;
}

export async function updateCourse(actor: Actor, id: string, input: UpdateCourseInput): Promise<CourseDoc> {
  const course = await getCourse(id);
  if (input.code && input.code !== course.code) await assertCodeFree(input.code, id);
  const before = snapshot(course);
  course.set(input);
  await course.save();
  await recordAudit({ actorId: actor.id, action: 'course.update', entity: 'course', entityId: id, before, after: snapshot(course) });
  return course;
}

export async function removeCourse(actor: Actor, id: string): Promise<void> {
  const course = await getCourse(id);
  const before = snapshot(course);
  course.deletedAt = new Date();
  await course.save();
  await recordAudit({ actorId: actor.id, action: 'course.delete', entity: 'course', entityId: id, before });
}

export async function reorderCourses(actor: Actor, ids: string[]): Promise<void> {
  const unique = [...new Set(ids)];
  if ((await Course.countDocuments({ _id: { $in: unique } })) !== unique.length) {
    throw ApiError.badRequest('Có gói học không tồn tại', [{ path: 'body.ids', message: 'Không tồn tại' }]);
  }
  await Course.bulkWrite(unique.map((id, index) => ({ updateOne: { filter: { _id: id }, update: { order: index } } })));
  await recordAudit({ actorId: actor.id, action: 'course.reorder', entity: 'course', entityId: 'all', after: unique });
}
```

`src/modules/courses/courses.controller.ts`:
```ts
import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendData, sendList } from '../../utils/response';
import * as service from './courses.service';
import type { CreateCourseInput, ListCoursesQuery, UpdateCourseInput } from './courses.validation';

type IdParams = { id: string };

export async function list(req: Request, res: Response): Promise<void> {
  sendList(res, await service.listCourses(validated<ListCoursesQuery>(req, 'query')));
}

export async function get(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getCourse(validated<IdParams>(req, 'params').id));
}

export async function create(req: Request, res: Response): Promise<void> {
  sendData(res, await service.createCourse(req.user!, validated<CreateCourseInput>(req, 'body')), 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = validated<IdParams>(req, 'params');
  sendData(res, await service.updateCourse(req.user!, id, validated<UpdateCourseInput>(req, 'body')));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.removeCourse(req.user!, validated<IdParams>(req, 'params').id);
  res.status(204).end();
}

export async function reorder(req: Request, res: Response): Promise<void> {
  await service.reorderCourses(req.user!, validated<{ ids: string[] }>(req, 'body').ids);
  sendData(res, { ok: true });
}
```

`src/modules/courses/courses.routes.ts`:
```ts
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../shared/zod';
import * as controller from './courses.controller';
import {
  createCourseSchema,
  listCoursesQuerySchema,
  reorderCoursesSchema,
  updateCourseSchema,
} from './courses.validation';

export function createCoursesRouter(): Router {
  const router = Router();
  router.use(authenticate);
  router.get('/', authorize('course.read'), validate({ query: listCoursesQuerySchema }), controller.list);
  router.post('/', authorize('course.manage'), validate({ body: createCourseSchema }), controller.create);
  router.patch('/reorder', authorize('course.manage'), validate({ body: reorderCoursesSchema }), controller.reorder);
  router.get('/:id', authorize('course.read'), validate({ params: idParamsSchema }), controller.get);
  router.patch(
    '/:id',
    authorize('course.manage'),
    validate({ params: idParamsSchema, body: updateCourseSchema }),
    controller.update,
  );
  router.delete('/:id', authorize('course.manage'), validate({ params: idParamsSchema }), controller.remove);
  return router;
}
```

Trong `src/routes/index.ts`: import `createCoursesRouter` và thêm `router.use('/courses', createCoursesRouter());` (trước `/public`).

- [ ] **Step 5: Chạy test**

Run: `npx vitest run tests/integration/courses.test.ts`
Expected: PASS

- [ ] **Step 6: Kiểm tra toàn bộ**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: tất cả pass.

---

### Task 3: Model giá ghi đè, mục giá và hàm tính giá cuối cùng

**Files:**
- Create: `src/modules/pricing/price-override.model.ts`, `src/modules/pricing/price-item.model.ts`, `src/modules/pricing/pricing.resolve.ts`
- Test: `tests/unit/pricing-resolve.test.ts`

**Interfaces:**
- Produces:
  - `PriceOverride` model (`branchId`, `courseId`, `price`, `priceNote?`; unique `(branchId, courseId)`), `IPriceOverride`.
  - `PriceItem` model (`kind`, `key`, `courseId|null`, `branchId|null`, `label`, `amount?`, `amountMax?`, `unit?`, `note?`, `hidden`, `order`; unique `(kind, key, courseId, branchId)`), `IPriceItem`, `PRICE_ITEM_KINDS`, `PriceItemKind`.
  - `resolveBranchPricing(branchId: string, courses: ResolverCourse[], overrides: ResolverOverride[], items: ResolverItem[]): ResolvedCourse[]` và các type `ResolverCourse`, `ResolverOverride`, `ResolverItem`, `ResolvedItem`, `ResolvedCourse`.

- [ ] **Step 1: Viết test (failing)** — `tests/unit/pricing-resolve.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import {
  resolveBranchPricing,
  type ResolverCourse,
  type ResolverItem,
} from '../../src/modules/pricing/pricing.resolve';

const A = 'branch-a';
const B = 'branch-b';

const courses: ResolverCourse[] = [
  { id: 'a', code: 'A', name: 'Hạng A', vehicleType: 'moto', defaultPrice: 1_750_000, priceNote: 'Gồm lệ phí', order: 2 },
  { id: 'a1', code: 'A1', name: 'Hạng A1', vehicleType: 'moto', defaultPrice: 620_000, order: 1 },
];

let seq = 0;
function item(overrides: Partial<ResolverItem>): ResolverItem {
  seq += 1;
  return {
    id: `i${seq}`,
    kind: 'fee',
    key: 'k',
    courseId: null,
    branchId: null,
    label: 'Mục',
    hidden: false,
    order: 0,
    ...overrides,
  };
}

describe('resolveBranchPricing', () => {
  it('đủ mọi gói, sắp theo order, mặc định dùng giá gốc', () => {
    const result = resolveBranchPricing(A, courses, [], []);
    expect(result.map((c) => c.code)).toEqual(['A1', 'A']);
    expect(result[1]).toMatchObject({ price: 1_750_000, priceNote: 'Gồm lệ phí', priceSource: 'default', defaultPrice: 1_750_000 });
    expect(result[0]?.priceNote).toBeNull();
  });

  it('giá ghi đè thay giá gốc; priceNote ghi đè nếu có, không thì giữ của gói', () => {
    const result = resolveBranchPricing(A, courses, [{ courseId: 'a', price: 1_595_000 }, { courseId: 'a1', price: 790_000, priceNote: 'Riêng' }], []);
    expect(result.find((c) => c.code === 'A')).toMatchObject({ price: 1_595_000, priceSource: 'override', priceNote: 'Gồm lệ phí' });
    expect(result.find((c) => c.code === 'A1')).toMatchObject({ price: 790_000, priceNote: 'Riêng' });
  });

  it('mục của chi nhánh cùng key thay mục chung; chi nhánh khác vẫn thấy mục chung', () => {
    const items = [
      item({ key: 'cam-bien-a', courseId: 'a', label: 'Xe cảm biến A', amount: 70_000, unit: 'vòng' }),
      item({ key: 'cam-bien-a', courseId: 'a', branchId: B, label: 'Cảm biến A tay ga Vespa', amount: 50_000, unit: 'vòng' }),
    ];
    const atA = resolveBranchPricing(A, courses, [], items).find((c) => c.code === 'A')!;
    const atB = resolveBranchPricing(B, courses, [], items).find((c) => c.code === 'A')!;
    expect(atA.fees).toEqual([
      { id: expect.any(String), key: 'cam-bien-a', label: 'Xe cảm biến A', amount: 70_000, amountMax: null, unit: 'vòng', note: null, source: 'global' },
    ]);
    expect(atB.fees).toMatchObject([{ label: 'Cảm biến A tay ga Vespa', amount: 50_000, source: 'branch' }]);
  });

  it('hidden ở chi nhánh ẩn mục chung chỉ ở chi nhánh đó', () => {
    const items = [
      item({ key: 'thi-thu', label: 'Thi thử máy tính', amount: 10_000 }),
      item({ key: 'thi-thu', branchId: B, label: 'Thi thử máy tính', hidden: true }),
    ];
    expect(resolveBranchPricing(A, courses, [], items)[0]?.fees).toHaveLength(1);
    expect(resolveBranchPricing(B, courses, [], items)[0]?.fees).toHaveLength(0);
  });

  it('mục chỉ áp dụng cho gói khác không xuất hiện; mục courseId null áp dụng mọi gói', () => {
    const items = [item({ key: 'chung', label: 'Chung' }), item({ key: 'rieng-a', courseId: 'a', label: 'Riêng A' })];
    const result = resolveBranchPricing(A, courses, [], items);
    expect(result.find((c) => c.code === 'A1')?.fees.map((f) => f.label)).toEqual(['Chung']);
    expect(result.find((c) => c.code === 'A')?.fees.map((f) => f.label).sort()).toEqual(['Chung', 'Riêng A']);
  });

  it('ưu tiên: chi nhánh+gói > chi nhánh+mọi gói > chung+gói > chung+mọi gói', () => {
    const items = [
      item({ key: 'x', label: 'chung-moi-goi' }),
      item({ key: 'x', courseId: 'a', label: 'chung-goi' }),
      item({ key: 'x', branchId: A, label: 'cn-moi-goi' }),
    ];
    expect(resolveBranchPricing(A, courses, [], items).find((c) => c.code === 'A')?.fees[0]?.label).toBe('cn-moi-goi');
    items.push(item({ key: 'x', courseId: 'a', branchId: A, label: 'cn-goi' }));
    expect(resolveBranchPricing(A, courses, [], items).find((c) => c.code === 'A')?.fees[0]?.label).toBe('cn-goi');
    expect(resolveBranchPricing(B, courses, [], items).find((c) => c.code === 'A')?.fees[0]?.label).toBe('chung-goi');
  });

  it('tách fee và discount, sắp theo order rồi label', () => {
    const items = [
      item({ key: 'z', kind: 'discount', label: 'Giảm Z', order: 2 }),
      item({ key: 'y', kind: 'discount', label: 'Giảm Y', order: 1 }),
      item({ key: 'f', kind: 'fee', label: 'Phí' }),
    ];
    const course = resolveBranchPricing(A, courses, [], items)[0]!;
    expect(course.fees.map((f) => f.label)).toEqual(['Phí']);
    expect(course.discounts.map((d) => d.label)).toEqual(['Giảm Y', 'Giảm Z']);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/unit/pricing-resolve.test.ts`
Expected: FAIL — module không tồn tại.

- [ ] **Step 3: Viết model và resolver**

`src/modules/pricing/price-override.model.ts`:
```ts
import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';

export interface IPriceOverride {
  branchId: Types.ObjectId;
  courseId: Types.ObjectId;
  price: number;
  priceNote?: string | null;
}

export type PriceOverrideDoc = HydratedDocument<IPriceOverride>;

const priceOverrideSchema = new Schema<IPriceOverride>(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    price: { type: Number, required: true, min: 0 },
    priceNote: { type: String, trim: true, default: null },
  },
  schemaOptions<IPriceOverride>(),
);

priceOverrideSchema.index({ branchId: 1, courseId: 1 }, { unique: true });

export const PriceOverride = model<IPriceOverride>('PriceOverride', priceOverrideSchema);
```

`src/modules/pricing/price-item.model.ts`:
```ts
import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';

export const PRICE_ITEM_KINDS = ['fee', 'discount'] as const;
export type PriceItemKind = (typeof PRICE_ITEM_KINDS)[number];

export interface IPriceItem {
  kind: PriceItemKind;
  key: string;
  courseId: Types.ObjectId | null;
  branchId: Types.ObjectId | null;
  label: string;
  amount?: number | null;
  amountMax?: number | null;
  unit?: string | null;
  note?: string | null;
  hidden: boolean;
  order: number;
}

export type PriceItemDoc = HydratedDocument<IPriceItem>;

const priceItemSchema = new Schema<IPriceItem>(
  {
    kind: { type: String, enum: PRICE_ITEM_KINDS, required: true },
    key: { type: String, required: true, trim: true, lowercase: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', default: null },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null },
    label: { type: String, required: true, trim: true },
    amount: { type: Number, min: 0, default: null },
    amountMax: { type: Number, min: 0, default: null },
    unit: { type: String, trim: true, default: null },
    note: { type: String, trim: true, default: null },
    hidden: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  schemaOptions<IPriceItem>(),
);

priceItemSchema.index({ kind: 1, key: 1, courseId: 1, branchId: 1 }, { unique: true });
priceItemSchema.index({ branchId: 1 });

export const PriceItem = model<IPriceItem>('PriceItem', priceItemSchema);
```

`src/modules/pricing/pricing.resolve.ts`:
```ts
export type ResolverCourse = {
  id: string;
  code: string;
  name: string;
  vehicleType: string;
  description?: string;
  duration?: string;
  defaultPrice: number;
  priceNote?: string;
  image?: { url: string; alt: string } | null;
  order: number;
};

export type ResolverOverride = { courseId: string; price: number; priceNote?: string | null };

export type ResolverItem = {
  id: string;
  kind: 'fee' | 'discount';
  key: string;
  courseId: string | null;
  branchId: string | null;
  label: string;
  amount?: number | null;
  amountMax?: number | null;
  unit?: string | null;
  note?: string | null;
  hidden: boolean;
  order: number;
};

export type ResolvedItem = {
  id: string;
  key: string;
  label: string;
  amount: number | null;
  amountMax: number | null;
  unit: string | null;
  note: string | null;
  source: 'global' | 'branch';
};

export type ResolvedCourse = {
  id: string;
  code: string;
  name: string;
  vehicleType: string;
  description: string | null;
  duration: string | null;
  image: { url: string; alt: string } | null;
  defaultPrice: number;
  price: number;
  priceNote: string | null;
  priceSource: 'default' | 'override';
  fees: ResolvedItem[];
  discounts: ResolvedItem[];
};

function rank(item: ResolverItem, branchId: string): number {
  return (item.branchId === branchId ? 2 : 0) + (item.courseId ? 1 : 0);
}

function pickItems(items: ResolverItem[], kind: ResolverItem['kind'], branchId: string): ResolvedItem[] {
  const winners = new Map<string, ResolverItem>();
  for (const item of items) {
    if (item.kind !== kind) continue;
    const current = winners.get(item.key);
    if (!current || rank(item, branchId) > rank(current, branchId)) winners.set(item.key, item);
  }
  return [...winners.values()]
    .filter((item) => !item.hidden)
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'vi'))
    .map((item) => ({
      id: item.id,
      key: item.key,
      label: item.label,
      amount: item.amount ?? null,
      amountMax: item.amountMax ?? null,
      unit: item.unit ?? null,
      note: item.note ?? null,
      source: item.branchId ? 'branch' : 'global',
    }));
}

export function resolveBranchPricing(
  branchId: string,
  courses: ResolverCourse[],
  overrides: ResolverOverride[],
  items: ResolverItem[],
): ResolvedCourse[] {
  const overrideByCourse = new Map(overrides.map((override) => [override.courseId, override]));
  const inScope = items.filter((item) => item.branchId === null || item.branchId === branchId);

  return [...courses]
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'vi'))
    .map((course) => {
      const override = overrideByCourse.get(course.id);
      const applicable = inScope.filter((item) => item.courseId === null || item.courseId === course.id);
      return {
        id: course.id,
        code: course.code,
        name: course.name,
        vehicleType: course.vehicleType,
        description: course.description ?? null,
        duration: course.duration ?? null,
        image: course.image ?? null,
        defaultPrice: course.defaultPrice,
        price: override?.price ?? course.defaultPrice,
        priceNote: override?.priceNote ?? course.priceNote ?? null,
        priceSource: override ? 'override' : 'default',
        fees: pickItems(applicable, 'fee', branchId),
        discounts: pickItems(applicable, 'discount', branchId),
      };
    });
}
```

- [ ] **Step 4: Chạy test**

Run: `npx vitest run tests/unit/pricing-resolve.test.ts`
Expected: PASS

- [ ] **Step 5: Kiểm tra toàn bộ**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: tất cả pass.

---

### Task 4: API bảng giá (admin) và `/public/pricing`

**Files:**
- Create: `src/modules/pricing/pricing.validation.ts`, `pricing.service.ts`, `pricing.controller.ts`, `pricing.routes.ts`
- Modify: `src/routes/index.ts` (mount `/pricing`), `src/modules/public/public.routes.ts` (thêm `GET /pricing`)
- Test: `tests/integration/pricing.test.ts`

**Interfaces:**
- Consumes: `Course`, `PriceOverride`, `PriceItem`, `resolveBranchPricing`, `getBranch`, `Branch`, `assertBranchAccess`, `moneySchema` (courses.validation), `recordAudit`, `snapshot`.
- Produces:
  - `getBranchPricing(branchId): Promise<{ branch: BranchDoc; courses: ResolvedCourse[] }>`.
  - `setOverride(actor, scope, branchId, courseId, input)`, `removeOverride(actor, scope, branchId, courseId)`.
  - `listPriceItems(query)`, `createPriceItem(actor, scope, input)`, `updatePriceItem(actor, scope, id, input)`, `removePriceItem(actor, scope, id)`.
  - `getPublicPricing(branchSlug?: string)` → có slug: `{ branch, courses }`; không slug: mảng `{ branch, courses }` theo mọi chi nhánh active. `branch` công khai = `{ name, slug, officeName, address }`; course công khai bỏ `id`, `defaultPrice`, `priceSource`; item công khai bỏ `id`, `source`.
  - `createPricingRouter()`.

- [ ] **Step 1: Viết test (failing)** — `tests/integration/pricing.test.ts`

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { PriceItem } from '../../src/modules/pricing/price-item.model';
import { authHeader, createBranch, createCourse, createUser } from '../helpers/factories';

async function setup() {
  const [a, b] = await Promise.all([createBranch({ name: 'A', slug: 'chi-nhanh-a' }), createBranch({ name: 'B', slug: 'chi-nhanh-b' })]);
  const courseA = await createCourse({ code: 'A', defaultPrice: 1_750_000, order: 1 });
  const { user: admin } = await createUser();
  const { user: managerA } = await createUser({ role: 'branch_manager', branchIds: [a.id] });
  const { user: consultantA } = await createUser({ role: 'consultant', branchIds: [a.id] });
  return { app: createApp(), a, b, courseA, admin, managerA, consultantA };
}

describe('giá ghi đè theo chi nhánh', () => {
  it('quản lý A đặt giá riêng cho A; có audit; chi nhánh B → BRANCH_FORBIDDEN', async () => {
    const { app, a, b, courseA, managerA } = await setup();
    const res = await request(app)
      .put(`/api/v1/pricing/branches/${a.id}/courses/${courseA.id}`)
      .set(authHeader(managerA))
      .send({ price: 1_595_000 });
    expect(res.status).toBe(200);
    expect(res.body.data.courses[0]).toMatchObject({ code: 'A', price: 1_595_000, priceSource: 'override', defaultPrice: 1_750_000 });
    expect(await AuditLog.countDocuments({ action: 'price_override.set' })).toBe(1);

    const other = await request(app)
      .put(`/api/v1/pricing/branches/${b.id}/courses/${courseA.id}`)
      .set(authHeader(managerA))
      .send({ price: 1 });
    expect(other.status).toBe(403);
    expect(other.body.error.code).toBe('BRANCH_FORBIDDEN');
  });

  it('xóa giá riêng → về giá mặc định; xóa khi không có → 404', async () => {
    const { app, a, courseA, admin } = await setup();
    const url = `/api/v1/pricing/branches/${a.id}/courses/${courseA.id}`;
    await request(app).put(url).set(authHeader(admin)).send({ price: 1_000_000 });
    expect((await request(app).delete(url).set(authHeader(admin))).status).toBe(204);
    const pricing = await request(app).get(`/api/v1/pricing/branches/${a.id}`).set(authHeader(admin));
    expect(pricing.body.data.courses[0]).toMatchObject({ price: 1_750_000, priceSource: 'default' });
    expect((await request(app).delete(url).set(authHeader(admin))).status).toBe(404);
  });

  it('consultant xem được bảng giá chi nhánh nhưng không sửa được (403)', async () => {
    const { app, a, courseA, consultantA } = await setup();
    expect((await request(app).get(`/api/v1/pricing/branches/${a.id}`).set(authHeader(consultantA))).status).toBe(200);
    const put = await request(app)
      .put(`/api/v1/pricing/branches/${a.id}/courses/${courseA.id}`)
      .set(authHeader(consultantA))
      .send({ price: 1 });
    expect(put.status).toBe(403);
  });

  it('404 khi chi nhánh hoặc gói không tồn tại', async () => {
    const { app, a, courseA, admin } = await setup();
    const missing = '0123456789abcdef01234567';
    expect((await request(app).put(`/api/v1/pricing/branches/${missing}/courses/${courseA.id}`).set(authHeader(admin)).send({ price: 1 })).status).toBe(404);
    expect((await request(app).put(`/api/v1/pricing/branches/${a.id}/courses/${missing}`).set(authHeader(admin)).send({ price: 1 })).status).toBe(404);
  });
});

describe('mục giá (phụ phí / ưu đãi)', () => {
  const globalFee = (courseId: string) => ({
    kind: 'fee',
    key: 'thi-thu-may-tinh',
    courseId,
    label: 'Thi thử máy tính',
    amount: 10_000,
    unit: 'lượt',
  });

  it('chỉ super_admin tạo mục chung; quản lý A tạo mục riêng cho A', async () => {
    const { app, a, courseA, admin, managerA } = await setup();
    expect((await request(app).post('/api/v1/pricing/items').set(authHeader(managerA)).send(globalFee(courseA.id))).status).toBe(403);
    expect((await request(app).post('/api/v1/pricing/items').set(authHeader(admin)).send(globalFee(courseA.id))).status).toBe(201);
    const own = await request(app)
      .post('/api/v1/pricing/items')
      .set(authHeader(managerA))
      .send({ ...globalFee(courseA.id), branchId: a.id, hidden: true });
    expect(own.status).toBe(201);
  });

  it('ẩn mục chung ở A, B vẫn thấy (qua /public/pricing)', async () => {
    const { app, a, courseA, admin, managerA } = await setup();
    await request(app).post('/api/v1/pricing/items').set(authHeader(admin)).send(globalFee(courseA.id));
    await request(app)
      .post('/api/v1/pricing/items')
      .set(authHeader(managerA))
      .send({ ...globalFee(courseA.id), branchId: a.id, hidden: true });
    const atA = await request(app).get('/api/v1/public/pricing?branch=chi-nhanh-a');
    const atB = await request(app).get('/api/v1/public/pricing?branch=chi-nhanh-b');
    expect(atA.body.data.courses[0].fees).toEqual([]);
    expect(atB.body.data.courses[0].fees).toEqual([
      { key: 'thi-thu-may-tinh', label: 'Thi thử máy tính', amount: 10_000, amountMax: null, unit: 'lượt', note: null },
    ]);
  });

  it('400: hidden trên mục chung, amountMax < amount; 409 khi trùng; PATCH mục chung bởi quản lý → 403', async () => {
    const { app, courseA, admin, managerA } = await setup();
    await PriceItem.init();
    expect((await request(app).post('/api/v1/pricing/items').set(authHeader(admin)).send({ ...globalFee(courseA.id), hidden: true })).status).toBe(400);
    expect(
      (await request(app).post('/api/v1/pricing/items').set(authHeader(admin)).send({ ...globalFee(courseA.id), amount: 600_000, amountMax: 300_000 })).status,
    ).toBe(400);
    const created = await request(app).post('/api/v1/pricing/items').set(authHeader(admin)).send(globalFee(courseA.id));
    expect((await request(app).post('/api/v1/pricing/items').set(authHeader(admin)).send(globalFee(courseA.id))).status).toBe(409);
    const patch = await request(app)
      .patch(`/api/v1/pricing/items/${created.body.data.id}`)
      .set(authHeader(managerA))
      .send({ amount: 1 });
    expect(patch.status).toBe(403);
  });

  it('super_admin sửa và xóa mục; danh sách lọc theo branchId=global', async () => {
    const { app, a, courseA, admin } = await setup();
    const created = await request(app).post('/api/v1/pricing/items').set(authHeader(admin)).send(globalFee(courseA.id));
    await request(app)
      .post('/api/v1/pricing/items')
      .set(authHeader(admin))
      .send({ ...globalFee(courseA.id), branchId: a.id, amount: 5_000 });
    const patched = await request(app)
      .patch(`/api/v1/pricing/items/${created.body.data.id}`)
      .set(authHeader(admin))
      .send({ amount: 15_000 });
    expect(patched.body.data.amount).toBe(15_000);
    const globals = await request(app).get('/api/v1/pricing/items?branchId=global').set(authHeader(admin));
    expect(globals.body.meta.total).toBe(1);
    expect((await request(app).delete(`/api/v1/pricing/items/${created.body.data.id}`).set(authHeader(admin))).status).toBe(204);
    expect(await AuditLog.countDocuments({ entity: 'price_item' })).toBe(4);
  });
});

describe('GET /public/pricing', () => {
  it('không cần đăng nhập; trả mọi chi nhánh active; không lộ trường nội bộ; gói inactive bị ẩn', async () => {
    const { app } = await setup();
    await createCourse({ code: 'OFF', active: false });
    await createBranch({ name: 'Ẩn', slug: 'an', status: 'inactive' });
    const res = await request(app).get('/api/v1/public/pricing');
    expect(res.status).toBe(200);
    expect(res.body.data.map((entry: { branch: { slug: string } }) => entry.branch.slug)).toEqual(['chi-nhanh-a', 'chi-nhanh-b']);
    const course = res.body.data[0].courses[0];
    expect(course).toMatchObject({ code: 'A', price: 1_750_000 });
    expect(course).not.toHaveProperty('defaultPrice');
    expect(course).not.toHaveProperty('priceSource');
    expect(course).not.toHaveProperty('id');
    expect(res.body.data[0].courses.map((c: { code: string }) => c.code)).not.toContain('OFF');
  });

  it('slug không tồn tại hoặc chi nhánh inactive → 404', async () => {
    const { app } = await setup();
    await createBranch({ slug: 'dong-cua', status: 'inactive' });
    expect((await request(app).get('/api/v1/public/pricing?branch=khong-co')).status).toBe(404);
    expect((await request(app).get('/api/v1/public/pricing?branch=dong-cua')).status).toBe(404);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/integration/pricing.test.ts`
Expected: FAIL — route 404.

- [ ] **Step 3: Viết code**

`src/modules/pricing/pricing.validation.ts`:
```ts
import { z } from 'zod';
import { listQuerySchema } from '../../shared/mongoose/paginate';
import { objectIdSchema } from '../../shared/zod';
import { moneySchema } from '../courses/courses.validation';
import { PRICE_ITEM_KINDS } from './price-item.model';

export const branchParamsSchema = z.object({ branchId: objectIdSchema });
export const branchCourseParamsSchema = z.object({ branchId: objectIdSchema, courseId: objectIdSchema });

export const setOverrideSchema = z.object({
  price: moneySchema,
  priceNote: z.string().trim().max(500).optional(),
});

const keySchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.string().max(50).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Key chỉ gồm chữ thường không dấu, số và dấu gạch ngang'));

const editable = {
  label: z.string().trim().min(1).max(150),
  amount: moneySchema.nullable().optional(),
  amountMax: moneySchema.nullable().optional(),
  unit: z.string().trim().max(20).nullable().optional(),
  note: z.string().trim().max(300).nullable().optional(),
  hidden: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
};

export const createPriceItemSchema = z.object({
  kind: z.enum(PRICE_ITEM_KINDS),
  key: keySchema,
  courseId: objectIdSchema.nullable().optional(),
  branchId: objectIdSchema.nullable().optional(),
  ...editable,
});

export const updatePriceItemSchema = z.object(editable).partial();

export const listPriceItemsQuerySchema = listQuerySchema.extend({
  kind: z.enum(PRICE_ITEM_KINDS).optional(),
  branchId: z.union([objectIdSchema, z.literal('global')]).optional(),
  courseId: objectIdSchema.optional(),
});

export const publicPricingQuerySchema = z.object({
  branch: z.string().trim().max(150).optional(),
});

export type SetOverrideInput = z.infer<typeof setOverrideSchema>;
export type CreatePriceItemInput = z.infer<typeof createPriceItemSchema>;
export type UpdatePriceItemInput = z.infer<typeof updatePriceItemSchema>;
export type ListPriceItemsQuery = z.infer<typeof listPriceItemsQuerySchema>;
```

`src/modules/pricing/pricing.service.ts`:
```ts
import type { FilterQuery, Types } from 'mongoose';
import { assertBranchAccess } from '../../middlewares/authorize.middleware';
import { paginate } from '../../shared/mongoose/paginate';
import { ApiError } from '../../utils/ApiError';
import { recordAudit, snapshot } from '../audit/audit.service';
import { Branch, type BranchDoc } from '../branches/branch.model';
import { getBranch } from '../branches/branches.service';
import { Course } from '../courses/course.model';
import { PriceItem, type IPriceItem, type PriceItemDoc } from './price-item.model';
import { PriceOverride } from './price-override.model';
import {
  resolveBranchPricing,
  type ResolvedCourse,
  type ResolverCourse,
  type ResolverItem,
  type ResolverOverride,
} from './pricing.resolve';
import type {
  CreatePriceItemInput,
  ListPriceItemsQuery,
  SetOverrideInput,
  UpdatePriceItemInput,
} from './pricing.validation';

type Actor = Express.AuthUser;
type Scope = Express.BranchScope | undefined;

const idOf = (value: Types.ObjectId | null | undefined): string | null => (value ? value.toString() : null);

async function loadActiveCourses(): Promise<ResolverCourse[]> {
  const courses = await Course.find({ active: true });
  return courses.map((course) => ({
    id: course.id,
    code: course.code,
    name: course.name,
    vehicleType: course.vehicleType,
    description: course.description,
    duration: course.duration,
    defaultPrice: course.defaultPrice,
    priceNote: course.priceNote,
    image: course.image ? { url: course.image.url, alt: course.image.alt } : null,
    order: course.order,
  }));
}

function toResolverItem(item: PriceItemDoc): ResolverItem {
  return {
    id: item.id,
    kind: item.kind,
    key: item.key,
    courseId: idOf(item.courseId),
    branchId: idOf(item.branchId),
    label: item.label,
    amount: item.amount,
    amountMax: item.amountMax,
    unit: item.unit,
    note: item.note,
    hidden: item.hidden,
    order: item.order,
  };
}

async function resolveFor(branchIds: string[]): Promise<Map<string, ResolvedCourse[]>> {
  const [courses, overrides, items] = await Promise.all([
    loadActiveCourses(),
    PriceOverride.find({ branchId: { $in: branchIds } }),
    PriceItem.find({ $or: [{ branchId: null }, { branchId: { $in: branchIds } }] }),
  ]);
  const resolverItems = items.map(toResolverItem);
  return new Map(
    branchIds.map((branchId) => {
      const branchOverrides: ResolverOverride[] = overrides
        .filter((override) => override.branchId.toString() === branchId)
        .map((override) => ({ courseId: override.courseId.toString(), price: override.price, priceNote: override.priceNote }));
      return [branchId, resolveBranchPricing(branchId, courses, branchOverrides, resolverItems)];
    }),
  );
}

export async function getBranchPricing(branchId: string): Promise<{ branch: BranchDoc; courses: ResolvedCourse[] }> {
  const branch = await getBranch(branchId);
  const resolved = await resolveFor([branch.id]);
  return { branch, courses: resolved.get(branch.id) ?? [] };
}

async function assertCourseExists(courseId: string): Promise<void> {
  if (!(await Course.exists({ _id: courseId }))) throw ApiError.notFound('Không tìm thấy gói học');
}

export async function setOverride(actor: Actor, scope: Scope, branchId: string, courseId: string, input: SetOverrideInput) {
  assertBranchAccess(scope, branchId);
  await getBranch(branchId);
  await assertCourseExists(courseId);
  const before = await PriceOverride.findOne({ branchId, courseId });
  const after = await PriceOverride.findOneAndUpdate(
    { branchId, courseId },
    { branchId, courseId, price: input.price, priceNote: input.priceNote ?? null },
    { upsert: true, returnDocument: 'after' },
  );
  await recordAudit({
    actorId: actor.id,
    action: 'price_override.set',
    entity: 'price_override',
    entityId: `${branchId}:${courseId}`,
    before: snapshot(before),
    after: snapshot(after),
  });
  return getBranchPricing(branchId);
}

export async function removeOverride(actor: Actor, scope: Scope, branchId: string, courseId: string): Promise<void> {
  assertBranchAccess(scope, branchId);
  const removed = await PriceOverride.findOneAndDelete({ branchId, courseId });
  if (!removed) throw ApiError.notFound('Chi nhánh này chưa có giá riêng cho gói học');
  await recordAudit({
    actorId: actor.id,
    action: 'price_override.delete',
    entity: 'price_override',
    entityId: `${branchId}:${courseId}`,
    before: snapshot(removed),
  });
}

function assertItemScope(scope: Scope, branchId: string | null): void {
  if (branchId === null) {
    if (!scope?.all) throw ApiError.forbidden('Chỉ quản trị viên cấp cao được sửa mục áp dụng cho mọi chi nhánh');
    return;
  }
  assertBranchAccess(scope, branchId);
}

function assertItemValues(values: { amount?: number | null; amountMax?: number | null; hidden?: boolean; branchId: string | null }): void {
  if (values.amount != null && values.amountMax != null && values.amountMax < values.amount) {
    throw ApiError.badRequest('Giá tối đa phải lớn hơn hoặc bằng giá tối thiểu', [{ path: 'body.amountMax', message: 'Không hợp lệ' }]);
  }
  if (values.hidden && values.branchId === null) {
    throw ApiError.badRequest('Chỉ mục riêng của chi nhánh mới dùng để ẩn mục chung', [{ path: 'body.hidden', message: 'Không hợp lệ' }]);
  }
}

export async function listPriceItems(query: ListPriceItemsQuery) {
  const filter: FilterQuery<IPriceItem> = {};
  if (query.kind) filter.kind = query.kind;
  if (query.branchId) filter.branchId = query.branchId === 'global' ? null : query.branchId;
  if (query.courseId) filter.courseId = query.courseId;
  return paginate(PriceItem, filter, query, 'order');
}

export async function createPriceItem(actor: Actor, scope: Scope, input: CreatePriceItemInput): Promise<PriceItemDoc> {
  const branchId = input.branchId ?? null;
  const courseId = input.courseId ?? null;
  assertItemScope(scope, branchId);
  assertItemValues({ ...input, branchId });
  if (branchId) await getBranch(branchId);
  if (courseId) await assertCourseExists(courseId);
  const item = await PriceItem.create({ ...input, branchId, courseId });
  await recordAudit({ actorId: actor.id, action: 'price_item.create', entity: 'price_item', entityId: item.id, after: snapshot(item) });
  return item;
}

async function getPriceItem(id: string): Promise<PriceItemDoc> {
  const item = await PriceItem.findById(id);
  if (!item) throw ApiError.notFound('Không tìm thấy mục giá');
  return item;
}

export async function updatePriceItem(actor: Actor, scope: Scope, id: string, input: UpdatePriceItemInput): Promise<PriceItemDoc> {
  const item = await getPriceItem(id);
  const branchId = idOf(item.branchId);
  assertItemScope(scope, branchId);
  assertItemValues({
    amount: input.amount !== undefined ? input.amount : item.amount,
    amountMax: input.amountMax !== undefined ? input.amountMax : item.amountMax,
    hidden: input.hidden ?? item.hidden,
    branchId,
  });
  const before = snapshot(item);
  item.set(input);
  await item.save();
  await recordAudit({ actorId: actor.id, action: 'price_item.update', entity: 'price_item', entityId: id, before, after: snapshot(item) });
  return item;
}

export async function removePriceItem(actor: Actor, scope: Scope, id: string): Promise<void> {
  const item = await getPriceItem(id);
  assertItemScope(scope, idOf(item.branchId));
  await item.deleteOne();
  await recordAudit({ actorId: actor.id, action: 'price_item.delete', entity: 'price_item', entityId: id, before: snapshot(item) });
}

function publicBranch(branch: BranchDoc) {
  return { name: branch.name, slug: branch.slug, officeName: branch.officeName, address: branch.address };
}

function publicCourses(courses: ResolvedCourse[]) {
  return courses.map(({ id: _id, defaultPrice: _defaultPrice, priceSource: _priceSource, fees, discounts, ...course }) => ({
    ...course,
    fees: fees.map(({ id: _itemId, source: _source, ...fee }) => fee),
    discounts: discounts.map(({ id: _itemId, source: _source, ...discount }) => discount),
  }));
}

export async function getPublicPricing(branchSlug?: string) {
  const branches = branchSlug
    ? await Branch.find({ slug: branchSlug, status: 'active' })
    : await Branch.find({ status: 'active' }).sort('order name');
  if (branchSlug && branches.length === 0) throw ApiError.notFound('Không tìm thấy chi nhánh');
  const resolved = await resolveFor(branches.map((branch) => branch.id));
  const entries = branches.map((branch) => ({
    branch: publicBranch(branch),
    courses: publicCourses(resolved.get(branch.id) ?? []),
  }));
  return branchSlug ? entries[0] : entries;
}
```

`src/modules/pricing/pricing.controller.ts`:
```ts
import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendData, sendList } from '../../utils/response';
import * as service from './pricing.service';
import type {
  CreatePriceItemInput,
  ListPriceItemsQuery,
  SetOverrideInput,
  UpdatePriceItemInput,
} from './pricing.validation';

type BranchParams = { branchId: string };
type BranchCourseParams = { branchId: string; courseId: string };
type IdParams = { id: string };

export async function getBranch(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getBranchPricing(validated<BranchParams>(req, 'params').branchId));
}

export async function setOverride(req: Request, res: Response): Promise<void> {
  const { branchId, courseId } = validated<BranchCourseParams>(req, 'params');
  sendData(res, await service.setOverride(req.user!, req.scope, branchId, courseId, validated<SetOverrideInput>(req, 'body')));
}

export async function removeOverride(req: Request, res: Response): Promise<void> {
  const { branchId, courseId } = validated<BranchCourseParams>(req, 'params');
  await service.removeOverride(req.user!, req.scope, branchId, courseId);
  res.status(204).end();
}

export async function listItems(req: Request, res: Response): Promise<void> {
  sendList(res, await service.listPriceItems(validated<ListPriceItemsQuery>(req, 'query')));
}

export async function createItem(req: Request, res: Response): Promise<void> {
  sendData(res, await service.createPriceItem(req.user!, req.scope, validated<CreatePriceItemInput>(req, 'body')), 201);
}

export async function updateItem(req: Request, res: Response): Promise<void> {
  const { id } = validated<IdParams>(req, 'params');
  sendData(res, await service.updatePriceItem(req.user!, req.scope, id, validated<UpdatePriceItemInput>(req, 'body')));
}

export async function removeItem(req: Request, res: Response): Promise<void> {
  await service.removePriceItem(req.user!, req.scope, validated<IdParams>(req, 'params').id);
  res.status(204).end();
}

export async function getPublic(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getPublicPricing(validated<{ branch?: string }>(req, 'query').branch));
}
```

`src/modules/pricing/pricing.routes.ts`:
```ts
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../shared/zod';
import * as controller from './pricing.controller';
import {
  branchCourseParamsSchema,
  branchParamsSchema,
  createPriceItemSchema,
  listPriceItemsQuerySchema,
  setOverrideSchema,
  updatePriceItemSchema,
} from './pricing.validation';

export function createPricingRouter(): Router {
  const router = Router();
  const manage = authorize('pricing.manage', { branchScoped: true });
  router.use(authenticate);
  router.get('/branches/:branchId', authorize('course.read'), validate({ params: branchParamsSchema }), controller.getBranch);
  router.put(
    '/branches/:branchId/courses/:courseId',
    manage,
    validate({ params: branchCourseParamsSchema, body: setOverrideSchema }),
    controller.setOverride,
  );
  router.delete(
    '/branches/:branchId/courses/:courseId',
    manage,
    validate({ params: branchCourseParamsSchema }),
    controller.removeOverride,
  );
  router.get('/items', authorize('course.read'), validate({ query: listPriceItemsQuerySchema }), controller.listItems);
  router.post('/items', manage, validate({ body: createPriceItemSchema }), controller.createItem);
  router.patch('/items/:id', manage, validate({ params: idParamsSchema, body: updatePriceItemSchema }), controller.updateItem);
  router.delete('/items/:id', manage, validate({ params: idParamsSchema }), controller.removeItem);
  return router;
}
```

Trong `src/routes/index.ts`: thêm `router.use('/pricing', createPricingRouter());`.
Trong `src/modules/public/public.routes.ts`: thêm
```ts
import { validate } from '../../middlewares/validate.middleware';
import * as pricing from '../pricing/pricing.controller';
import { publicPricingQuerySchema } from '../pricing/pricing.validation';
// ...
router.get('/pricing', validate({ query: publicPricingQuerySchema }), pricing.getPublic);
```

- [ ] **Step 4: Chạy test**

Run: `npx vitest run tests/integration/pricing.test.ts tests/unit/pricing-resolve.test.ts`
Expected: PASS

- [ ] **Step 5: Kiểm tra toàn bộ**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: tất cả pass.

---

### Task 5: Chuyên mục (categories) — admin

**Files:**
- Create: `src/modules/categories/category.model.ts`, `categories.validation.ts`, `categories.service.ts`, `categories.controller.ts`, `categories.routes.ts`
- Modify: `src/routes/index.ts` (mount `/categories`), `tests/helpers/factories.ts` (thêm `createCategory`)
- Test: `tests/integration/categories.test.ts`

**Interfaces:**
- Produces: `Category` model (`name`, `slug` unique, `description?`, `isAnnouncement`, `order`; không xóa mềm), `ICategory`, `CategoryDoc`, `listCategories()` (không phân trang, sắp `order name`), `getCategory(id)`, `createCategory(actor, input)`, `updateCategory(actor, id, input)`, `removeCategory(actor, id)` (Task 6 thêm chặn khi còn bài), `reorderCategories(actor, ids)`, `createCategoriesRouter()`; helper `createCategory(overrides?: Partial<{ name; slug; isAnnouncement; order }>) → Promise<CategoryDoc>`.

- [ ] **Step 1: Thêm factory và viết test (failing)**

Thêm vào `tests/helpers/factories.ts`:
```ts
import { Category, type CategoryDoc } from '../../src/modules/categories/category.model';

let categorySeq = 0;

export async function createCategory(
  overrides: Partial<{ name: string; slug: string; isAnnouncement: boolean; order: number }> = {},
): Promise<CategoryDoc> {
  categorySeq += 1;
  return Category.create({
    name: overrides.name ?? `Chuyên mục ${categorySeq}`,
    slug: overrides.slug ?? `chuyen-muc-${categorySeq}`,
    isAnnouncement: overrides.isAnnouncement ?? false,
    order: overrides.order ?? categorySeq,
  });
}
```

`tests/integration/categories.test.ts`:
```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { Category } from '../../src/modules/categories/category.model';
import { authHeader, createBranch, createCategory, createUser } from '../helpers/factories';

describe('admin /categories', () => {
  it('editor tạo chuyên mục, slug tự sinh, có audit', async () => {
    const { user: editor } = await createUser({ role: 'editor' });
    const res = await request(createApp())
      .post('/api/v1/categories')
      .set(authHeader(editor))
      .send({ name: 'Kinh nghiệm thi', description: 'Mẹo ôn lý thuyết' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ slug: 'kinh-nghiem-thi', isAnnouncement: false });
    expect(await AuditLog.countDocuments({ action: 'category.create' })).toBe(1);
  });

  it('409 khi trùng slug, consultant bị 403', async () => {
    const branch = await createBranch();
    const { user: editor } = await createUser({ role: 'editor' });
    const { user: consultant } = await createUser({ role: 'consultant', branchIds: [branch.id] });
    await Category.init();
    await createCategory({ slug: 'thong-bao' });
    const app = createApp();
    expect((await request(app).post('/api/v1/categories').set(authHeader(editor)).send({ name: 'Thông báo' })).status).toBe(409);
    expect((await request(app).get('/api/v1/categories').set(authHeader(consultant))).status).toBe(403);
  });

  it('danh sách sắp theo order; reorder; cập nhật; xóa chuyên mục trống → 204', async () => {
    const { user: editor } = await createUser({ role: 'editor' });
    const a = await createCategory({ name: 'A', order: 1 });
    const b = await createCategory({ name: 'B', order: 2 });
    const app = createApp();
    await request(app).patch('/api/v1/categories/reorder').set(authHeader(editor)).send({ ids: [b.id, a.id] });
    const list = await request(app).get('/api/v1/categories').set(authHeader(editor));
    expect(list.body.data.map((c: { name: string }) => c.name)).toEqual(['B', 'A']);
    const patch = await request(app).patch(`/api/v1/categories/${a.id}`).set(authHeader(editor)).send({ isAnnouncement: true });
    expect(patch.body.data.isAnnouncement).toBe(true);
    expect((await request(app).delete(`/api/v1/categories/${a.id}`).set(authHeader(editor))).status).toBe(204);
    expect((await request(app).get(`/api/v1/categories/${a.id}`).set(authHeader(editor))).status).toBe(404);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/integration/categories.test.ts`
Expected: FAIL — module không tồn tại.

- [ ] **Step 3: Viết code**

`src/modules/categories/category.model.ts`:
```ts
import { model, Schema, type HydratedDocument } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';

export interface ICategory {
  name: string;
  slug: string;
  description?: string;
  isAnnouncement: boolean;
  order: number;
}

export type CategoryDoc = HydratedDocument<ICategory>;

const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true },
    isAnnouncement: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  schemaOptions<ICategory>(),
);

export const Category = model<ICategory>('Category', categorySchema);
```

`src/modules/categories/categories.validation.ts`:
```ts
import { z } from 'zod';
import { objectIdSchema, slugSchema } from '../../shared/zod';

const fields = {
  name: z.string().trim().min(2).max(100),
  slug: slugSchema.optional(),
  description: z.string().trim().max(500).optional(),
  isAnnouncement: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
};

export const createCategorySchema = z.object(fields);
export const updateCategorySchema = z.object(fields).partial();
export const reorderCategoriesSchema = z.object({ ids: z.array(objectIdSchema).min(1).max(100) });

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
```

`src/modules/categories/categories.service.ts`:
```ts
import { ApiError } from '../../utils/ApiError';
import { slugify } from '../../utils/slugify';
import { recordAudit, snapshot } from '../audit/audit.service';
import { Category, type CategoryDoc } from './category.model';
import type { CreateCategoryInput, UpdateCategoryInput } from './categories.validation';

type Actor = Express.AuthUser;

export async function listCategories(): Promise<CategoryDoc[]> {
  return Category.find().sort('order name');
}

export async function getCategory(id: string): Promise<CategoryDoc> {
  const category = await Category.findById(id);
  if (!category) throw ApiError.notFound('Không tìm thấy chuyên mục');
  return category;
}

async function assertSlugFree(slug: string, exceptId?: string): Promise<void> {
  if (!slug) throw ApiError.badRequest('Không tạo được slug từ tên, hãy nhập slug', [{ path: 'body.slug', message: 'Bắt buộc' }]);
  const taken = await Category.exists({ slug, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
  if (taken) throw ApiError.conflict('Slug chuyên mục đã tồn tại', [{ path: 'body.slug', message: 'Đã tồn tại' }]);
}

export async function createCategory(actor: Actor, input: CreateCategoryInput): Promise<CategoryDoc> {
  const slug = input.slug ?? slugify(input.name);
  await assertSlugFree(slug);
  const category = await Category.create({ ...input, slug });
  await recordAudit({ actorId: actor.id, action: 'category.create', entity: 'category', entityId: category.id, after: snapshot(category) });
  return category;
}

export async function updateCategory(actor: Actor, id: string, input: UpdateCategoryInput): Promise<CategoryDoc> {
  const category = await getCategory(id);
  if (input.slug && input.slug !== category.slug) await assertSlugFree(input.slug, id);
  const before = snapshot(category);
  category.set(input);
  await category.save();
  await recordAudit({ actorId: actor.id, action: 'category.update', entity: 'category', entityId: id, before, after: snapshot(category) });
  return category;
}

export async function removeCategory(actor: Actor, id: string): Promise<void> {
  const category = await getCategory(id);
  const before = snapshot(category);
  await category.deleteOne();
  await recordAudit({ actorId: actor.id, action: 'category.delete', entity: 'category', entityId: id, before });
}

export async function reorderCategories(actor: Actor, ids: string[]): Promise<void> {
  const unique = [...new Set(ids)];
  if ((await Category.countDocuments({ _id: { $in: unique } })) !== unique.length) {
    throw ApiError.badRequest('Có chuyên mục không tồn tại', [{ path: 'body.ids', message: 'Không tồn tại' }]);
  }
  await Category.bulkWrite(unique.map((id, index) => ({ updateOne: { filter: { _id: id }, update: { order: index } } })));
  await recordAudit({ actorId: actor.id, action: 'category.reorder', entity: 'category', entityId: 'all', after: unique });
}
```

`src/modules/categories/categories.controller.ts`:
```ts
import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendData } from '../../utils/response';
import * as service from './categories.service';
import type { CreateCategoryInput, UpdateCategoryInput } from './categories.validation';

type IdParams = { id: string };

export async function list(_req: Request, res: Response): Promise<void> {
  sendData(res, await service.listCategories());
}

export async function get(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getCategory(validated<IdParams>(req, 'params').id));
}

export async function create(req: Request, res: Response): Promise<void> {
  sendData(res, await service.createCategory(req.user!, validated<CreateCategoryInput>(req, 'body')), 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = validated<IdParams>(req, 'params');
  sendData(res, await service.updateCategory(req.user!, id, validated<UpdateCategoryInput>(req, 'body')));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.removeCategory(req.user!, validated<IdParams>(req, 'params').id);
  res.status(204).end();
}

export async function reorder(req: Request, res: Response): Promise<void> {
  await service.reorderCategories(req.user!, validated<{ ids: string[] }>(req, 'body').ids);
  sendData(res, { ok: true });
}
```

`src/modules/categories/categories.routes.ts`:
```ts
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../shared/zod';
import * as controller from './categories.controller';
import { createCategorySchema, reorderCategoriesSchema, updateCategorySchema } from './categories.validation';

export function createCategoriesRouter(): Router {
  const router = Router();
  router.use(authenticate, authorize('category.manage'));
  router.get('/', controller.list);
  router.post('/', validate({ body: createCategorySchema }), controller.create);
  router.patch('/reorder', validate({ body: reorderCategoriesSchema }), controller.reorder);
  router.get('/:id', validate({ params: idParamsSchema }), controller.get);
  router.patch('/:id', validate({ params: idParamsSchema, body: updateCategorySchema }), controller.update);
  router.delete('/:id', validate({ params: idParamsSchema }), controller.remove);
  return router;
}
```

Trong `src/routes/index.ts`: thêm `router.use('/categories', createCategoriesRouter());`.

- [ ] **Step 4: Chạy test**

Run: `npx vitest run tests/integration/categories.test.ts`
Expected: PASS

- [ ] **Step 5: Kiểm tra toàn bộ**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: tất cả pass.

---

### Task 6: Bài viết (posts) — admin: CRUD, trạng thái, nhân bản

**Files:**
- Create: `src/modules/posts/post.model.ts`, `posts.validation.ts`, `posts.service.ts`, `posts.controller.ts`, `posts.routes.ts`
- Modify: `src/modules/categories/categories.service.ts` (chặn xóa khi còn bài), `src/routes/index.ts` (mount `/posts`)
- Test: `tests/integration/posts.test.ts`

**Interfaces:**
- Consumes: `plateContentSchema`, `plateToText`, `readTimeMinutes` (Task 1), `Category` (Task 5), `imageInputSchema`, `slugSchema`, `zDateTime`, `User`.
- Produces:
  - `Post` model, `IPost`, `PostDoc`, `POST_STATUSES = ['draft','pending','published','archived']`.
  - `listPosts(query)`, `getPost(id)`, `createPost(actor, input)`, `updatePost(actor, id, input)`, `transitionPost(actor, id, action: 'submit'|'publish'|'unpublish'|'archive', input?: { publishedAt?: Date })`, `duplicatePost(actor, id)`, `removePost(actor, id)`, `createPostsRouter()`.

- [ ] **Step 1: Viết test (failing)** — `tests/integration/posts.test.ts`

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { Post } from '../../src/modules/posts/post.model';
import { authHeader, createBranch, createCategory, createUser } from '../helpers/factories';

const content = [
  { type: 'h2', children: [{ text: 'Giấy tờ cần mang' }] },
  { type: 'p', children: [{ text: 'Mang đủ CCCD bản gốc và biên lai đăng ký.' }] },
];

async function setup() {
  const category = await createCategory({ name: 'Kinh nghiệm thi', slug: 'kinh-nghiem-thi' });
  const { user: editor } = await createUser({ role: 'editor', name: 'Mỹ Duyên' });
  return { app: createApp(), category, editor };
}

const newPost = (categoryId: string, extra: Record<string, unknown> = {}) => ({
  title: '5 lưu ý trước ngày thi sát hạch A1',
  content,
  categoryId,
  tags: ['a1', 'sat-hach', 'a1'],
  cover: { url: '/media/a.jpg', alt: 'Sân tập' },
  ...extra,
});

describe('tạo / sửa bài viết', () => {
  it('tạo bản nháp: slug, contentText, readTime, excerpt, authorName tự sinh; tag bỏ trùng; có audit', async () => {
    const { app, category, editor } = await setup();
    const res = await request(app).post('/api/v1/posts').set(authHeader(editor)).send(newPost(category.id));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      slug: '5-luu-y-truoc-ngay-thi-sat-hach-a1',
      status: 'draft',
      contentText: 'Giấy tờ cần mang\nMang đủ CCCD bản gốc và biên lai đăng ký.',
      readTimeMinutes: 1,
      authorName: 'Mỹ Duyên',
      tags: ['a1', 'sat-hach'],
      publishedAt: null,
      views: 0,
    });
    expect(res.body.data.excerpt).toBe('Giấy tờ cần mang Mang đủ CCCD bản gốc và biên lai đăng ký.');
    expect(await AuditLog.countDocuments({ action: 'post.create' })).toBe(1);
  });

  it('trùng tiêu đề → slug -2; slug nhập tay bị trùng → 409', async () => {
    const { app, category, editor } = await setup();
    await request(app).post('/api/v1/posts').set(authHeader(editor)).send(newPost(category.id));
    const second = await request(app).post('/api/v1/posts').set(authHeader(editor)).send(newPost(category.id));
    expect(second.body.data.slug).toBe('5-luu-y-truoc-ngay-thi-sat-hach-a1-2');
    const manual = await request(app)
      .post('/api/v1/posts')
      .set(authHeader(editor))
      .send(newPost(category.id, { slug: '5-luu-y-truoc-ngay-thi-sat-hach-a1' }));
    expect(manual.status).toBe(409);
  });

  it('400: chuyên mục không tồn tại, nội dung có link javascript:', async () => {
    const { app, category, editor } = await setup();
    const badCategory = await request(app)
      .post('/api/v1/posts')
      .set(authHeader(editor))
      .send(newPost('0123456789abcdef01234567'));
    expect(badCategory.status).toBe(400);
    const xss = await request(app)
      .post('/api/v1/posts')
      .set(authHeader(editor))
      .send(newPost(category.id, { content: [{ type: 'a', url: 'javascript:alert(1)', children: [{ text: 'x' }] }] }));
    expect(xss.status).toBe(400);
    expect(xss.body.error.details[0].path).toBe('body.content.0.url');
  });

  it('sửa nội dung tính lại contentText/readTime; consultant bị 403', async () => {
    const { app, category, editor } = await setup();
    const branch = await createBranch();
    const { user: consultant } = await createUser({ role: 'consultant', branchIds: [branch.id] });
    const created = await request(app).post('/api/v1/posts').set(authHeader(editor)).send(newPost(category.id));
    const longText = Array.from({ length: 450 }, () => 'chữ').join(' ');
    const patch = await request(app)
      .patch(`/api/v1/posts/${created.body.data.id}`)
      .set(authHeader(editor))
      .send({ content: [{ type: 'p', children: [{ text: longText }] }] });
    expect(patch.body.data.readTimeMinutes).toBe(3);
    expect((await request(app).get('/api/v1/posts').set(authHeader(consultant))).status).toBe(403);
  });
});

describe('trạng thái bài viết', () => {
  it('draft → submit → publish (publishedAt mặc định là bây giờ) → unpublish → archive', async () => {
    const { app, category, editor } = await setup();
    const { body } = await request(app).post('/api/v1/posts').set(authHeader(editor)).send(newPost(category.id));
    const base = `/api/v1/posts/${body.data.id}`;
    expect((await request(app).post(`${base}/submit`).set(authHeader(editor))).body.data.status).toBe('pending');
    const published = await request(app).post(`${base}/publish`).set(authHeader(editor)).send({});
    expect(published.body.data.status).toBe('published');
    expect(published.body.data.publishedAt).toMatch(/\+07:00$/);
    expect((await request(app).post(`${base}/unpublish`).set(authHeader(editor))).body.data.status).toBe('draft');
    expect((await request(app).post(`${base}/archive`).set(authHeader(editor))).body.data.status).toBe('archived');
    expect(await AuditLog.countDocuments({ entity: 'post', action: { $in: ['post.submit', 'post.publish', 'post.unpublish', 'post.archive'] } })).toBe(4);
  });

  it('publish hẹn giờ nhận publishedAt giờ VN; chuyển trạng thái sai → 409', async () => {
    const { app, category, editor } = await setup();
    const { body } = await request(app).post('/api/v1/posts').set(authHeader(editor)).send(newPost(category.id));
    const base = `/api/v1/posts/${body.data.id}`;
    const scheduled = await request(app).post(`${base}/publish`).set(authHeader(editor)).send({ publishedAt: '2030-01-01T08:00' });
    expect(scheduled.body.data.publishedAt).toBe('2030-01-01T08:00:00+07:00');
    expect((await request(app).post(`${base}/submit`).set(authHeader(editor))).status).toBe(409);
    await request(app).post(`${base}/archive`).set(authHeader(editor));
    expect((await request(app).post(`${base}/publish`).set(authHeader(editor)).send({})).status).toBe(409);
  });

  it('nhân bản thành bản nháp mới, slug mới, lượt xem 0', async () => {
    const { app, category, editor } = await setup();
    const { body } = await request(app).post('/api/v1/posts').set(authHeader(editor)).send(newPost(category.id));
    await request(app).post(`/api/v1/posts/${body.data.id}/publish`).set(authHeader(editor)).send({});
    const copy = await request(app).post(`/api/v1/posts/${body.data.id}/duplicate`).set(authHeader(editor));
    expect(copy.status).toBe(201);
    expect(copy.body.data).toMatchObject({
      status: 'draft',
      publishedAt: null,
      views: 0,
      title: '5 lưu ý trước ngày thi sát hạch A1 (bản sao)',
      slug: '5-luu-y-truoc-ngay-thi-sat-hach-a1-2',
    });
  });
});

describe('danh sách / xóa', () => {
  it('danh sách không chứa content, lọc theo trạng thái và tag', async () => {
    const { app, category, editor } = await setup();
    const { body } = await request(app).post('/api/v1/posts').set(authHeader(editor)).send(newPost(category.id));
    await request(app).post('/api/v1/posts').set(authHeader(editor)).send(newPost(category.id, { title: 'Bài khác hẳn', tags: ['b'] }));
    await request(app).post(`/api/v1/posts/${body.data.id}/publish`).set(authHeader(editor)).send({});
    const list = await request(app).get('/api/v1/posts?status=published').set(authHeader(editor));
    expect(list.body.meta.total).toBe(1);
    expect(list.body.data[0]).not.toHaveProperty('content');
    expect((await request(app).get('/api/v1/posts?tag=b').set(authHeader(editor))).body.meta.total).toBe(1);
  });

  it('xóa mềm bài viết; chuyên mục còn bài (kể cả đã xóa mềm) → 409', async () => {
    const { app, category, editor } = await setup();
    const { body } = await request(app).post('/api/v1/posts').set(authHeader(editor)).send(newPost(category.id));
    expect((await request(app).delete(`/api/v1/posts/${body.data.id}`).set(authHeader(editor))).status).toBe(204);
    expect(await Post.countDocuments()).toBe(0);
    expect((await request(app).delete(`/api/v1/categories/${category.id}`).set(authHeader(editor))).status).toBe(409);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/integration/posts.test.ts`
Expected: FAIL — module không tồn tại.

- [ ] **Step 3: Viết code**

`src/modules/posts/post.model.ts`:
```ts
import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { imageSubSchema, type IImage } from '../../shared/mongoose/image';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';
import { softDeletePlugin } from '../../shared/mongoose/softDelete';

export const POST_STATUSES = ['draft', 'pending', 'published', 'archived'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export interface IPost {
  title: string;
  slug: string;
  excerpt: string;
  content: unknown[];
  contentText: string;
  readTimeMinutes: number;
  cover?: IImage | null;
  categoryId: Types.ObjectId;
  tags: string[];
  authorId?: Types.ObjectId | null;
  authorName: string;
  status: PostStatus;
  publishedAt?: Date | null;
  views: number;
  seo?: { title?: string; description?: string } | null;
  deletedAt?: Date | null;
}

export type PostDoc = HydratedDocument<IPost>;

const postSchema = new Schema<IPost>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    excerpt: { type: String, default: '', trim: true },
    content: { type: [Schema.Types.Mixed], required: true },
    contentText: { type: String, default: '' },
    readTimeMinutes: { type: Number, default: 1 },
    cover: { type: imageSubSchema, default: null },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    tags: { type: [String], default: [] },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    authorName: { type: String, required: true, trim: true },
    status: { type: String, enum: POST_STATUSES, default: 'draft' },
    publishedAt: { type: Date, default: null },
    views: { type: Number, default: 0 },
    seo: { type: new Schema({ title: String, description: String }, { _id: false }), default: null },
  },
  schemaOptions<IPost>(),
);

postSchema.plugin(softDeletePlugin);
postSchema.index({ status: 1, publishedAt: -1 });
postSchema.index({ categoryId: 1, status: 1, publishedAt: -1 });
postSchema.index({ tags: 1 });

export const Post = model<IPost>('Post', postSchema);
```

`src/modules/posts/posts.validation.ts`:
```ts
import { z } from 'zod';
import { listQuerySchema } from '../../shared/mongoose/paginate';
import { imageInputSchema, objectIdSchema, slugSchema, zDateTime } from '../../shared/zod';
import { plateContentSchema } from './plate';
import { POST_STATUSES } from './post.model';

const tagsSchema = z
  .array(z.string().trim().toLowerCase().min(1).max(30))
  .max(20)
  .transform((tags) => [...new Set(tags)]);

const fields = {
  title: z.string().trim().min(5).max(200),
  slug: slugSchema.optional(),
  excerpt: z.string().trim().max(500).optional(),
  content: plateContentSchema,
  categoryId: objectIdSchema,
  tags: tagsSchema.optional(),
  cover: imageInputSchema.nullable().optional(),
  authorName: z.string().trim().min(2).max(100).optional(),
  seo: z
    .object({ title: z.string().trim().max(70).optional(), description: z.string().trim().max(160).optional() })
    .nullable()
    .optional(),
};

export const createPostSchema = z.object(fields);
export const updatePostSchema = z.object(fields).partial();
export const publishPostSchema = z.object({ publishedAt: zDateTime.optional() });
export const listPostsQuerySchema = listQuerySchema.extend({
  status: z.enum(POST_STATUSES).optional(),
  categoryId: objectIdSchema.optional(),
  tag: z.string().trim().toLowerCase().max(30).optional(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type PublishPostInput = z.infer<typeof publishPostSchema>;
export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>;
```

`src/modules/posts/posts.service.ts`:
```ts
import type { FilterQuery } from 'mongoose';
import { paginate } from '../../shared/mongoose/paginate';
import { WITH_DELETED } from '../../shared/mongoose/softDelete';
import { ApiError } from '../../utils/ApiError';
import { escapeRegex } from '../../utils/regex';
import { slugify } from '../../utils/slugify';
import { recordAudit } from '../audit/audit.service';
import { Category } from '../categories/category.model';
import { User } from '../users/user.model';
import { plateToText, readTimeMinutes } from './plate';
import { Post, type IPost, type PostDoc, type PostStatus } from './post.model';
import type { CreatePostInput, ListPostsQuery, PublishPostInput, UpdatePostInput } from './posts.validation';

type Actor = Express.AuthUser;
export type PostAction = 'submit' | 'publish' | 'unpublish' | 'archive';

const TRANSITIONS: Record<PostAction, { from: PostStatus[]; to: PostStatus; label: string }> = {
  submit: { from: ['draft'], to: 'pending', label: 'gửi duyệt' },
  publish: { from: ['draft', 'pending'], to: 'published', label: 'xuất bản' },
  unpublish: { from: ['published'], to: 'draft', label: 'gỡ xuất bản' },
  archive: { from: ['draft', 'pending', 'published'], to: 'archived', label: 'lưu trữ' },
};

const EXCERPT_LENGTH = 200;

function summary(post: PostDoc) {
  return { title: post.title, slug: post.slug, status: post.status, publishedAt: post.publishedAt, categoryId: post.categoryId };
}

function deriveFromContent(content: unknown[]) {
  const contentText = plateToText(content);
  return { contentText, readTimeMinutes: readTimeMinutes(contentText) };
}

function excerptFrom(contentText: string): string {
  const flat = contentText.replace(/\s+/g, ' ').trim();
  return flat.length > EXCERPT_LENGTH ? `${flat.slice(0, EXCERPT_LENGTH).trimEnd()}…` : flat;
}

async function uniqueSlug(base: string): Promise<string> {
  const root = base || 'bai-viet';
  let slug = root;
  for (let n = 2; await Post.exists({ slug, ...WITH_DELETED }); n += 1) slug = `${root}-${n}`;
  return slug;
}

async function assertSlugFree(slug: string, exceptId?: string): Promise<void> {
  const taken = await Post.exists({ slug, ...WITH_DELETED, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
  if (taken) throw ApiError.conflict('Slug bài viết đã tồn tại', [{ path: 'body.slug', message: 'Đã tồn tại' }]);
}

async function assertCategory(categoryId: string): Promise<void> {
  if (!(await Category.exists({ _id: categoryId }))) {
    throw ApiError.badRequest('Chuyên mục không tồn tại', [{ path: 'body.categoryId', message: 'Không tồn tại' }]);
  }
}

export async function listPosts(query: ListPostsQuery) {
  const filter: FilterQuery<IPost> = {};
  if (query.status) filter.status = query.status;
  if (query.categoryId) filter.categoryId = query.categoryId;
  if (query.tag) filter.tags = query.tag;
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ title: pattern }, { excerpt: pattern }];
  }
  const result = await paginate(Post, filter, query, '-updatedAt');
  return { ...result, data: result.data.map((post) => { const json = post.toJSON() as Record<string, unknown>; delete json.content; delete json.contentText; return json; }) };
}

export async function getPost(id: string): Promise<PostDoc> {
  const post = await Post.findById(id);
  if (!post) throw ApiError.notFound('Không tìm thấy bài viết');
  return post;
}

export async function createPost(actor: Actor, input: CreatePostInput): Promise<PostDoc> {
  await assertCategory(input.categoryId);
  if (input.slug) await assertSlugFree(input.slug);
  const slug = input.slug ?? (await uniqueSlug(slugify(input.title)));
  const derived = deriveFromContent(input.content);
  const authorName = input.authorName ?? (await User.findById(actor.id))?.name ?? 'Ban biên tập';
  const post = await Post.create({
    ...input,
    ...derived,
    slug,
    tags: input.tags ?? [],
    excerpt: input.excerpt ?? excerptFrom(derived.contentText),
    authorId: actor.id,
    authorName,
    status: 'draft',
    publishedAt: null,
  });
  await recordAudit({ actorId: actor.id, action: 'post.create', entity: 'post', entityId: post.id, after: summary(post) });
  return post;
}

export async function updatePost(actor: Actor, id: string, input: UpdatePostInput): Promise<PostDoc> {
  const post = await getPost(id);
  if (input.categoryId) await assertCategory(input.categoryId);
  if (input.slug && input.slug !== post.slug) await assertSlugFree(input.slug, id);
  const before = summary(post);
  post.set({ ...input, ...(input.content ? deriveFromContent(input.content) : {}) });
  await post.save();
  await recordAudit({ actorId: actor.id, action: 'post.update', entity: 'post', entityId: id, before, after: summary(post) });
  return post;
}

export async function transitionPost(actor: Actor, id: string, action: PostAction, input: PublishPostInput = {}): Promise<PostDoc> {
  const post = await getPost(id);
  const rule = TRANSITIONS[action];
  if (!rule.from.includes(post.status)) {
    throw ApiError.conflict(`Không thể ${rule.label} bài viết đang ở trạng thái "${post.status}"`);
  }
  const before = summary(post);
  post.status = rule.to;
  if (action === 'publish') post.publishedAt = input.publishedAt ?? post.publishedAt ?? new Date();
  await post.save();
  await recordAudit({ actorId: actor.id, action: `post.${action}`, entity: 'post', entityId: id, before, after: summary(post) });
  return post;
}

export async function duplicatePost(actor: Actor, id: string): Promise<PostDoc> {
  const source = await getPost(id);
  const copy = await Post.create({
    title: `${source.title} (bản sao)`,
    slug: await uniqueSlug(source.slug),
    excerpt: source.excerpt,
    content: source.content,
    contentText: source.contentText,
    readTimeMinutes: source.readTimeMinutes,
    cover: source.cover,
    categoryId: source.categoryId,
    tags: source.tags,
    seo: source.seo,
    authorId: actor.id,
    authorName: source.authorName,
    status: 'draft',
    publishedAt: null,
    views: 0,
  });
  await recordAudit({ actorId: actor.id, action: 'post.duplicate', entity: 'post', entityId: copy.id, after: { ...summary(copy), sourceId: id } });
  return copy;
}

export async function removePost(actor: Actor, id: string): Promise<void> {
  const post = await getPost(id);
  const before = summary(post);
  post.deletedAt = new Date();
  await post.save();
  await recordAudit({ actorId: actor.id, action: 'post.delete', entity: 'post', entityId: id, before });
}
```

Ghi chú cho người thực hiện: `listPosts` trả object JSON đã bỏ `content`/`contentText` — format lại bằng prettier cho dễ đọc (tách arrow function thành nhiều dòng), không đổi hành vi. `uniqueSlug(source.slug)` trong `duplicatePost` cho ra `<slug>-2` khi bài gốc là `<slug>`, đúng test.

`src/modules/posts/posts.controller.ts`:
```ts
import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendData, sendList } from '../../utils/response';
import * as service from './posts.service';
import type { CreatePostInput, ListPostsQuery, PublishPostInput, UpdatePostInput } from './posts.validation';

type IdParams = { id: string };

export async function list(req: Request, res: Response): Promise<void> {
  sendList(res, await service.listPosts(validated<ListPostsQuery>(req, 'query')));
}

export async function get(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getPost(validated<IdParams>(req, 'params').id));
}

export async function create(req: Request, res: Response): Promise<void> {
  sendData(res, await service.createPost(req.user!, validated<CreatePostInput>(req, 'body')), 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = validated<IdParams>(req, 'params');
  sendData(res, await service.updatePost(req.user!, id, validated<UpdatePostInput>(req, 'body')));
}

export function transition(action: service.PostAction) {
  return async (req: Request, res: Response): Promise<void> => {
    const { id } = validated<IdParams>(req, 'params');
    const input = action === 'publish' ? validated<PublishPostInput>(req, 'body') : {};
    sendData(res, await service.transitionPost(req.user!, id, action, input));
  };
}

export async function duplicate(req: Request, res: Response): Promise<void> {
  sendData(res, await service.duplicatePost(req.user!, validated<IdParams>(req, 'params').id), 201);
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.removePost(req.user!, validated<IdParams>(req, 'params').id);
  res.status(204).end();
}
```

`src/modules/posts/posts.routes.ts`:
```ts
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../shared/zod';
import * as controller from './posts.controller';
import { createPostSchema, listPostsQuerySchema, publishPostSchema, updatePostSchema } from './posts.validation';

export function createPostsRouter(): Router {
  const router = Router();
  const byId = validate({ params: idParamsSchema });
  router.use(authenticate, authorize('post.manage'));
  router.get('/', validate({ query: listPostsQuerySchema }), controller.list);
  router.post('/', validate({ body: createPostSchema }), controller.create);
  router.get('/:id', byId, controller.get);
  router.patch('/:id', validate({ params: idParamsSchema, body: updatePostSchema }), controller.update);
  router.delete('/:id', byId, controller.remove);
  router.post('/:id/submit', byId, controller.transition('submit'));
  router.post('/:id/publish', validate({ params: idParamsSchema, body: publishPostSchema }), controller.transition('publish'));
  router.post('/:id/unpublish', byId, controller.transition('unpublish'));
  router.post('/:id/archive', byId, controller.transition('archive'));
  router.post('/:id/duplicate', byId, controller.duplicate);
  return router;
}
```

Trong `src/routes/index.ts`: thêm `router.use('/posts', createPostsRouter());`.

Trong `src/modules/categories/categories.service.ts`, thêm import `import { WITH_DELETED } from '../../shared/mongoose/softDelete';` và `import { Post } from '../posts/post.model';`, rồi ở đầu `removeCategory` (sau `getCategory`):
```ts
  if (await Post.exists({ categoryId: id, ...WITH_DELETED })) {
    throw ApiError.conflict('Chuyên mục còn bài viết, hãy chuyển hoặc xóa hẳn bài trước');
  }
```

- [ ] **Step 4: Chạy test**

Run: `npx vitest run tests/integration/posts.test.ts tests/integration/categories.test.ts`
Expected: PASS

- [ ] **Step 5: Kiểm tra toàn bộ**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: tất cả pass.

---

### Task 7: API công khai — `/public/categories`, `/public/posts`, `/public/posts/:slug`

**Files:**
- Create: `src/modules/posts/posts.public.ts`
- Modify: `src/modules/public/public.routes.ts`
- Test: `tests/integration/public-content.test.ts`

**Interfaces:**
- Consumes: `Post`, `Category`, `paginate`.
- Produces:
  - `publicPostsQuerySchema` (`page` mặc định 1, `limit` mặc định 12 tối đa 50, `category?` slug, `q?`), `publicSlugParamsSchema`.
  - `listPublicCategories()` → `[{ name, slug, description, isAnnouncement, postCount }]` (đếm bài đang công khai).
  - `listPublicPosts(query)` → `{ data: PublicPostSummary[], meta }`; `PublicPostSummary = { slug, title, excerpt, cover, tags, authorName, publishedAt, readTimeMinutes, views, category: { name, slug, isAnnouncement } }`.
  - `getPublicPost(slug)` → summary + `content`; tăng `views` 1.
  - Controller handlers `listCategories`, `listPosts`, `getPost` (export từ `posts.public.ts`).

- [ ] **Step 1: Viết test (failing)** — `tests/integration/public-content.test.ts`

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { Post } from '../../src/modules/posts/post.model';
import { createCategory } from '../helpers/factories';

const content = [{ type: 'p', children: [{ text: 'Nội dung bài viết về sa hình.' }] }];
let seq = 0;

async function post(categoryId: string, overrides: Record<string, unknown> = {}) {
  seq += 1;
  return Post.create({
    title: `Bài ${seq}`,
    slug: `bai-${seq}`,
    excerpt: `Tóm tắt ${seq}`,
    content,
    contentText: 'Nội dung bài viết về sa hình.',
    readTimeMinutes: 1,
    categoryId,
    tags: [],
    authorName: 'Ban biên tập',
    status: 'published',
    publishedAt: new Date(Date.now() - seq * 60_000),
    ...overrides,
  });
}

describe('public content', () => {
  it('chỉ bài published có publishedAt ≤ hiện tại; mới nhất trước; không lộ content', async () => {
    const cat = await createCategory({ name: 'Kinh nghiệm thi', slug: 'kinh-nghiem-thi' });
    await post(cat.id, { slug: 'moi' });
    await post(cat.id, { slug: 'cu' });
    await post(cat.id, { slug: 'nhap', status: 'draft' });
    await post(cat.id, { slug: 'hen-gio', publishedAt: new Date(Date.now() + 86_400_000) });
    const res = await request(createApp()).get('/api/v1/public/posts');
    expect(res.status).toBe(200);
    expect(res.body.data.map((p: { slug: string }) => p.slug)).toEqual(['moi', 'cu']);
    expect(res.body.data[0]).not.toHaveProperty('content');
    expect(res.body.data[0].category).toEqual({ name: 'Kinh nghiệm thi', slug: 'kinh-nghiem-thi', isAnnouncement: false });
    expect(res.body.meta).toMatchObject({ page: 1, limit: 12, total: 2 });
  });

  it('lọc theo chuyên mục (slug lạ → rỗng) và tìm theo q', async () => {
    const a = await createCategory({ slug: 'a' });
    const b = await createCategory({ slug: 'b' });
    await post(a.id, { title: 'Mẹo vòng số 8' });
    await post(b.id, { title: 'Học phí hạng B' });
    const app = createApp();
    expect((await request(app).get('/api/v1/public/posts?category=b')).body.data).toHaveLength(1);
    expect((await request(app).get('/api/v1/public/posts?category=khong-co')).body.meta.total).toBe(0);
    expect((await request(app).get('/api/v1/public/posts?q=v%C3%B2ng%20s%E1%BB%91')).body.data[0].title).toBe('Mẹo vòng số 8');
  });

  it('chi tiết: trả content, tăng lượt xem; bài nháp/hẹn giờ/đã xóa → 404', async () => {
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
    expect((await Post.findOne({ slug: 'xem' }))?.views).toBe(2);
    for (const slug of ['nhap', 'tuong-lai', 'da-xoa', 'khong-co']) {
      expect((await request(app).get(`/api/v1/public/posts/${slug}`)).status).toBe(404);
    }
  });

  it('/public/categories trả số bài đang công khai theo thứ tự', async () => {
    const a = await createCategory({ name: 'A', slug: 'a', order: 2 });
    const b = await createCategory({ name: 'B', slug: 'b', order: 1, isAnnouncement: true });
    await post(a.id);
    await post(a.id);
    await post(a.id, { status: 'draft' });
    const res = await request(createApp()).get('/api/v1/public/categories');
    expect(res.body.data).toEqual([
      { name: 'B', slug: 'b', description: null, isAnnouncement: true, postCount: 0 },
      { name: 'A', slug: 'a', description: null, isAnnouncement: false, postCount: 2 },
    ]);
    expect(b.id).toBeTruthy();
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/integration/public-content.test.ts`
Expected: FAIL — route 404.

- [ ] **Step 3: Viết `src/modules/posts/posts.public.ts`**

```ts
import type { Request, Response } from 'express';
import type { FilterQuery } from 'mongoose';
import { z } from 'zod';
import { validated } from '../../middlewares/validate.middleware';
import { paginate } from '../../shared/mongoose/paginate';
import { slugSchema } from '../../shared/zod';
import { ApiError } from '../../utils/ApiError';
import { escapeRegex } from '../../utils/regex';
import { sendData, sendList } from '../../utils/response';
import { Category, type CategoryDoc } from '../categories/category.model';
import { Post, type IPost, type PostDoc } from './post.model';

export const publicPostsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  category: slugSchema.optional(),
  q: z.string().trim().min(1).max(100).optional(),
});
export const publicSlugParamsSchema = z.object({ slug: slugSchema });

type PublicPostsQuery = z.infer<typeof publicPostsQuerySchema>;

function visibleFilter(): FilterQuery<IPost> {
  return { status: 'published', publishedAt: { $lte: new Date() } };
}

function publicCategory(category: CategoryDoc | undefined) {
  return category
    ? { name: category.name, slug: category.slug, isAnnouncement: category.isAnnouncement }
    : null;
}

function summarize(post: PostDoc, categories: Map<string, CategoryDoc>) {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    cover: post.cover ? { url: post.cover.url, alt: post.cover.alt } : null,
    tags: post.tags,
    authorName: post.authorName,
    publishedAt: post.publishedAt,
    readTimeMinutes: post.readTimeMinutes,
    views: post.views,
    category: publicCategory(categories.get(post.categoryId.toString())),
  };
}

async function categoryMap(): Promise<Map<string, CategoryDoc>> {
  const categories = await Category.find();
  return new Map(categories.map((category) => [category.id, category]));
}

export async function listPublicCategories() {
  const [categories, counts] = await Promise.all([
    Category.find().sort('order name'),
    Post.aggregate<{ _id: unknown; count: number }>([
      { $match: visibleFilter() },
      { $group: { _id: '$categoryId', count: { $sum: 1 } } },
    ]),
  ]);
  const countById = new Map(counts.map((row) => [String(row._id), row.count]));
  return categories.map((category) => ({
    name: category.name,
    slug: category.slug,
    description: category.description ?? null,
    isAnnouncement: category.isAnnouncement,
    postCount: countById.get(category.id) ?? 0,
  }));
}

export async function listPublicPosts(query: PublicPostsQuery) {
  const filter: FilterQuery<IPost> = visibleFilter();
  const categories = await categoryMap();
  if (query.category) {
    const category = [...categories.values()].find((item) => item.slug === query.category);
    if (!category) return { data: [], meta: { page: query.page, limit: query.limit, total: 0 } };
    filter.categoryId = category._id;
  }
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ title: pattern }, { excerpt: pattern }, { contentText: pattern }];
  }
  const result = await paginate(Post, filter, { page: query.page, limit: query.limit, sort: '-publishedAt' });
  return { data: result.data.map((post) => summarize(post, categories)), meta: result.meta };
}

export async function getPublicPost(slug: string) {
  const post = await Post.findOne({ ...visibleFilter(), slug });
  if (!post) throw ApiError.notFound('Không tìm thấy bài viết');
  await Post.updateOne({ _id: post._id }, { $inc: { views: 1 } });
  const categories = await categoryMap();
  return { ...summarize(post, categories), views: post.views + 1, content: post.content };
}

export async function listCategories(_req: Request, res: Response): Promise<void> {
  sendData(res, await listPublicCategories());
}

export async function listPosts(req: Request, res: Response): Promise<void> {
  sendList(res, await listPublicPosts(validated<PublicPostsQuery>(req, 'query')));
}

export async function getPost(req: Request, res: Response): Promise<void> {
  sendData(res, await getPublicPost(validated<{ slug: string }>(req, 'params').slug));
}
```

Trong `src/modules/public/public.routes.ts` thêm:
```ts
import * as publicPosts from '../posts/posts.public';
// ...
router.get('/categories', publicPosts.listCategories);
router.get('/posts', validate({ query: publicPostsQuerySchema }), publicPosts.listPosts);
router.get('/posts/:slug', validate({ params: publicSlugParamsSchema }), publicPosts.getPost);
```
(import `publicPostsQuerySchema`, `publicSlugParamsSchema` từ `../posts/posts.public`.)

Ghi chú: `paginate` thêm `_id` tiebreaker sau `-publishedAt`; slug sai định dạng (vd chữ hoa) trả 400 theo `publicSlugParamsSchema`.

- [ ] **Step 4: Chạy test**

Run: `npx vitest run tests/integration/public-content.test.ts`
Expected: PASS

- [ ] **Step 5: Kiểm tra toàn bộ**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: tất cả pass.

---

### Task 8: Seed gói học, bảng giá, chuyên mục, bài viết + Swagger + README

**Files:**
- Create: `src/scripts/seed-catalog-data.ts`, `src/scripts/seed-posts-data.ts`, `src/scripts/seed-catalog.ts`
- Modify: `src/scripts/seed.ts` (gọi `seedCatalog()` sau khi seed chi nhánh), `src/docs/openapi.ts`, `tests/integration/docs.test.ts`, `README.md`
- Test: `tests/integration/seed-catalog.test.ts`

**Interfaces:**
- Consumes: mọi model đợt 2, `Branch`, `paragraphsToPlate`, `plateToText`, `readTimeMinutes`, `parseDateTime`, `WITH_DELETED`.
- Produces: `seedCatalog(): Promise<void>` (idempotent, chỉ `$setOnInsert`, không ghi đè dữ liệu admin đã sửa).

- [ ] **Step 1: Dữ liệu gói học, giá, chuyên mục** — `src/scripts/seed-catalog-data.ts`

Lấy từ `front-end/app/page.tsx` (mảng `courses`) và `front-end/lib/news.ts` (`newsCategories`):
```ts
import type { VehicleType } from '../modules/courses/course.model';
import type { PriceItemKind } from '../modules/pricing/price-item.model';

export type SeedCourse = {
  code: string;
  name: string;
  vehicleType: VehicleType;
  description: string;
  duration: string;
  defaultPrice: number;
  priceNote: string;
  image: { url: string; alt: string };
  order: number;
};

export const seedCourses: SeedCourse[] = [
  {
    code: 'A1',
    name: 'Hạng A1',
    vehicleType: 'moto',
    description: 'Hạng A1 chạy xe đến 125cc (thi xe Wave).',
    duration: 'Lý thuyết 2 ngày',
    defaultPrice: 620_000,
    priceNote: 'Đã gồm hồ sơ, lý thuyết 2 ngày tập trung, lệ phí thi và cấp bằng',
    image: { url: '/vehicles/wave.png', alt: 'Xe Wave thi sát hạch hạng A1' },
    order: 1,
  },
  {
    code: 'A',
    name: 'Hạng A',
    vehicleType: 'moto',
    description: 'Hạng A chạy được xe A1 và xe trên 125cc (thi Vespa tay ga hoặc CB250 tay côn).',
    duration: 'Lý thuyết 2 ngày',
    defaultPrice: 1_750_000,
    priceNote: 'Đã gồm hồ sơ, lý thuyết 2 ngày tập trung, lệ phí thi và cấp bằng',
    image: { url: '/vehicles/scooter-a.png', alt: 'Xe tay ga thi sát hạch hạng A' },
    order: 2,
  },
  {
    code: 'B',
    name: 'Hạng B (sàn & tự động)',
    vehicleType: 'car',
    description: 'Giáo viên kèm từ đầu đến lúc lấy bằng. Hỗ trợ đóng theo đợt, HSSV giảm thêm 1.000.000đ.',
    duration: '3–4 tuần',
    defaultPrice: 16_500_000,
    priceNote: 'Đã gồm xăng DAT, xe giờ đêm/xe tự động, giáo viên đến lúc thi',
    image: { url: '/vehicles/car-b.png', alt: 'Xe tập lái hạng B' },
    order: 3,
  },
  {
    code: 'C1',
    name: 'Hạng C1',
    vehicleType: 'truck',
    description: 'Giáo viên kèm đến lúc lấy bằng. Hỗ trợ đóng theo đợt, HSSV giảm thêm 1.000.000đ.',
    duration: '4–5 tuần',
    defaultPrice: 18_900_000,
    priceNote: 'Đã gồm xăng dầu DAT, xe giờ đêm/xe tự động, giáo viên đến lúc thi',
    image: { url: '/vehicles/truck-c1.png', alt: 'Xe tập lái hạng C1' },
    order: 4,
  },
];

export const seedOverrides = [
  { branchSlug: 'vung-liem', courseCode: 'A1', price: 790_000 },
  { branchSlug: 'vung-liem', courseCode: 'A', price: 1_595_000 },
];

export type SeedPriceItem = {
  kind: PriceItemKind;
  key: string;
  courseCode: string | null;
  branchSlug: string | null;
  label: string;
  amount?: number;
  amountMax?: number;
  unit?: string;
  note?: string;
  hidden?: boolean;
  order: number;
};

const carFees = (courseCode: 'B' | 'C1', sensorMin: number): SeedPriceItem[] => [
  { kind: 'fee', key: 'kham-suc-khoe', courseCode, branchSlug: null, label: 'Khám sức khỏe', note: 'Tự khám hoặc tại trung tâm', order: 1 },
  { kind: 'fee', key: 'cabin-mo-phong', courseCode, branchSlug: null, label: 'Cabin mô phỏng', amount: 500_000, note: '2 giờ', order: 2 },
  { kind: 'fee', key: 'le-phi-thi', courseCode, branchSlug: null, label: 'Lệ phí thi', amount: 1_500_000, order: 3 },
  { kind: 'fee', key: 'thue-xe-cam-bien', courseCode, branchSlug: null, label: 'Thuê xe cảm biến', amount: sensorMin, amountMax: 600_000, unit: 'giờ', order: 4 },
  { kind: 'discount', key: 'hssv', courseCode, branchSlug: null, label: 'HSSV giảm thêm', amount: 1_000_000, order: 1 },
  { kind: 'discount', key: 'dong-theo-dot', courseCode, branchSlug: null, label: 'Hỗ trợ đóng theo đợt', order: 2 },
];

export const seedPriceItems: SeedPriceItem[] = [
  // Xe máy — mặc định (khu vực Vĩnh Long)
  { kind: 'fee', key: 'cam-bien-a', courseCode: 'A', branchSlug: null, label: 'Xe cảm biến A', amount: 70_000, unit: 'vòng', order: 1 },
  { kind: 'fee', key: 'cam-bien-a1', courseCode: 'A1', branchSlug: null, label: 'Xe cảm biến A1', amount: 20_000, unit: 'vòng', order: 1 },
  { kind: 'fee', key: 'thi-thu-may-tinh', courseCode: 'A', branchSlug: null, label: 'Thi thử máy tính', amount: 10_000, unit: 'lượt', order: 3 },
  { kind: 'fee', key: 'thi-thu-may-tinh', courseCode: 'A1', branchSlug: null, label: 'Thi thử máy tính', amount: 10_000, unit: 'lượt', order: 3 },
  { kind: 'discount', key: 'co-bang-o-to', courseCode: 'A', branchSlug: null, label: 'Có bằng ô tô: miễn lý thuyết', amount: 60_000, order: 1 },
  { kind: 'discount', key: 'co-bang-o-to', courseCode: 'A1', branchSlug: null, label: 'Có bằng ô tô: miễn lý thuyết', amount: 60_000, order: 1 },
  { kind: 'discount', key: 'hssv', courseCode: 'A', branchSlug: null, label: 'HSSV học hạng A (mang thẻ khi đăng ký)', amount: 500_000, order: 2 },
  // Xe máy — Vũng Liêm
  { kind: 'fee', key: 'cam-bien-a', courseCode: 'A', branchSlug: 'vung-liem', label: 'Cảm biến A tay ga Vespa', amount: 50_000, unit: 'vòng', order: 1 },
  { kind: 'fee', key: 'cam-bien-a-tay-con', courseCode: 'A', branchSlug: 'vung-liem', label: 'Cảm biến A tay côn', amount: 40_000, unit: 'vòng', order: 2 },
  { kind: 'fee', key: 'thi-thu-may-tinh', courseCode: 'A', branchSlug: 'vung-liem', label: 'Thi thử máy tính', hidden: true, order: 3 },
  { kind: 'fee', key: 'thi-thu-may-tinh', courseCode: 'A1', branchSlug: 'vung-liem', label: 'Thi thử máy tính', hidden: true, order: 3 },
  { kind: 'discount', key: 'hssv', courseCode: 'A', branchSlug: 'vung-liem', label: 'HSSV học hạng A', hidden: true, order: 2 },
  // Ô tô
  ...carFees('B', 300_000),
  ...carFees('C1', 350_000),
];

export const seedCategories = [
  { slug: 'kinh-nghiem-thi', name: 'Kinh nghiệm thi', description: 'Mẹo ôn lý thuyết, chạy sa hình và giữ bình tĩnh trong ngày sát hạch.', isAnnouncement: false, order: 1 },
  { slug: 'kinh-nghiem-hoc', name: 'Kinh nghiệm học', description: 'Chạy DAT, cabin mô phỏng và cách sắp xếp lịch học thực hành.', isAnnouncement: false, order: 2 },
  { slug: 'tu-van-chon-bang', name: 'Tư vấn chọn bằng', description: 'So sánh hạng A, A1, B, C1 theo nhu cầu đi lại và loại xe bạn đang dùng.', isAnnouncement: false, order: 3 },
  { slug: 'hoc-phi-minh-bach', name: 'Học phí minh bạch', description: 'Trọn gói gồm những gì, phụ phí nào phát sinh và ưu đãi dành cho HSSV.', isAnnouncement: false, order: 4 },
  { slug: 'thong-bao', name: 'Thông báo', description: 'Lịch khai giảng, hồ sơ cần chuẩn bị và thông tin mới từ trung tâm.', isAnnouncement: true, order: 5 },
];
```

- [ ] **Step 2: Dữ liệu bài viết** — `src/scripts/seed-posts-data.ts`

Chép **nguyên văn tất cả 6 phần tử** của mảng `newsPosts` trong `front-end/lib/news.ts` (giữ đúng thứ tự, không sửa câu chữ), chỉ lấy các trường dưới đây:
```ts
export type SeedPost = {
  slug: string;
  title: string;
  excerpt: string;
  categorySlug: string;
  date: string; // dd/MM/yyyy như trong news.ts
  image: string;
  imageAlt: string;
  content: string[];
};

export const seedPosts: SeedPost[] = [
  {
    slug: '5-luu-y-truoc-ngay-thi-sat-hach-a1',
    title: '5 lưu ý trước ngày thi sát hạch A1',
    excerpt:
      'Giấy tờ cần mang, giờ có mặt, cách chạy sa hình Wave và mẹo giữ bình tĩnh trong phòng thi lý thuyết.',
    categorySlug: 'kinh-nghiem-thi',
    date: '06/09/2026',
    image: '/media/1789307300348_4599662549725482019_4599662549725482019_fdc3b40a8c3079067cf0cad66a40d03b.jpg',
    imageAlt: 'Toàn cảnh sân tập và sát hạch của trung tâm Gia Thịnh nhìn từ trên cao',
    content: [
      'Mang đủ CCCD bản gốc, biên lai đăng ký và có mặt trước giờ thi ít nhất 30 phút để làm thủ tục, nhận số báo danh và nghe phổ biến quy chế.',
      // … các đoạn còn lại chép nguyên văn từ news.ts
    ],
  },
  // … 5 bài còn lại chép nguyên văn từ news.ts
];
```
Kiểm tra sau khi chép: `seedPosts.length === 6`, mọi `categorySlug` thuộc `seedCategories`, mọi slug khác nhau.

- [ ] **Step 3: Viết test (failing)** — `tests/integration/seed-catalog.test.ts`

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { Category } from '../../src/modules/categories/category.model';
import { Course } from '../../src/modules/courses/course.model';
import { Post } from '../../src/modules/posts/post.model';
import { PriceItem } from '../../src/modules/pricing/price-item.model';
import { PriceOverride } from '../../src/modules/pricing/price-override.model';
import { runSeed } from '../../src/scripts/seed';
import { seedPriceItems } from '../../src/scripts/seed-catalog-data';

type PublicCourse = { code: string; price: number; fees: { label: string }[]; discounts: { label: string }[] };

describe('seed gói học, giá, nội dung', () => {
  it('idempotent: chạy 2 lần không nhân đôi', async () => {
    await runSeed();
    await runSeed();
    expect(await Course.countDocuments()).toBe(4);
    expect(await PriceOverride.countDocuments()).toBe(2);
    expect(await PriceItem.countDocuments()).toBe(seedPriceItems.length);
    expect(await Category.countDocuments()).toBe(5);
    expect(await Post.countDocuments({ status: 'published' })).toBe(6);
  });

  it('bảng giá công khai khớp website hiện tại (Tân Ngãi vs Vũng Liêm)', async () => {
    await runSeed();
    const app = createApp();
    const tanNgai = (await request(app).get('/api/v1/public/pricing?branch=tan-ngai')).body.data.courses as PublicCourse[];
    const vungLiem = (await request(app).get('/api/v1/public/pricing?branch=vung-liem')).body.data.courses as PublicCourse[];
    const at = (list: PublicCourse[], code: string) => list.find((course) => course.code === code)!;

    expect(tanNgai.map((course) => course.code)).toEqual(['A1', 'A', 'B', 'C1']);
    expect(at(tanNgai, 'A')).toMatchObject({ price: 1_750_000 });
    expect(at(tanNgai, 'A').fees.map((fee) => fee.label)).toEqual(['Xe cảm biến A', 'Thi thử máy tính']);
    expect(at(tanNgai, 'A').discounts.map((d) => d.label)).toEqual([
      'Có bằng ô tô: miễn lý thuyết',
      'HSSV học hạng A (mang thẻ khi đăng ký)',
    ]);

    expect(at(vungLiem, 'A1')).toMatchObject({ price: 790_000 });
    expect(at(vungLiem, 'A')).toMatchObject({ price: 1_595_000 });
    expect(at(vungLiem, 'A').fees.map((fee) => fee.label)).toEqual(['Cảm biến A tay ga Vespa', 'Cảm biến A tay côn']);
    expect(at(vungLiem, 'A').discounts.map((d) => d.label)).toEqual(['Có bằng ô tô: miễn lý thuyết']);
    expect(at(vungLiem, 'A1').fees.map((fee) => fee.label)).toEqual(['Xe cảm biến A1']);
    expect(at(vungLiem, 'B')).toMatchObject({ price: 16_500_000 });
  });

  it('không ghi đè giá admin đã sửa', async () => {
    await runSeed();
    await Course.updateOne({ code: 'B' }, { defaultPrice: 17_000_000 });
    await runSeed();
    expect((await Course.findOne({ code: 'B' }))?.defaultPrice).toBe(17_000_000);
  });

  it('bài viết seed có nội dung Plate, giờ đăng 08:00 giờ VN và hiện ở /public/posts', async () => {
    await runSeed();
    const res = await request(createApp()).get('/api/v1/public/posts/5-luu-y-truoc-ngay-thi-sat-hach-a1');
    expect(res.status).toBe(200);
    expect(res.body.data.publishedAt).toBe('2026-09-06T08:00:00+07:00');
    expect(res.body.data.content[0]).toMatchObject({ type: 'p', children: [{ text: expect.stringContaining('CCCD') }] });
    expect(res.body.data.category.slug).toBe('kinh-nghiem-thi');
  });
});
```

- [ ] **Step 4: Chạy test, xác nhận fail**

Run: `npx vitest run tests/integration/seed-catalog.test.ts`
Expected: FAIL — `seed-catalog-data` không tồn tại hoặc số lượng = 0.

- [ ] **Step 5: Viết `src/scripts/seed-catalog.ts` và gọi trong `runSeed`**

```ts
import { Branch } from '../modules/branches/branch.model';
import { Category } from '../modules/categories/category.model';
import { Course } from '../modules/courses/course.model';
import { paragraphsToPlate, plateToText, readTimeMinutes } from '../modules/posts/plate';
import { Post } from '../modules/posts/post.model';
import { PriceItem } from '../modules/pricing/price-item.model';
import { PriceOverride } from '../modules/pricing/price-override.model';
import { WITH_DELETED } from '../shared/mongoose/softDelete';
import { parseDateTime } from '../shared/time';
import { seedCategories, seedCourses, seedOverrides, seedPriceItems } from './seed-catalog-data';
import { seedPosts } from './seed-posts-data';

function vnDateToPublishedAt(date: string): Date {
  const [day, month, year] = date.split('/');
  return parseDateTime(`${year}-${month}-${day}T08:00`);
}

async function idMap<T extends { _id: unknown }>(docs: T[], keyOf: (doc: T) => string): Promise<Map<string, unknown>> {
  return new Map(docs.map((doc) => [keyOf(doc), doc._id]));
}

export async function seedCatalog(): Promise<void> {
  for (const course of seedCourses) {
    await Course.updateOne({ code: course.code, ...WITH_DELETED }, { $setOnInsert: course }, { upsert: true });
  }
  for (const category of seedCategories) {
    await Category.updateOne({ slug: category.slug }, { $setOnInsert: category }, { upsert: true });
  }

  const courseIds = await idMap(await Course.find(WITH_DELETED), (course) => course.code);
  const branchIds = await idMap(await Branch.find(WITH_DELETED), (branch) => branch.slug);
  const categoryIds = await idMap(await Category.find(), (category) => category.slug);
  const required = (map: Map<string, unknown>, key: string, what: string) => {
    const id = map.get(key);
    if (!id) throw new Error(`Seed thiếu ${what}: ${key}`);
    return id;
  };

  for (const override of seedOverrides) {
    const branchId = required(branchIds, override.branchSlug, 'chi nhánh');
    const courseId = required(courseIds, override.courseCode, 'gói học');
    await PriceOverride.updateOne(
      { branchId, courseId },
      { $setOnInsert: { branchId, courseId, price: override.price } },
      { upsert: true },
    );
  }

  for (const { courseCode, branchSlug, ...item } of seedPriceItems) {
    const courseId = courseCode ? required(courseIds, courseCode, 'gói học') : null;
    const branchId = branchSlug ? required(branchIds, branchSlug, 'chi nhánh') : null;
    await PriceItem.updateOne(
      { kind: item.kind, key: item.key, courseId, branchId },
      { $setOnInsert: { ...item, courseId, branchId, hidden: item.hidden ?? false } },
      { upsert: true },
    );
  }

  for (const post of seedPosts) {
    const content = paragraphsToPlate(post.content);
    const contentText = plateToText(content);
    await Post.updateOne(
      { slug: post.slug, ...WITH_DELETED },
      {
        $setOnInsert: {
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt,
          content,
          contentText,
          readTimeMinutes: readTimeMinutes(contentText),
          cover: { url: post.image, alt: post.imageAlt, mediaId: null },
          categoryId: required(categoryIds, post.categorySlug, 'chuyên mục'),
          tags: [],
          authorId: null,
          authorName: 'Ban biên tập',
          status: 'published',
          publishedAt: vnDateToPublishedAt(post.date),
          views: 0,
          seo: null,
          deletedAt: null,
        },
      },
      { upsert: true },
    );
  }
}
```

Trong `src/scripts/seed.ts`: `import { seedCatalog } from './seed-catalog';` và gọi `await seedCatalog();` ngay sau vòng lặp seed chi nhánh (trước settings). `idMap` không cần `async` — có thể đổi thành hàm thường khi viết, giữ hành vi.

- [ ] **Step 6: Chạy test seed**

Run: `npx vitest run tests/integration/seed-catalog.test.ts tests/integration/seed.test.ts`
Expected: PASS (test seed đợt 1 vẫn pass).

- [ ] **Step 7: Swagger** — thêm vào `paths` trong `src/docs/openapi.ts` (trước các path `/public/...` hiện có):

```ts
    '/courses': {
      get: op('Gói học', 'Danh sách gói học', { parameters: [...listParams, { name: 'active', in: 'query', schema: { type: 'string' } }] }),
      post: op('Gói học', 'Tạo gói học (super_admin)', {
        requestBody: json({ code: 'B', name: 'Hạng B', vehicleType: 'car', defaultPrice: 16_500_000 }),
      }),
    },
    '/courses/reorder': { patch: op('Gói học', 'Sắp xếp gói học', { requestBody: json({ ids: ['<courseId>'] }) }) },
    '/courses/{id}': {
      get: op('Gói học', 'Chi tiết gói học', { parameters: [idParam] }),
      patch: op('Gói học', 'Sửa gói học / giá mặc định (super_admin)', { parameters: [idParam], requestBody: json({ defaultPrice: 17_000_000 }) }),
      delete: op('Gói học', 'Xóa (mềm) gói học', { parameters: [idParam] }),
    },
    '/pricing/branches/{branchId}': {
      get: op('Bảng giá', 'Bảng giá đầy đủ của chi nhánh (có nguồn giá)', {
        parameters: [{ name: 'branchId', in: 'path', required: true, schema: { type: 'string' } }],
      }),
    },
    '/pricing/branches/{branchId}/courses/{courseId}': {
      put: op('Bảng giá', 'Đặt giá riêng cho chi nhánh', {
        parameters: ['branchId', 'courseId'].map((name) => ({ name, in: 'path', required: true, schema: { type: 'string' } })),
        requestBody: json({ price: 1_595_000 }),
      }),
      delete: op('Bảng giá', 'Bỏ giá riêng, về giá mặc định', {
        parameters: ['branchId', 'courseId'].map((name) => ({ name, in: 'path', required: true, schema: { type: 'string' } })),
      }),
    },
    '/pricing/items': {
      get: op('Bảng giá', 'Danh sách phụ phí / ưu đãi', {
        parameters: [...listParams, ...['kind', 'branchId', 'courseId'].map((name) => ({ name, in: 'query', schema: { type: 'string' } }))],
      }),
      post: op('Bảng giá', 'Tạo phụ phí / ưu đãi', {
        requestBody: json({ kind: 'fee', key: 'cam-bien-a', courseId: '<courseId>', branchId: null, label: 'Xe cảm biến A', amount: 70_000, unit: 'vòng' }),
      }),
    },
    '/pricing/items/{id}': {
      patch: op('Bảng giá', 'Sửa phụ phí / ưu đãi', { parameters: [idParam], requestBody: json({ amount: 50_000 }) }),
      delete: op('Bảng giá', 'Xóa phụ phí / ưu đãi', { parameters: [idParam] }),
    },
    '/categories': {
      get: op('Bài viết', 'Danh sách chuyên mục'),
      post: op('Bài viết', 'Tạo chuyên mục', { requestBody: json({ name: 'Kinh nghiệm thi' }) }),
    },
    '/categories/reorder': { patch: op('Bài viết', 'Sắp xếp chuyên mục', { requestBody: json({ ids: ['<categoryId>'] }) }) },
    '/categories/{id}': {
      get: op('Bài viết', 'Chi tiết chuyên mục', { parameters: [idParam] }),
      patch: op('Bài viết', 'Sửa chuyên mục', { parameters: [idParam], requestBody: json({ name: 'Mẹo học' }) }),
      delete: op('Bài viết', 'Xóa chuyên mục (409 nếu còn bài)', { parameters: [idParam] }),
    },
    '/posts': {
      get: op('Bài viết', 'Danh sách bài viết (không kèm nội dung)', {
        parameters: [...listParams, ...['status', 'categoryId', 'tag'].map((name) => ({ name, in: 'query', schema: { type: 'string' } }))],
      }),
      post: op('Bài viết', 'Tạo bản nháp', {
        requestBody: json({ title: '5 lưu ý trước ngày thi A1', categoryId: '<categoryId>', content: [{ type: 'p', children: [{ text: '...' }] }] }),
      }),
    },
    '/posts/{id}': {
      get: op('Bài viết', 'Chi tiết bài viết', { parameters: [idParam] }),
      patch: op('Bài viết', 'Sửa bài viết', { parameters: [idParam], requestBody: json({ title: 'Tiêu đề mới' }) }),
      delete: op('Bài viết', 'Xóa (mềm) bài viết', { parameters: [idParam] }),
    },
    '/posts/{id}/submit': { post: op('Bài viết', 'Gửi duyệt', { parameters: [idParam] }) },
    '/posts/{id}/publish': {
      post: op('Bài viết', 'Xuất bản (có thể hẹn giờ)', { parameters: [idParam], requestBody: json({ publishedAt: '2026-10-10T08:00' }) }),
    },
    '/posts/{id}/unpublish': { post: op('Bài viết', 'Gỡ xuất bản', { parameters: [idParam] }) },
    '/posts/{id}/archive': { post: op('Bài viết', 'Lưu trữ', { parameters: [idParam] }) },
    '/posts/{id}/duplicate': { post: op('Bài viết', 'Nhân bản thành bản nháp', { parameters: [idParam] }) },
    '/public/pricing': {
      get: op('Công khai', 'Bảng giá theo chi nhánh', { parameters: [{ name: 'branch', in: 'query', schema: { type: 'string' } }] }, false),
    },
    '/public/categories': { get: op('Công khai', 'Chuyên mục kèm số bài', {}, false) },
    '/public/posts': {
      get: op('Công khai', 'Tin đã xuất bản', {
        parameters: ['page', 'limit', 'category', 'q'].map((name) => ({ name, in: 'query', schema: { type: 'string' } })),
      }, false),
    },
    '/public/posts/{slug}': {
      get: op('Công khai', 'Chi tiết tin (+1 lượt xem)', {
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
      }, false),
    },
```

Trong `tests/integration/docs.test.ts`, thêm vào mảng `arrayContaining`: `'/courses'`, `'/pricing/items'`, `'/pricing/branches/{branchId}/courses/{courseId}'`, `'/categories'`, `'/posts'`, `'/posts/{id}/publish'`, `'/public/pricing'`, `'/public/categories'`, `'/public/posts'`, `'/public/posts/{slug}'`, và đổi tên test thành `'/api/docs.json liệt kê endpoint đợt 1 và 2'`.

- [ ] **Step 8: README** — thêm vào `README.md` sau mục "Tài khoản nhân viên":

```markdown
## Bảng giá theo chi nhánh

- **Giá mặc định** nằm ở gói học (`/courses`, chỉ super_admin sửa). Mọi chi nhánh dùng giá này.
- **Giá riêng** của một chi nhánh: `PUT /pricing/branches/:branchId/courses/:courseId` (quản lý chi nhánh đó hoặc super_admin). `DELETE` cùng đường dẫn để về giá mặc định.
- **Phụ phí / ưu đãi** (`/pricing/items`, `kind: fee | discount`): mục `branchId: null` áp dụng mọi chi nhánh (chỉ super_admin). Chi nhánh tạo mục cùng `key` để thay mục chung, hoặc `hidden: true` để ẩn mục chung ở chi nhánh mình.
- Website đọc giá cuối cùng ở `GET /public/pricing?branch=<slug>`; chi nhánh luôn hiện đủ mọi gói đang bán.

## Bài viết

- Trạng thái: `draft → (pending) → published → draft/archived`. Người có quyền bài viết được xuất bản trực tiếp; `publishedAt` ở tương lai = hẹn giờ.
- Nội dung là Plate JSON; link/ảnh chỉ nhận `http(s)://`, đường dẫn `/...`, `#`, `mailto:`, `tel:`.
```

- [ ] **Step 9: Kiểm tra toàn bộ + build**

Run: `npm run typecheck && npm run lint && npx vitest run && npm run build`
Expected: tất cả pass, có `dist/server.js`.
