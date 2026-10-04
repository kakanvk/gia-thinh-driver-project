# Backend Đợt 3 — CRM: khách hàng tiềm năng, lịch sử chăm sóc, lịch hẹn, form tư vấn: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Form tư vấn trên website lưu thành khách hàng tiềm năng (lead) thật; tư vấn viên/quản lý chi nhánh xem, phân công, chuyển trạng thái, ghi lịch sử chăm sóc, đặt lịch hẹn và xuất danh sách — mỗi người chỉ thấy khách của chi nhánh mình.

**Architecture:** Thêm 2 module feature-based `leads` (lead + lịch sử chăm sóc + form công khai + xuất CSV) và `appointments` (lịch hẹn + lịch tháng). Quy tắc chuyển trạng thái là hàm thuần `canTransition` (test riêng). Mọi truy vấn admin đi qua `branchFilter(req.scope)` / `assertBranchAccess`. Mã khách `GT-yyMMdd-NN` sinh bằng bộ đếm atomic theo ngày giờ VN.

**Tech Stack:** giữ nguyên đợt 1–2 (Express 5, Mongoose 8, zod 4, Vitest + Supertest + mongodb-memory-server). Không thêm thư viện.

**Spec:** `docs/superpowers/specs/2026-10-03-backend-api-design.md` — mục 5 (phân quyền chi nhánh), 6 "CRM" (`leads`, `leadActivities`, `appointments`), 7 (endpoint `leads`, `appointments`, `POST /public/leads`), 9 (rate limit form công khai), 10 (test luồng trạng thái), 12 đợt 3.

## Global Constraints

- Mọi lệnh chạy trong `back-end/`. **KHÔNG commit, KHÔNG stage.** Kiểm tra: `npm run typecheck && npm run lint && npx vitest run`.
- Dùng lại hạ tầng có sẵn (xem `.superpowers/sdd/2026-10-04-backend-dot-2-noi-dung-va-gia/context-notes.md`): `validate/validated`, `authenticate`, `authorize(perm, { branchScoped: true })`, `branchFilter`, `assertBranchAccess`, `createRateLimiter`, `ApiError`, `sendData/sendList`, `paginate/listQuerySchema`, `objectIdSchema/idParamsSchema/zDateOnly/zDateTime/slugSchema`, `phoneSchema` (users.validation), `normalizePhone`, `escapeRegex`, `schemaOptions<T>()` (không cast), `softDeletePlugin`, `getBranch`, `Branch`, `Course`, `User`, `recordAudit/snapshot`.
- Quyền đã có trong `src/config/roles.ts` (không đổi): consultant `lead.read`, `lead.create`, `lead.update`, `appointment.*`; branch_manager `lead.*`, `appointment.*`; super_admin `*`. Như vậy `lead.delete` và `lead.export` chỉ branch_manager + super_admin. editor/instructor không có quyền CRM.
- **Mọi route admin CRM dùng `branchScoped: true`**: nhân viên chỉ thấy/sửa khách, lịch hẹn thuộc chi nhánh mình; truy cập id của chi nhánh khác trả **404** (không lộ sự tồn tại); ghi dữ liệu sang chi nhánh khác trả **403 `BRANCH_FORBIDDEN`**.
- SĐT lưu dạng chuẩn `0xxxxxxxxx` (qua `phoneSchema`). Thời gian JSON `+07:00`; thời gian nhập không offset hiểu là giờ VN.
- Response `{ data }` / `{ data, meta }`; lỗi chuẩn, message tiếng Việt.
- `POST /public/leads` không trả thông tin khách, chỉ `201 { data: { received: true } }` (kể cả khi trùng hay bị honeypot).

### Quyết định thiết kế trong đợt này (chi tiết hóa spec)
- **Luồng trạng thái:** `new → contacted → consulted → deposited → docs_completed`; được **nhảy tiến** qua nhiều bước, **không lùi**. Mọi trạng thái mở → `lost` (bắt buộc `lostReason`). `lost → contacted` để mở lại. `enrolled` **chưa dùng ở đợt này** — chỉ đạt được qua `POST /leads/:id/convert` (đợt 4, khi có học viên).
- **Mã khách** `GT-yyMMdd-NN` theo ngày giờ VN (khớp màn admin hiện tại, vd `GT-260924-01`), số thứ tự tăng theo ngày, tối thiểu 2 chữ số.
- **Gửi trùng:** khách gửi form với SĐT đang có lead **mở** (chưa `lost`/`enrolled`) ở cùng chi nhánh → không tạo lead mới, thêm hoạt động `form_resubmit` vào lead cũ. Nếu chỉ có lead `lost` → tạo lead mới.
- **Chống spam form:** rate limit 10 lần/giờ/IP; tối đa 3 lần gửi/24 giờ/SĐT (đếm trong collection `leadSubmissions` có TTL 1 ngày); trường honeypot `website` có giá trị → giả vờ thành công, không lưu.
- **Form công khai** nhận `branch` (slug từ `/public/branches`) và `courseCode` (mã từ `/public/pricing`, bỏ trống = "chưa xác định"), `consent: true` bắt buộc.
- **Lịch sử chăm sóc** (`leadActivities`) là nhật ký của CRM: tạo, sửa, đổi trạng thái, phân công, gửi lại form, lịch hẹn, cuộc gọi/ghi chú/SMS/gặp mặt (nhập tay). Thao tác trên lead không ghi `auditLogs`, **trừ xóa lead** (`lead.delete`).
- **Người phụ trách** phải là tư vấn viên hoặc quản lý **đang hoạt động, thuộc chi nhánh của khách**. Chuyển khách sang chi nhánh khác mà người phụ trách không thuộc chi nhánh mới → tự bỏ người phụ trách.
- **Lịch hẹn** lưu `startAt` + `endAt` (= start + `durationMinutes`, 15–480, mặc định 30). Cùng một người phụ trách không được có 2 lịch `scheduled` chồng giờ → 409. Lịch hẹn của một lead luôn thuộc chi nhánh của lead.
- **Xuất CSV** tối đa 5.000 dòng, UTF-8 có BOM (mở được bằng Excel), chặn CSV injection (ô bắt đầu bằng `= + - @` được thêm dấu `'`).
- Không seed khách hàng mẫu (tránh dữ liệu cá nhân giả trong DB thật).

## Review Focus

1. Tư vấn viên chi nhánh A gọi `GET/PATCH /leads/:id`, `/leads/:id/activities`, `/appointments/:id` của chi nhánh B → 404; tạo lead/lịch hẹn cho chi nhánh B → 403 `BRANCH_FORBIDDEN` (Task 2, Task 5).
2. Form công khai gửi SĐT viết kiểu `+84 779 666 664` hai lần → chỉ một lead, có hoạt động `form_resubmit` (Task 3).
3. Hai request tạo lead cùng ngày đồng thời → mã khác nhau, không lỗi trùng (Task 1).
4. Ô CSV bắt đầu bằng `=HYPERLINK(...)` được vô hiệu hóa; chữ tiếng Việt hiển thị đúng khi mở bằng Excel (BOM) (Task 4).
5. Chuyển `lost` mà không có lý do → 400; chuyển lùi `consulted → new` → 409 (Task 1, Task 2).

---

## File Structure

```
back-end/src/
├── shared/time.ts                         # + formatVn, vnMonthRange
├── shared/mongoose/counter.ts             # Counter model + nextSequence(key)
├── modules/leads/
│   ├── lead.model.ts                      # Lead, LEAD_STATUSES, LEAD_SOURCES
│   ├── lead-activity.model.ts             # LeadActivity, ACTIVITY_TYPES
│   ├── lead-submission.model.ts           # LeadSubmission (TTL 1 ngày)
│   ├── lead.status.ts                     # PIPELINE, OPEN_STATUSES, canTransition, STATUS_LABELS
│   ├── lead.code.ts                       # nextLeadCode()
│   ├── leads.validation.ts
│   ├── leads.activity.ts                  # addActivity()
│   ├── leads.service.ts                   # admin
│   ├── leads.public.ts                    # submitPublicLead + handler
│   ├── leads.export.ts                    # CSV
│   ├── leads.controller.ts
│   └── leads.routes.ts
├── modules/appointments/
│   ├── appointment.model.ts  appointments.validation.ts  appointments.service.ts
│   ├── appointments.controller.ts  appointments.routes.ts
├── modules/public/public.routes.ts        # + POST /leads
├── routes/index.ts                        # + /leads, /appointments
└── docs/openapi.ts                        # + path đợt 3
back-end/tests/
├── helpers/factories.ts                   # + createLead
├── unit/lead-status.test.ts  unit/time-crm.test.ts
└── integration/lead-code.test.ts leads.test.ts public-leads.test.ts leads-export.test.ts appointments.test.ts
```

---

### Task 1: Nền tảng CRM — bộ đếm, giờ VN, model lead, quy tắc trạng thái

**Files:**
- Modify: `src/shared/time.ts` (thêm `formatVn`, `vnMonthRange`)
- Create: `src/shared/mongoose/counter.ts`, `src/modules/leads/lead.model.ts`, `lead-activity.model.ts`, `lead-submission.model.ts`, `lead.status.ts`, `lead.code.ts`, `leads.activity.ts`
- Test: `tests/unit/time-crm.test.ts`, `tests/unit/lead-status.test.ts`, `tests/integration/lead-code.test.ts`

**Interfaces:**
- Produces:
  - `formatVn(date: Date, pattern: string): string` (định dạng theo +07:00), `vnMonthRange(month: 'YYYY-MM'): { start: Date; end: Date }` (`end` = đầu tháng sau, loại trừ).
  - `nextSequence(key: string): Promise<number>` (atomic, bắt đầu từ 1).
  - `Lead`, `ILead`, `LeadDoc`, `LEAD_STATUSES`, `LeadStatus`, `LEAD_SOURCES`, `LeadSource`.
  - `LeadActivity`, `ILeadActivity`, `ACTIVITY_TYPES`, `ActivityType`, `MANUAL_ACTIVITY_TYPES` (`call`, `note`, `sms`, `meeting`).
  - `LeadSubmission` (`phone`, `ip`, `at`; TTL 86.400 giây).
  - `PIPELINE`, `OPEN_STATUSES`, `canTransition(from, to): boolean`, `STATUS_LABELS: Record<LeadStatus, string>`.
  - `nextLeadCode(now?: Date): Promise<string>`.
  - `addActivity(leadId: string, entry: { type: ActivityType; content?: string | null; fromStatus?: LeadStatus | null; toStatus?: LeadStatus | null; byUserId: string | null; at?: Date }): Promise<void>` — đồng thời cập nhật `lead.lastActivityAt`.

- [ ] **Step 1: Viết test (failing)**

`tests/unit/time-crm.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { formatVn, vnMonthRange } from '../../src/shared/time';

describe('formatVn / vnMonthRange', () => {
  it('formatVn hiển thị theo giờ VN', () => {
    expect(formatVn(new Date('2026-10-04T18:30:00Z'), 'dd/MM/yyyy HH:mm')).toBe('05/10/2026 01:30');
    expect(formatVn(new Date('2026-09-23T17:00:00Z'), 'yyMMdd')).toBe('260924');
  });

  it('vnMonthRange: đầu tháng tới đầu tháng sau theo giờ VN, qua năm đúng', () => {
    const oct = vnMonthRange('2026-10');
    expect(oct.start.toISOString()).toBe('2026-09-30T17:00:00.000Z');
    expect(oct.end.toISOString()).toBe('2026-10-31T17:00:00.000Z');
    expect(vnMonthRange('2026-12').end.toISOString()).toBe('2026-12-31T17:00:00.000Z');
  });
});
```

`tests/unit/lead-status.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { canTransition, OPEN_STATUSES, STATUS_LABELS } from '../../src/modules/leads/lead.status';

describe('canTransition', () => {
  it.each([
    ['new', 'contacted'],
    ['new', 'consulted'],
    ['contacted', 'docs_completed'],
    ['deposited', 'docs_completed'],
    ['new', 'lost'],
    ['docs_completed', 'lost'],
    ['lost', 'contacted'],
  ] as const)('%s → %s được phép', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    ['consulted', 'new'],
    ['docs_completed', 'deposited'],
    ['new', 'new'],
    ['lost', 'lost'],
    ['lost', 'consulted'],
    ['docs_completed', 'enrolled'],
    ['enrolled', 'lost'],
  ] as const)('%s → %s bị chặn', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it('OPEN_STATUSES là 5 bước pipeline; mọi trạng thái có nhãn tiếng Việt', () => {
    expect(OPEN_STATUSES).toEqual(['new', 'contacted', 'consulted', 'deposited', 'docs_completed']);
    expect(STATUS_LABELS.lost).toBe('Không thành công');
    expect(Object.keys(STATUS_LABELS)).toHaveLength(7);
  });
});
```

`tests/integration/lead-code.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { nextLeadCode } from '../../src/modules/leads/lead.code';

describe('nextLeadCode', () => {
  it('GT-yyMMdd-NN theo ngày VN, tăng dần, ngày mới đếm lại', async () => {
    const day1 = new Date('2026-09-23T17:30:00Z'); // 24/09 00:30 giờ VN
    expect(await nextLeadCode(day1)).toBe('GT-260924-01');
    expect(await nextLeadCode(day1)).toBe('GT-260924-02');
    expect(await nextLeadCode(new Date('2026-09-24T17:00:00Z'))).toBe('GT-260925-01');
  });

  it('gọi đồng thời không trùng mã', async () => {
    const now = new Date('2026-10-01T03:00:00Z');
    const codes = await Promise.all(Array.from({ length: 20 }, () => nextLeadCode(now)));
    expect(new Set(codes).size).toBe(20);
    expect(codes).toContain('GT-261001-20');
  });

  it('quá 99 vẫn tăng tiếp (3 chữ số)', async () => {
    const now = new Date('2026-10-02T03:00:00Z');
    for (let i = 0; i < 99; i += 1) await nextLeadCode(now);
    expect(await nextLeadCode(now)).toBe('GT-261002-100');
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/unit/time-crm.test.ts tests/unit/lead-status.test.ts tests/integration/lead-code.test.ts`
Expected: FAIL — export/module không tồn tại.

- [ ] **Step 3: Viết code**

Thêm vào cuối `src/shared/time.ts`:
```ts
export function formatVn(date: Date, pattern: string): string {
  return formatInTimeZone(date, VN_OFFSET, pattern);
}

export function vnMonthRange(month: string): { start: Date; end: Date } {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7));
  const nextYear = monthIndex === 12 ? year + 1 : year;
  const nextMonth = monthIndex === 12 ? 1 : monthIndex + 1;
  return {
    start: parseDateOnly(`${month}-01`),
    end: parseDateOnly(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01`),
  };
}
```

`src/shared/mongoose/counter.ts`:
```ts
import { model, Schema } from 'mongoose';

interface ICounter {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>({ _id: { type: String, required: true }, seq: { type: Number, default: 0 } }, { versionKey: false });

export const Counter = model<ICounter>('Counter', counterSchema);

const MAX_ATTEMPTS = 3;

export async function nextSequence(key: string): Promise<number> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const counter = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' });
      return counter!.seq;
    } catch (err) {
      // Hai upsert đồng thời trên cùng _id mới: một request có thể lỗi 11000 → thử lại sẽ thấy document đã có.
      const duplicate = typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;
      if (!duplicate || attempt >= MAX_ATTEMPTS) throw err;
    }
  }
}
```

`src/modules/leads/lead.status.ts`:
```ts
export const LEAD_STATUSES = ['new', 'contacted', 'consulted', 'deposited', 'docs_completed', 'enrolled', 'lost'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const PIPELINE = ['new', 'contacted', 'consulted', 'deposited', 'docs_completed'] as const;
export const OPEN_STATUSES: LeadStatus[] = [...PIPELINE];

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Mới',
  contacted: 'Đã liên hệ',
  consulted: 'Đã tư vấn',
  deposited: 'Đặt cọc',
  docs_completed: 'Hoàn tất hồ sơ',
  enrolled: 'Nhập học',
  lost: 'Không thành công',
};

export function canTransition(from: LeadStatus, to: LeadStatus): boolean {
  if (from === to || from === 'enrolled' || to === 'enrolled') return false;
  if (to === 'lost') return true;
  if (from === 'lost') return to === 'contacted';
  return PIPELINE.indexOf(to) > PIPELINE.indexOf(from);
}
```

`src/modules/leads/lead.model.ts`:
```ts
import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';
import { softDeletePlugin } from '../../shared/mongoose/softDelete';
import { LEAD_STATUSES, type LeadStatus } from './lead.status';

export { LEAD_STATUSES, type LeadStatus };

export const LEAD_SOURCES = ['website', 'facebook', 'tiktok', 'zalo', 'referral', 'walk_in', 'other'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export interface ILeadUtm {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

export interface ILead {
  code: string;
  name: string;
  phone: string;
  email?: string | null;
  courseId: Types.ObjectId | null;
  courseCode: string | null;
  branchId: Types.ObjectId;
  preferredContactTime?: string | null;
  note?: string | null;
  source: LeadSource;
  utm?: ILeadUtm | null;
  status: LeadStatus;
  lostReason?: string | null;
  assigneeId?: Types.ObjectId | null;
  nextFollowUpAt?: Date | null;
  studentId?: Types.ObjectId | null;
  lastActivityAt: Date;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type LeadDoc = HydratedDocument<ILead>;

const utmSchema = new Schema<ILeadUtm>(
  { source: String, medium: String, campaign: String, term: String, content: String },
  { _id: false },
);

const leadSchema = new Schema<ILead>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true, default: null },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', default: null },
    courseCode: { type: String, default: null },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    preferredContactTime: { type: String, trim: true, default: null },
    note: { type: String, trim: true, default: null },
    source: { type: String, enum: LEAD_SOURCES, required: true },
    utm: { type: utmSchema, default: null },
    status: { type: String, enum: LEAD_STATUSES, default: 'new' },
    lostReason: { type: String, trim: true, default: null },
    assigneeId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    nextFollowUpAt: { type: Date, default: null },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', default: null },
    lastActivityAt: { type: Date, required: true, default: () => new Date() },
  },
  schemaOptions<ILead>(),
);

leadSchema.plugin(softDeletePlugin);
leadSchema.index({ branchId: 1, status: 1, createdAt: -1 });
leadSchema.index({ phone: 1, branchId: 1 });
leadSchema.index({ assigneeId: 1, status: 1 });
leadSchema.index({ nextFollowUpAt: 1 });

export const Lead = model<ILead>('Lead', leadSchema);
```

`src/modules/leads/lead-activity.model.ts`:
```ts
import { model, Schema, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';
import { LEAD_STATUSES, type LeadStatus } from './lead.status';

export const ACTIVITY_TYPES = [
  'created',
  'updated',
  'status_change',
  'assign',
  'form_resubmit',
  'appointment',
  'call',
  'note',
  'sms',
  'meeting',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export const MANUAL_ACTIVITY_TYPES = ['call', 'note', 'sms', 'meeting'] as const;

export interface ILeadActivity {
  leadId: Types.ObjectId;
  type: ActivityType;
  fromStatus?: LeadStatus | null;
  toStatus?: LeadStatus | null;
  content?: string | null;
  byUserId?: Types.ObjectId | null;
  at: Date;
}

const leadActivitySchema = new Schema<ILeadActivity>(
  {
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    fromStatus: { type: String, enum: [...LEAD_STATUSES, null], default: null },
    toStatus: { type: String, enum: [...LEAD_STATUSES, null], default: null },
    content: { type: String, default: null },
    byUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    at: { type: Date, required: true, default: () => new Date() },
  },
  schemaOptions<ILeadActivity>({ timestamps: false }),
);

leadActivitySchema.index({ leadId: 1, at: -1 });

export const LeadActivity = model<ILeadActivity>('LeadActivity', leadActivitySchema);
```

`src/modules/leads/lead-submission.model.ts`:
```ts
import { model, Schema } from 'mongoose';

interface ILeadSubmission {
  phone: string;
  ip: string;
  at: Date;
}

const leadSubmissionSchema = new Schema<ILeadSubmission>(
  {
    phone: { type: String, required: true },
    ip: { type: String, default: '' },
    at: { type: Date, required: true, default: () => new Date() },
  },
  { versionKey: false },
);

leadSubmissionSchema.index({ at: 1 }, { expireAfterSeconds: 86_400 });
leadSubmissionSchema.index({ phone: 1, at: -1 });

export const LeadSubmission = model<ILeadSubmission>('LeadSubmission', leadSubmissionSchema);
```

`src/modules/leads/lead.code.ts`:
```ts
import { nextSequence } from '../../shared/mongoose/counter';
import { formatVn } from '../../shared/time';

export async function nextLeadCode(now: Date = new Date()): Promise<string> {
  const day = formatVn(now, 'yyMMdd');
  const seq = await nextSequence(`lead:${day}`);
  return `GT-${day}-${String(seq).padStart(2, '0')}`;
}
```

`src/modules/leads/leads.activity.ts`:
```ts
import type { ActivityType } from './lead-activity.model';
import { LeadActivity } from './lead-activity.model';
import { Lead } from './lead.model';
import type { LeadStatus } from './lead.status';

export async function addActivity(
  leadId: string,
  entry: {
    type: ActivityType;
    content?: string | null;
    fromStatus?: LeadStatus | null;
    toStatus?: LeadStatus | null;
    byUserId: string | null;
    at?: Date;
  },
): Promise<void> {
  const at = entry.at ?? new Date();
  await LeadActivity.create({ ...entry, leadId, at });
  await Lead.updateOne({ _id: leadId }, { lastActivityAt: at });
}
```

- [ ] **Step 4: Chạy test**

Run: `npx vitest run tests/unit/time-crm.test.ts tests/unit/lead-status.test.ts tests/integration/lead-code.test.ts`
Expected: PASS

- [ ] **Step 5: Kiểm tra toàn bộ**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: tất cả pass.

---

### Task 2: API khách hàng cho nhân viên (`/leads`)

**Files:**
- Create: `src/modules/leads/leads.validation.ts`, `leads.service.ts`, `leads.controller.ts`, `leads.routes.ts`
- Modify: `src/routes/index.ts` (mount `/leads`), `tests/helpers/factories.ts` (thêm `createLead`)
- Test: `tests/integration/leads.test.ts`

**Interfaces:**
- Consumes: Task 1, `getBranch`, `Course`, `User`, `branchFilter`, `assertBranchAccess`, `recordAudit`, `snapshot`.
- Produces:
  - Validation: `createLeadSchema`, `updateLeadSchema`, `leadStatusSchema`, `assignLeadSchema`, `createActivitySchema`, `listLeadsQuerySchema`, `leadFilterQuerySchema` (= list query không có page/limit/sort, dùng cho export ở Task 4), types tương ứng.
  - Service: `buildLeadFilter(scope, query): FilterQuery<ILead>`, `listLeads(scope, query)`, `getLead(scope, id)`, `createLead(actor, scope, input)`, `updateLead(actor, scope, id, input)`, `changeLeadStatus(actor, scope, id, input)`, `assignLead(actor, scope, id, assigneeId)`, `listLeadActivities(scope, id, query)`, `addManualActivity(actor, scope, id, input)`, `removeLead(actor, scope, id)`, `assertAssignee(assigneeId, branchId)` (dùng lại ở Task 5).
  - `createLeadsRouter()`.
  - Test helper `createLead(overrides: { branchId: string } & Partial<{ name; phone; status; source; assigneeId; nextFollowUpAt; createdAt }>) → Promise<LeadDoc>`.

- [ ] **Step 1: Factory và test (failing)**

Thêm vào `tests/helpers/factories.ts`:
```ts
import { Lead, type LeadDoc, type LeadSource, type LeadStatus } from '../../src/modules/leads/lead.model';

let leadSeq = 0;

export async function createLead(
  overrides: { branchId: string } & Partial<{
    name: string;
    phone: string;
    status: LeadStatus;
    source: LeadSource;
    assigneeId: string;
    nextFollowUpAt: Date;
    createdAt: Date;
  }>,
): Promise<LeadDoc> {
  leadSeq += 1;
  const lead = await Lead.create({
    code: `GT-TEST-${leadSeq}`,
    name: overrides.name ?? `Khách ${leadSeq}`,
    phone: overrides.phone ?? `07${String(leadSeq).padStart(8, '0')}`,
    branchId: overrides.branchId,
    courseId: null,
    courseCode: null,
    source: overrides.source ?? 'website',
    status: overrides.status ?? 'new',
    assigneeId: overrides.assigneeId ?? null,
    nextFollowUpAt: overrides.nextFollowUpAt ?? null,
    lastActivityAt: new Date(),
  });
  if (!overrides.createdAt) return lead;
  // Ghi thẳng qua driver để Mongoose timestamps không ghi đè createdAt.
  await Lead.collection.updateOne({ _id: lead._id }, { $set: { createdAt: overrides.createdAt } });
  return (await Lead.findById(lead._id))!;
}
```

`tests/integration/leads.test.ts`:
```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { LeadActivity } from '../../src/modules/leads/lead-activity.model';
import { Lead } from '../../src/modules/leads/lead.model';
import { authHeader, createBranch, createCourse, createLead, createUser } from '../helpers/factories';

async function setup() {
  const [a, b] = await Promise.all([createBranch({ name: 'A' }), createBranch({ name: 'B' })]);
  const { user: consultantA } = await createUser({ role: 'consultant', branchIds: [a.id], name: 'Tư vấn A' });
  const { user: consultantB } = await createUser({ role: 'consultant', branchIds: [b.id] });
  const { user: managerA } = await createUser({ role: 'branch_manager', branchIds: [a.id] });
  const { user: admin } = await createUser();
  return { app: createApp(), a, b, consultantA, consultantB, managerA, admin };
}

describe('tạo và xem khách', () => {
  it('tư vấn viên A tạo khách tại quầy: mã GT-, SĐT chuẩn hóa, có hoạt động "created"', async () => {
    const { app, a, consultantA } = await setup();
    const course = await createCourse({ code: 'B' });
    const res = await request(app)
      .post('/api/v1/leads')
      .set(authHeader(consultantA))
      .send({ name: 'Nguyễn Văn An', phone: '+84 903 412 869', branchId: a.id, courseId: course.id, note: 'Hỏi lịch cuối tuần' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ phone: '0903412869', status: 'new', source: 'walk_in', courseCode: 'B' });
    expect(res.body.data.code).toMatch(/^GT-\d{6}-\d{2,}$/);
    expect(await LeadActivity.countDocuments({ leadId: res.body.data.id, type: 'created' })).toBe(1);
  });

  it('tạo cho chi nhánh khác → 403 BRANCH_FORBIDDEN; editor không có quyền → 403', async () => {
    const { app, b, consultantA } = await setup();
    const { user: editor } = await createUser({ role: 'editor' });
    const body = { name: 'Khách B', phone: '0909000111', branchId: b.id };
    const res = await request(app).post('/api/v1/leads').set(authHeader(consultantA)).send(body);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('BRANCH_FORBIDDEN');
    expect((await request(app).get('/api/v1/leads').set(authHeader(editor))).status).toBe(403);
  });

  it('danh sách chỉ gồm khách chi nhánh mình; id chi nhánh khác → 404 ở mọi endpoint', async () => {
    const { app, a, b, consultantA } = await setup();
    await createLead({ branchId: a.id, name: 'Của A' });
    const leadB = await createLead({ branchId: b.id, name: 'Của B' });
    const list = await request(app).get('/api/v1/leads').set(authHeader(consultantA));
    expect(list.body.data.map((l: { name: string }) => l.name)).toEqual(['Của A']);
    for (const [method, path] of [
      ['get', `/api/v1/leads/${leadB.id}`],
      ['patch', `/api/v1/leads/${leadB.id}`],
      ['get', `/api/v1/leads/${leadB.id}/activities`],
      ['patch', `/api/v1/leads/${leadB.id}/status`],
    ] as const) {
      const res = await request(app)[method](path).set(authHeader(consultantA)).send({ name: 'Tên mới', status: 'contacted' });
      expect(res.status, `${method} ${path}`).toBe(404);
    }
  });

  it('lọc theo trạng thái, nguồn, q (tên/SĐT/mã), khoảng ngày tạo theo giờ VN, hạn liên hệ', async () => {
    const { app, a, admin } = await setup();
    await createLead({ branchId: a.id, name: 'Trần Quốc Bảo', phone: '0786205114', status: 'contacted' });
    await createLead({ branchId: a.id, name: 'Lê Hoài Thương', source: 'facebook', createdAt: new Date('2026-09-22T18:00:00Z') });
    await createLead({ branchId: a.id, name: 'Đến hạn', nextFollowUpAt: new Date(Date.now() - 60_000) });
    await createLead({ branchId: a.id, name: 'Đến hạn nhưng đã lost', status: 'lost', nextFollowUpAt: new Date(Date.now() - 60_000) });
    const get = (qs: string) => request(app).get(`/api/v1/leads?${qs}`).set(authHeader(admin));
    expect((await get('status=contacted')).body.meta.total).toBe(1);
    expect((await get('source=facebook')).body.data[0].name).toBe('Lê Hoài Thương');
    expect((await get('q=0786%20205')).body.data[0].name).toBe('Trần Quốc Bảo');
    expect((await get('from=2026-09-23&to=2026-09-23')).body.data[0].name).toBe('Lê Hoài Thương');
    expect((await get('followUpDue=true')).body.data.map((l: { name: string }) => l.name)).toEqual(['Đến hạn']);
  });
});

describe('trạng thái, phân công, lịch sử', () => {
  it('chuyển tiến được; lùi → 409; lost thiếu lý do → 400; lost có lý do rồi mở lại', async () => {
    const { app, a, consultantA } = await setup();
    const lead = await createLead({ branchId: a.id });
    const url = `/api/v1/leads/${lead.id}/status`;
    const h = authHeader(consultantA);
    expect((await request(app).patch(url).set(h).send({ status: 'consulted', note: 'Đã gọi tư vấn hạng B' })).body.data.status).toBe('consulted');
    expect((await request(app).patch(url).set(h).send({ status: 'new' })).status).toBe(409);
    expect((await request(app).patch(url).set(h).send({ status: 'lost' })).status).toBe(400);
    const lost = await request(app).patch(url).set(h).send({ status: 'lost', lostReason: 'Chọn trung tâm khác' });
    expect(lost.body.data).toMatchObject({ status: 'lost', lostReason: 'Chọn trung tâm khác' });
    const reopened = await request(app).patch(url).set(h).send({ status: 'contacted' });
    expect(reopened.body.data).toMatchObject({ status: 'contacted', lostReason: null });
    const changes = await LeadActivity.find({ leadId: lead._id, type: 'status_change' }).sort({ at: 1, _id: 1 });
    expect(changes.map((c) => [c.fromStatus, c.toStatus])).toEqual([
      ['new', 'consulted'],
      ['consulted', 'lost'],
      ['lost', 'contacted'],
    ]);
    expect(changes[0]?.content).toBe('Đã gọi tư vấn hạng B');
  });

  it('enrolled không chọn được ở đợt này → 400', async () => {
    const { app, a, consultantA } = await setup();
    const lead = await createLead({ branchId: a.id });
    const res = await request(app).patch(`/api/v1/leads/${lead.id}/status`).set(authHeader(consultantA)).send({ status: 'enrolled' });
    expect(res.status).toBe(400);
  });

  it('phân công: chỉ người thuộc chi nhánh của khách; bỏ phân công bằng null', async () => {
    const { app, a, consultantA, consultantB, managerA } = await setup();
    const lead = await createLead({ branchId: a.id });
    const url = `/api/v1/leads/${lead.id}/assign`;
    expect((await request(app).patch(url).set(authHeader(managerA)).send({ assigneeId: consultantB.id })).status).toBe(400);
    const ok = await request(app).patch(url).set(authHeader(managerA)).send({ assigneeId: consultantA.id });
    expect(ok.body.data.assigneeId).toBe(consultantA.id);
    expect((await LeadActivity.findOne({ leadId: lead._id, type: 'assign' }))?.content).toContain('Tư vấn A');
    expect((await request(app).patch(url).set(authHeader(managerA)).send({ assigneeId: null })).body.data.assigneeId).toBeNull();
  });

  it('chuyển khách sang chi nhánh khác: phải có quyền cả 2 chi nhánh; người phụ trách không thuộc chi nhánh mới bị bỏ', async () => {
    const { app, a, b, consultantA, admin } = await setup();
    const lead = await createLead({ branchId: a.id, assigneeId: consultantA.id });
    expect((await request(app).patch(`/api/v1/leads/${lead.id}`).set(authHeader(consultantA)).send({ branchId: b.id })).status).toBe(403);
    const moved = await request(app).patch(`/api/v1/leads/${lead.id}`).set(authHeader(admin)).send({ branchId: b.id });
    expect(moved.body.data).toMatchObject({ branchId: b.id, assigneeId: null });
  });

  it('ghi chú/cuộc gọi tay cập nhật lastActivityAt và hẹn liên hệ; danh sách hoạt động mới nhất trước', async () => {
    const { app, a, consultantA } = await setup();
    const lead = await createLead({ branchId: a.id });
    const followUp = '2026-12-01T09:00';
    const res = await request(app)
      .post(`/api/v1/leads/${lead.id}/activities`)
      .set(authHeader(consultantA))
      .send({ type: 'call', content: 'Khách hẹn gọi lại tuần sau', nextFollowUpAt: followUp });
    expect(res.status).toBe(201);
    const fresh = await Lead.findById(lead.id);
    expect(fresh?.nextFollowUpAt?.toISOString()).toBe('2026-12-01T02:00:00.000Z');
    await request(app).post(`/api/v1/leads/${lead.id}/activities`).set(authHeader(consultantA)).send({ type: 'note', content: 'Ghi chú 2' });
    const list = await request(app).get(`/api/v1/leads/${lead.id}/activities`).set(authHeader(consultantA));
    expect(list.body.data.map((x: { type: string }) => x.type)).toEqual(['note', 'call']);
    expect((await request(app).post(`/api/v1/leads/${lead.id}/activities`).set(authHeader(consultantA)).send({ type: 'status_change', content: 'x' })).status).toBe(400);
  });

  it('xóa: tư vấn viên không được (403); quản lý xóa mềm, có audit', async () => {
    const { app, a, consultantA, managerA } = await setup();
    const lead = await createLead({ branchId: a.id });
    expect((await request(app).delete(`/api/v1/leads/${lead.id}`).set(authHeader(consultantA))).status).toBe(403);
    expect((await request(app).delete(`/api/v1/leads/${lead.id}`).set(authHeader(managerA))).status).toBe(204);
    expect(await Lead.countDocuments()).toBe(0);
    expect(await AuditLog.countDocuments({ action: 'lead.delete' })).toBe(1);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/integration/leads.test.ts`
Expected: FAIL — route 404 / module không tồn tại.

- [ ] **Step 3: Viết code**

`src/modules/leads/leads.validation.ts`:
```ts
import { z } from 'zod';
import { listQuerySchema } from '../../shared/mongoose/paginate';
import { objectIdSchema, zDateOnly, zDateTime } from '../../shared/zod';
import { phoneSchema } from '../users/users.validation';
import { MANUAL_ACTIVITY_TYPES } from './lead-activity.model';
import { LEAD_SOURCES, LEAD_STATUSES } from './lead.model';

const nameSchema = z.string().trim().min(2).max(100);
const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Email không hợp lệ'));
const shortText = z.string().trim().max(100);
const longText = z.string().trim().max(1000);

export const utmSchema = z
  .object({ source: shortText, medium: shortText, campaign: shortText, term: shortText, content: shortText })
  .partial();

export const createLeadSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  email: emailSchema.optional(),
  courseId: objectIdSchema.nullable().optional(),
  branchId: objectIdSchema,
  preferredContactTime: shortText.optional(),
  note: longText.optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  assigneeId: objectIdSchema.optional(),
  nextFollowUpAt: zDateTime.optional(),
});

export const updateLeadSchema = z
  .object({
    name: nameSchema,
    phone: phoneSchema,
    email: emailSchema.nullable(),
    courseId: objectIdSchema.nullable(),
    branchId: objectIdSchema,
    preferredContactTime: shortText.nullable(),
    note: longText.nullable(),
    source: z.enum(LEAD_SOURCES),
    nextFollowUpAt: zDateTime.nullable(),
  })
  .partial();

const MANUAL_STATUSES = LEAD_STATUSES.filter((status) => status !== 'enrolled') as [string, ...string[]];

export const leadStatusSchema = z
  .object({
    status: z.enum(MANUAL_STATUSES, { message: 'Trạng thái không hợp lệ (nhập học chỉ qua chuyển thành học viên)' }),
    lostReason: z.string().trim().min(3).max(300).optional(),
    note: longText.optional(),
  })
  .refine((value) => value.status !== 'lost' || Boolean(value.lostReason), {
    path: ['lostReason'],
    message: 'Bắt buộc nhập lý do khi chuyển sang Không thành công',
  });

export const assignLeadSchema = z.object({ assigneeId: objectIdSchema.nullable() });

export const createActivitySchema = z.object({
  type: z.enum(MANUAL_ACTIVITY_TYPES),
  content: z.string().trim().min(1).max(2000),
  nextFollowUpAt: zDateTime.nullable().optional(),
});

const filterFields = {
  status: z.enum(LEAD_STATUSES).optional(),
  branchId: objectIdSchema.optional(),
  assigneeId: z.union([objectIdSchema, z.literal('none')]).optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  courseId: objectIdSchema.optional(),
  followUpDue: z.literal('true').optional(),
  from: zDateOnly.optional(),
  to: zDateOnly.optional(),
  q: z.string().trim().min(1).max(100).optional(),
};

export const listLeadsQuerySchema = listQuerySchema.extend(filterFields);
export const leadFilterQuerySchema = z.object(filterFields);
export const activitiesQuerySchema = listQuerySchema.pick({ page: true, limit: true });

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type LeadStatusInput = z.infer<typeof leadStatusSchema>;
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>;
export type LeadFilterQuery = z.infer<typeof leadFilterQuerySchema>;
```

`src/modules/leads/leads.service.ts`:
```ts
import { Types, type FilterQuery } from 'mongoose';
import { assertBranchAccess, branchFilter } from '../../middlewares/authorize.middleware';
import { paginate, type ListQuery } from '../../shared/mongoose/paginate';
import { addFixedDays } from '../../shared/time';
import { ApiError } from '../../utils/ApiError';
import { normalizePhone } from '../../utils/phone';
import { escapeRegex } from '../../utils/regex';
import { recordAudit, snapshot } from '../audit/audit.service';
import { getBranch } from '../branches/branches.service';
import { Course } from '../courses/course.model';
import { User } from '../users/user.model';
import { LeadActivity } from './lead-activity.model';
import { nextLeadCode } from './lead.code';
import { Lead, type ILead, type LeadDoc } from './lead.model';
import { canTransition, OPEN_STATUSES, STATUS_LABELS, type LeadStatus } from './lead.status';
import { addActivity } from './leads.activity';
import type {
  CreateActivityInput,
  CreateLeadInput,
  LeadFilterQuery,
  LeadStatusInput,
  ListLeadsQuery,
  UpdateLeadInput,
} from './leads.validation';

type Actor = Express.AuthUser;
type Scope = Express.BranchScope | undefined;

const PHONE_LIKE = /^[\d\s.+()-]+$/;

export function buildLeadFilter(scope: Scope, query: LeadFilterQuery): FilterQuery<ILead> {
  const conditions: FilterQuery<ILead>[] = [branchFilter(scope)];
  if (query.branchId) {
    assertBranchAccess(scope, query.branchId);
    conditions.push({ branchId: new Types.ObjectId(query.branchId) });
  }
  if (query.status) conditions.push({ status: query.status });
  if (query.source) conditions.push({ source: query.source });
  if (query.courseId) conditions.push({ courseId: new Types.ObjectId(query.courseId) });
  if (query.assigneeId) {
    conditions.push({ assigneeId: query.assigneeId === 'none' ? null : new Types.ObjectId(query.assigneeId) });
  }
  if (query.followUpDue) conditions.push({ nextFollowUpAt: { $lte: new Date() }, status: { $in: OPEN_STATUSES } });
  if (query.from || query.to) {
    conditions.push({
      createdAt: {
        ...(query.from ? { $gte: query.from } : {}),
        ...(query.to ? { $lt: addFixedDays(query.to, 1) } : {}),
      },
    });
  }
  if (query.q) {
    const text = new RegExp(escapeRegex(query.q), 'i');
    const or: FilterQuery<ILead>[] = [{ name: text }, { code: text }];
    if (PHONE_LIKE.test(query.q)) or.push({ phone: new RegExp(escapeRegex(normalizePhone(query.q))) });
    conditions.push({ $or: or });
  }
  return { $and: conditions };
}

export async function listLeads(scope: Scope, query: ListLeadsQuery) {
  return paginate(Lead, buildLeadFilter(scope, query), query);
}

export async function getLead(scope: Scope, id: string): Promise<LeadDoc> {
  const lead = await Lead.findOne({ $and: [{ _id: id }, branchFilter(scope)] });
  if (!lead) throw ApiError.notFound('Không tìm thấy khách hàng');
  return lead;
}

export async function assertAssignee(assigneeId: string, branchId: string): Promise<{ name: string }> {
  const user = await User.findOne({
    _id: assigneeId,
    status: 'active',
    role: { $in: ['consultant', 'branch_manager'] },
    branchIds: new Types.ObjectId(branchId),
  });
  if (!user) {
    throw ApiError.badRequest('Người phụ trách phải là tư vấn viên hoặc quản lý đang làm ở chi nhánh của khách', [
      { path: 'body.assigneeId', message: 'Không hợp lệ' },
    ]);
  }
  return { name: user.name };
}

async function resolveCourse(courseId: string | null | undefined): Promise<{ courseId: string | null; courseCode: string | null }> {
  if (!courseId) return { courseId: null, courseCode: null };
  const course = await Course.findById(courseId);
  if (!course) throw ApiError.badRequest('Gói học không tồn tại', [{ path: 'body.courseId', message: 'Không tồn tại' }]);
  return { courseId: course.id, courseCode: course.code };
}

export async function createLead(actor: Actor, scope: Scope, input: CreateLeadInput): Promise<LeadDoc> {
  assertBranchAccess(scope, input.branchId);
  await getBranch(input.branchId);
  const course = await resolveCourse(input.courseId);
  if (input.assigneeId) await assertAssignee(input.assigneeId, input.branchId);
  const lead = await Lead.create({
    ...input,
    ...course,
    code: await nextLeadCode(),
    source: input.source ?? 'walk_in',
    status: 'new',
    lastActivityAt: new Date(),
  });
  await addActivity(lead.id, { type: 'created', content: 'Nhân viên tạo khách hàng', byUserId: actor.id });
  return (await Lead.findById(lead.id))!;
}

export async function updateLead(actor: Actor, scope: Scope, id: string, input: UpdateLeadInput): Promise<LeadDoc> {
  const lead = await getLead(scope, id);
  const changes: Record<string, unknown> = { ...input };
  const notes: string[] = [];

  if (input.branchId && input.branchId !== lead.branchId.toString()) {
    assertBranchAccess(scope, input.branchId);
    await getBranch(input.branchId);
    if (lead.assigneeId) {
      const stillValid = await User.exists({ _id: lead.assigneeId, branchIds: new Types.ObjectId(input.branchId) });
      if (!stillValid) {
        changes.assigneeId = null;
        notes.push('bỏ người phụ trách vì không thuộc chi nhánh mới');
      }
    }
  }
  if (input.courseId !== undefined) Object.assign(changes, await resolveCourse(input.courseId));

  lead.set(changes);
  await lead.save();
  const fields = Object.keys(input).join(', ');
  await addActivity(lead.id, {
    type: 'updated',
    content: `Cập nhật: ${fields}${notes.length ? ` (${notes.join('; ')})` : ''}`,
    byUserId: actor.id,
  });
  return lead;
}

export async function changeLeadStatus(actor: Actor, scope: Scope, id: string, input: LeadStatusInput): Promise<LeadDoc> {
  const lead = await getLead(scope, id);
  const from = lead.status;
  const to = input.status as LeadStatus;
  if (!canTransition(from, to)) {
    throw ApiError.conflict(`Không thể chuyển từ "${STATUS_LABELS[from]}" sang "${STATUS_LABELS[to]}"`);
  }
  lead.status = to;
  lead.lostReason = to === 'lost' ? (input.lostReason ?? null) : null;
  await lead.save();
  await addActivity(lead.id, {
    type: 'status_change',
    fromStatus: from,
    toStatus: to,
    content: input.note ?? (to === 'lost' ? input.lostReason : null) ?? null,
    byUserId: actor.id,
  });
  return lead;
}

export async function assignLead(actor: Actor, scope: Scope, id: string, assigneeId: string | null): Promise<LeadDoc> {
  const lead = await getLead(scope, id);
  const assignee = assigneeId ? await assertAssignee(assigneeId, lead.branchId.toString()) : null;
  lead.assigneeId = assigneeId ? new Types.ObjectId(assigneeId) : null;
  await lead.save();
  await addActivity(lead.id, {
    type: 'assign',
    content: assignee ? `Giao cho ${assignee.name}` : 'Bỏ người phụ trách',
    byUserId: actor.id,
  });
  return lead;
}

export async function listLeadActivities(scope: Scope, id: string, query: Pick<ListQuery, 'page' | 'limit'>) {
  const lead = await getLead(scope, id);
  return paginate(LeadActivity, { leadId: lead._id }, { ...query, sort: '-at' }, '-at');
}

export async function addManualActivity(actor: Actor, scope: Scope, id: string, input: CreateActivityInput) {
  const lead = await getLead(scope, id);
  if (input.nextFollowUpAt !== undefined) {
    lead.nextFollowUpAt = input.nextFollowUpAt;
    await lead.save();
  }
  await addActivity(lead.id, { type: input.type, content: input.content, byUserId: actor.id });
  return LeadActivity.findOne({ leadId: lead._id }).sort({ at: -1, _id: -1 });
}

export async function removeLead(actor: Actor, scope: Scope, id: string): Promise<void> {
  const lead = await getLead(scope, id);
  const before = snapshot(lead);
  lead.deletedAt = new Date();
  await lead.save();
  await recordAudit({ actorId: actor.id, action: 'lead.delete', entity: 'lead', entityId: id, before });
}
```

`src/modules/leads/leads.controller.ts`:
```ts
import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import type { ListQuery } from '../../shared/mongoose/paginate';
import { sendData, sendList } from '../../utils/response';
import * as service from './leads.service';
import type {
  CreateActivityInput,
  CreateLeadInput,
  LeadStatusInput,
  ListLeadsQuery,
  UpdateLeadInput,
} from './leads.validation';

type IdParams = { id: string };
const idOf = (req: Request) => validated<IdParams>(req, 'params').id;

export async function list(req: Request, res: Response): Promise<void> {
  sendList(res, await service.listLeads(req.scope, validated<ListLeadsQuery>(req, 'query')));
}

export async function get(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getLead(req.scope, idOf(req)));
}

export async function create(req: Request, res: Response): Promise<void> {
  sendData(res, await service.createLead(req.user!, req.scope, validated<CreateLeadInput>(req, 'body')), 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  sendData(res, await service.updateLead(req.user!, req.scope, idOf(req), validated<UpdateLeadInput>(req, 'body')));
}

export async function changeStatus(req: Request, res: Response): Promise<void> {
  sendData(res, await service.changeLeadStatus(req.user!, req.scope, idOf(req), validated<LeadStatusInput>(req, 'body')));
}

export async function assign(req: Request, res: Response): Promise<void> {
  const { assigneeId } = validated<{ assigneeId: string | null }>(req, 'body');
  sendData(res, await service.assignLead(req.user!, req.scope, idOf(req), assigneeId));
}

export async function listActivities(req: Request, res: Response): Promise<void> {
  sendList(res, await service.listLeadActivities(req.scope, idOf(req), validated<Pick<ListQuery, 'page' | 'limit'>>(req, 'query')));
}

export async function addActivity(req: Request, res: Response): Promise<void> {
  sendData(res, await service.addManualActivity(req.user!, req.scope, idOf(req), validated<CreateActivityInput>(req, 'body')), 201);
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.removeLead(req.user!, req.scope, idOf(req));
  res.status(204).end();
}
```

`src/modules/leads/leads.routes.ts`:
```ts
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../shared/zod';
import * as controller from './leads.controller';
import {
  activitiesQuerySchema,
  assignLeadSchema,
  createActivitySchema,
  createLeadSchema,
  leadStatusSchema,
  listLeadsQuerySchema,
  updateLeadSchema,
} from './leads.validation';

export function createLeadsRouter(): Router {
  const router = Router();
  const can = (permission: string) => authorize(permission, { branchScoped: true });
  const byId = validate({ params: idParamsSchema });
  router.use(authenticate);
  router.get('/', can('lead.read'), validate({ query: listLeadsQuerySchema }), controller.list);
  router.post('/', can('lead.create'), validate({ body: createLeadSchema }), controller.create);
  router.get('/:id', can('lead.read'), byId, controller.get);
  router.patch('/:id', can('lead.update'), validate({ params: idParamsSchema, body: updateLeadSchema }), controller.update);
  router.delete('/:id', can('lead.delete'), byId, controller.remove);
  router.patch('/:id/status', can('lead.update'), validate({ params: idParamsSchema, body: leadStatusSchema }), controller.changeStatus);
  router.patch('/:id/assign', can('lead.update'), validate({ params: idParamsSchema, body: assignLeadSchema }), controller.assign);
  router.get('/:id/activities', can('lead.read'), validate({ params: idParamsSchema, query: activitiesQuerySchema }), controller.listActivities);
  router.post('/:id/activities', can('lead.update'), validate({ params: idParamsSchema, body: createActivitySchema }), controller.addActivity);
  return router;
}
```

Lưu ý thứ tự middleware: `validate` đặt **sau** `authorize`, nên trong test 404 ở Step 1 (gửi body bất kỳ tới lead chi nhánh khác), body hợp lệ `{ name: 'X', status: 'contacted' }` qua được validate của PATCH `/:id` và `/:id/status`, và service trả 404.

Trong `src/routes/index.ts`: thêm `router.use('/leads', createLeadsRouter());`.

- [ ] **Step 4: Chạy test**

Run: `npx vitest run tests/integration/leads.test.ts`
Expected: PASS

- [ ] **Step 5: Kiểm tra toàn bộ**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: tất cả pass.

---

### Task 3: Form tư vấn công khai — `POST /public/leads`

**Files:**
- Create: `src/modules/leads/leads.public.ts`
- Modify: `src/modules/public/public.routes.ts`
- Test: `tests/integration/public-leads.test.ts`

**Interfaces:**
- Consumes: `Lead`, `LeadSubmission`, `addActivity`, `nextLeadCode`, `OPEN_STATUSES`, `Branch`, `Course`, `phoneSchema`, `utmSchema`, `createRateLimiter`.
- Produces: `publicLeadSchema`, `PublicLeadInput`, `submitPublicLead(input, ip): Promise<void>`, handler `submit(req, res)`; hằng `PHONE_DAILY_LIMIT = 3`.

- [ ] **Step 1: Viết test (failing)** — `tests/integration/public-leads.test.ts`

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { LeadActivity } from '../../src/modules/leads/lead-activity.model';
import { LeadSubmission } from '../../src/modules/leads/lead-submission.model';
import { Lead } from '../../src/modules/leads/lead.model';
import { createBranch, createCourse } from '../helpers/factories';

const form = (extra: Record<string, unknown> = {}) => ({
  name: 'Nguyễn Văn An',
  phone: '0779 666 664',
  branch: 'tan-ngai',
  courseCode: 'b',
  preferredContactTime: 'Buổi chiều (13:00–17:30)',
  note: 'Học phí trọn khóa?',
  consent: true,
  ...extra,
});

async function setup() {
  const branch = await createBranch({ name: 'Tân Ngãi', slug: 'tan-ngai' });
  const course = await createCourse({ code: 'B' });
  return { app: createApp(), branch, course };
}

describe('POST /public/leads', () => {
  it('tạo lead nguồn website, không trả thông tin khách', async () => {
    const { app, branch, course } = await setup();
    const res = await request(app)
      .post('/api/v1/public/leads')
      .send(form({ utm: { source: 'facebook', campaign: 'thang10' } }));
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ data: { received: true } });
    const lead = await Lead.findOne();
    expect(lead).toMatchObject({ phone: '0779666664', source: 'website', status: 'new', courseCode: 'B', note: 'Học phí trọn khóa?' });
    expect(lead?.branchId.toString()).toBe(branch.id);
    expect(lead?.courseId?.toString()).toBe(course.id);
    expect(lead?.utm).toMatchObject({ source: 'facebook', campaign: 'thang10' });
    expect(await LeadActivity.countDocuments({ type: 'created', byUserId: null })).toBe(1);
  });

  it('không chọn hạng bằng → courseCode null', async () => {
    const { app } = await setup();
    await request(app).post('/api/v1/public/leads').send(form({ courseCode: undefined }));
    expect((await Lead.findOne())?.courseCode).toBeNull();
  });

  it('gửi lại cùng SĐT (viết khác) khi lead còn mở → không tạo mới, thêm form_resubmit', async () => {
    const { app } = await setup();
    await request(app).post('/api/v1/public/leads').send(form());
    const again = await request(app).post('/api/v1/public/leads').send(form({ phone: '+84 779.666.664', note: 'Hỏi thêm lịch thi' }));
    expect(again.status).toBe(201);
    expect(await Lead.countDocuments()).toBe(1);
    const resubmit = await LeadActivity.findOne({ type: 'form_resubmit' });
    expect(resubmit?.content).toContain('Hỏi thêm lịch thi');
  });

  it('lead cũ đã "lost" → tạo lead mới', async () => {
    const { app } = await setup();
    await request(app).post('/api/v1/public/leads').send(form());
    await Lead.updateOne({}, { status: 'lost', lostReason: 'Không liên lạc được' });
    await request(app).post('/api/v1/public/leads').send(form());
    expect(await Lead.countDocuments()).toBe(2);
  });

  it('honeypot có giá trị → 201 nhưng không lưu gì', async () => {
    const { app } = await setup();
    const res = await request(app).post('/api/v1/public/leads').send(form({ website: 'http://spam.example' }));
    expect(res.status).toBe(201);
    expect(await Lead.countDocuments()).toBe(0);
    expect(await LeadSubmission.countDocuments()).toBe(0);
  });

  it('400: thiếu consent, SĐT sai, chi nhánh hoặc hạng bằng không tồn tại', async () => {
    const { app } = await setup();
    for (const body of [
      form({ consent: false }),
      form({ phone: '12345' }),
      form({ branch: 'khong-co' }),
      form({ courseCode: 'Z9' }),
    ]) {
      expect((await request(app).post('/api/v1/public/leads').send(body)).status).toBe(400);
    }
    expect(await Lead.countDocuments()).toBe(0);
  });

  it('chi nhánh ngừng hoạt động hoặc gói không bán → 400', async () => {
    const { app } = await setup();
    await createBranch({ slug: 'dong-cua', status: 'inactive' });
    await createCourse({ code: 'OFF', active: false });
    expect((await request(app).post('/api/v1/public/leads').send(form({ branch: 'dong-cua' }))).status).toBe(400);
    expect((await request(app).post('/api/v1/public/leads').send(form({ courseCode: 'OFF' }))).status).toBe(400);
  });

  it('tối đa 3 lần gửi/24h/SĐT → lần 4 bị 429', async () => {
    const { app } = await setup();
    for (let i = 0; i < 3; i += 1) expect((await request(app).post('/api/v1/public/leads').send(form())).status).toBe(201);
    const res = await request(app).post('/api/v1/public/leads').send(form());
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });

  it('tối đa 10 lần/giờ/IP → lần 11 bị 429', async () => {
    const { app } = await setup();
    for (let i = 0; i < 10; i += 1) {
      await request(app).post('/api/v1/public/leads').send(form({ phone: `09000000${String(i).padStart(2, '0')}` }));
    }
    const res = await request(app).post('/api/v1/public/leads').send(form({ phone: '0912345678' }));
    expect(res.status).toBe(429);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/integration/public-leads.test.ts`
Expected: FAIL — 404.

- [ ] **Step 3: Viết code**

`src/modules/leads/leads.public.ts`:
```ts
import type { Request, Response } from 'express';
import { z } from 'zod';
import { validated } from '../../middlewares/validate.middleware';
import { slugSchema } from '../../shared/zod';
import { ApiError } from '../../utils/ApiError';
import { sendData } from '../../utils/response';
import { Branch } from '../branches/branch.model';
import { Course } from '../courses/course.model';
import { phoneSchema } from '../users/users.validation';
import { LeadSubmission } from './lead-submission.model';
import { nextLeadCode } from './lead.code';
import { Lead } from './lead.model';
import { OPEN_STATUSES } from './lead.status';
import { addActivity } from './leads.activity';
import { utmSchema } from './leads.validation';

export const PHONE_DAILY_LIMIT = 3;
const DAY_MS = 86_400_000;

export const publicLeadSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: phoneSchema,
  email: z.string().trim().toLowerCase().pipe(z.email('Email không hợp lệ')).optional(),
  branch: slugSchema,
  courseCode: z.string().trim().toUpperCase().max(10).optional(),
  preferredContactTime: z.string().trim().max(100).optional(),
  note: z.string().trim().max(1000).optional(),
  consent: z.literal(true, { message: 'Bạn cần đồng ý để Gia Thịnh liên hệ tư vấn' }),
  website: z.string().max(200).optional(),
  utm: utmSchema.optional(),
});

export type PublicLeadInput = z.infer<typeof publicLeadSchema>;

function describeSubmission(input: PublicLeadInput): string {
  return [
    'Khách gửi lại form tư vấn trên website',
    input.courseCode ? `Hạng: ${input.courseCode}` : null,
    input.preferredContactTime ? `Liên hệ: ${input.preferredContactTime}` : null,
    input.note ? `Nội dung: ${input.note}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export async function submitPublicLead(input: PublicLeadInput, ip: string): Promise<void> {
  if (input.website) return;

  const recent = await LeadSubmission.countDocuments({ phone: input.phone, at: { $gt: new Date(Date.now() - DAY_MS) } });
  if (recent >= PHONE_DAILY_LIMIT) {
    throw new ApiError(429, 'RATE_LIMITED', 'Bạn đã gửi quá nhiều yêu cầu, vui lòng thử lại sau hoặc gọi hotline');
  }

  const branch = await Branch.findOne({ slug: input.branch, status: 'active' });
  if (!branch) throw ApiError.badRequest('Cơ sở không hợp lệ', [{ path: 'body.branch', message: 'Không tồn tại' }]);
  const course = input.courseCode ? await Course.findOne({ code: input.courseCode, active: true }) : null;
  if (input.courseCode && !course) {
    throw ApiError.badRequest('Hạng bằng không hợp lệ', [{ path: 'body.courseCode', message: 'Không tồn tại' }]);
  }

  await LeadSubmission.create({ phone: input.phone, ip, at: new Date() });

  const existing = await Lead.findOne({ phone: input.phone, branchId: branch._id, status: { $in: OPEN_STATUSES } }).sort({
    createdAt: -1,
  });
  if (existing) {
    await addActivity(existing.id, { type: 'form_resubmit', content: describeSubmission(input), byUserId: null });
    return;
  }

  const lead = await Lead.create({
    code: await nextLeadCode(),
    name: input.name,
    phone: input.phone,
    email: input.email ?? null,
    branchId: branch._id,
    courseId: course?._id ?? null,
    courseCode: course?.code ?? null,
    preferredContactTime: input.preferredContactTime ?? null,
    note: input.note ?? null,
    source: 'website',
    utm: input.utm ?? null,
    status: 'new',
    lastActivityAt: new Date(),
  });
  await addActivity(lead.id, { type: 'created', content: 'Khách gửi form tư vấn trên website', byUserId: null });
}

export async function submit(req: Request, res: Response): Promise<void> {
  await submitPublicLead(validated<PublicLeadInput>(req, 'body'), req.ip ?? '');
  sendData(res, { received: true }, 201);
}
```

Trong `src/modules/public/public.routes.ts` thêm:
```ts
import { createRateLimiter } from '../../middlewares/rateLimit.middleware';
import * as publicLeads from '../leads/leads.public';
// trong createPublicRouter():
const leadLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: 'Bạn đã gửi quá nhiều yêu cầu, vui lòng thử lại sau hoặc gọi hotline',
});
router.post('/leads', leadLimiter, validate({ body: publicLeadSchema }), publicLeads.submit);
```
(import `publicLeadSchema` từ `../leads/leads.public`.)

- [ ] **Step 4: Chạy test**

Run: `npx vitest run tests/integration/public-leads.test.ts`
Expected: PASS

- [ ] **Step 5: Kiểm tra toàn bộ**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: tất cả pass.

---

### Task 4: Xuất danh sách khách ra CSV — `GET /leads/export`

**Files:**
- Create: `src/modules/leads/leads.export.ts`
- Modify: `src/modules/leads/leads.routes.ts` (route `/export` **trước** `/:id`)
- Test: `tests/integration/leads-export.test.ts`

**Interfaces:**
- Consumes: `buildLeadFilter`, `leadFilterQuerySchema`, `Branch`, `User`, `formatVn`, `STATUS_LABELS`.
- Produces: `toCsvCell(value: unknown): string`, `EXPORT_LIMIT = 5000`, `exportLeadsCsv(scope, query): Promise<string>`, handler `exportCsv(req, res)`.

- [ ] **Step 1: Viết test (failing)** — `tests/integration/leads-export.test.ts`

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { toCsvCell } from '../../src/modules/leads/leads.export';
import { authHeader, createBranch, createLead, createUser } from '../helpers/factories';

describe('toCsvCell', () => {
  it('bọc nháy kép, nhân đôi nháy, vô hiệu hóa công thức', () => {
    expect(toCsvCell('An')).toBe('"An"');
    expect(toCsvCell('Nói "chào"')).toBe('"Nói ""chào"""');
    expect(toCsvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(toCsvCell('+84')).toBe('"\'+84"');
    expect(toCsvCell(null)).toBe('""');
  });
});

describe('GET /leads/export', () => {
  it('quản lý xuất CSV có BOM, tiêu đề tiếng Việt, chỉ khách chi nhánh mình, theo bộ lọc', async () => {
    const [a, b] = await Promise.all([createBranch({ name: 'Tân Ngãi' }), createBranch({ name: 'B' })]);
    const { user: manager } = await createUser({ role: 'branch_manager', branchIds: [a.id], name: 'Lê Vinh' });
    await createLead({ branchId: a.id, name: 'Khách A', status: 'contacted', assigneeId: manager.id, createdAt: new Date('2026-09-23T03:00:00Z') });
    await createLead({ branchId: a.id, name: '=cmd', status: 'new' });
    await createLead({ branchId: b.id, name: 'Khách B', status: 'contacted' });
    const res = await request(createApp()).get('/api/v1/leads/export?status=contacted').set(authHeader(manager));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv; charset=utf-8/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="khach-hang-\d{8}\.csv"/);
    expect(res.text.charCodeAt(0)).toBe(0xfeff);
    const lines = res.text.slice(1).trim().split('\r\n');
    expect(lines[0]).toBe('"Mã","Họ tên","SĐT","Email","Hạng","Chi nhánh","Nguồn","Trạng thái","Người phụ trách","Hẹn liên hệ","Ngày tạo","Ghi chú"');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"Khách A"');
    expect(lines[1]).toContain('"Tân Ngãi"');
    expect(lines[1]).toContain('"Đã liên hệ"');
    expect(lines[1]).toContain('"Lê Vinh"');
    expect(lines[1]).toContain('"23/09/2026 10:00"');
  });

  it('tư vấn viên không có quyền xuất (403)', async () => {
    const a = await createBranch();
    const { user: consultant } = await createUser({ role: 'consultant', branchIds: [a.id] });
    expect((await request(createApp()).get('/api/v1/leads/export').set(authHeader(consultant))).status).toBe(403);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/integration/leads-export.test.ts`
Expected: FAIL — module không tồn tại.

- [ ] **Step 3: Viết code** — `src/modules/leads/leads.export.ts`

```ts
import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { formatVn } from '../../shared/time';
import { Branch } from '../branches/branch.model';
import { User } from '../users/user.model';
import { Lead } from './lead.model';
import { STATUS_LABELS } from './lead.status';
import { buildLeadFilter } from './leads.service';
import type { LeadFilterQuery } from './leads.validation';

export const EXPORT_LIMIT = 5000;

const SOURCE_LABELS: Record<string, string> = {
  website: 'Website',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  zalo: 'Zalo',
  referral: 'Giới thiệu',
  walk_in: 'Tại văn phòng',
  other: 'Khác',
};

const HEADERS = ['Mã', 'Họ tên', 'SĐT', 'Email', 'Hạng', 'Chi nhánh', 'Nguồn', 'Trạng thái', 'Người phụ trách', 'Hẹn liên hệ', 'Ngày tạo', 'Ghi chú'];

export function toCsvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function exportLeadsCsv(scope: Express.BranchScope | undefined, query: LeadFilterQuery): Promise<string> {
  const leads = await Lead.find(buildLeadFilter(scope, query)).sort({ createdAt: -1, _id: -1 }).limit(EXPORT_LIMIT);
  const [branches, users] = await Promise.all([
    Branch.find({ _id: { $in: [...new Set(leads.map((lead) => lead.branchId.toString()))] } }),
    User.find({ _id: { $in: leads.flatMap((lead) => (lead.assigneeId ? [lead.assigneeId] : [])) } }),
  ]);
  const branchName = new Map(branches.map((branch) => [branch.id, branch.name]));
  const userName = new Map(users.map((user) => [user.id, user.name]));

  const rows = leads.map((lead) => [
    lead.code,
    lead.name,
    lead.phone,
    lead.email,
    lead.courseCode ?? 'Chưa xác định',
    branchName.get(lead.branchId.toString()),
    SOURCE_LABELS[lead.source] ?? lead.source,
    STATUS_LABELS[lead.status],
    lead.assigneeId ? userName.get(lead.assigneeId.toString()) : '',
    lead.nextFollowUpAt ? formatVn(lead.nextFollowUpAt, 'dd/MM/yyyy HH:mm') : '',
    formatVn(lead.createdAt, 'dd/MM/yyyy HH:mm'),
    lead.note,
  ]);

  return `﻿${[HEADERS, ...rows].map((row) => row.map(toCsvCell).join(',')).join('\r\n')}\r\n`;
}

export async function exportCsv(req: Request, res: Response): Promise<void> {
  const csv = await exportLeadsCsv(req.scope, validated<LeadFilterQuery>(req, 'query'));
  const filename = `khach-hang-${formatVn(new Date(), 'yyyyMMdd')}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csv);
}
```

Trong `src/modules/leads/leads.routes.ts`, thêm **trước** `router.get('/:id', ...)`:
```ts
router.get('/export', can('lead.export'), validate({ query: leadFilterQuerySchema }), exportCsv);
```
(import `exportCsv` từ `./leads.export`, `leadFilterQuerySchema` từ `./leads.validation`.)

- [ ] **Step 4: Chạy test**

Run: `npx vitest run tests/integration/leads-export.test.ts tests/integration/leads.test.ts`
Expected: PASS

- [ ] **Step 5: Kiểm tra toàn bộ**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: tất cả pass.

---

### Task 5: Lịch hẹn (`/appointments`) và lịch tháng

**Files:**
- Create: `src/modules/appointments/appointment.model.ts`, `appointments.validation.ts`, `appointments.service.ts`, `appointments.controller.ts`, `appointments.routes.ts`
- Modify: `src/routes/index.ts` (mount `/appointments`; route `/calendar` trước `/:id`)
- Test: `tests/integration/appointments.test.ts`

**Interfaces:**
- Consumes: `getLead`, `assertAssignee` (leads.service), `addActivity`, `getBranch`, `branchFilter`, `assertBranchAccess`, `vnMonthRange`, `formatVn`, `paginate`.
- Produces:
  - `Appointment` model (`leadId|null`, `branchId`, `startAt`, `endAt`, `durationMinutes`, `type: consult|docs|other`, `title?`, `assigneeId?`, `status: scheduled|done|cancelled|no_show`, `note?`, `createdBy`; xóa mềm).
  - `createAppointment(actor, scope, input)`, `updateAppointment(actor, scope, id, input)`, `changeAppointmentStatus(actor, scope, id, input)`, `getAppointment(scope, id)`, `listAppointments(scope, query)`, `getCalendar(scope, query)` → `{ month, items: CalendarItem[] }` (mỗi item có `date: 'yyyy-MM-dd'` giờ VN, `time: 'HH:mm'`, `lead: { id, code, name, phone } | null`, `assignee: { id, name } | null`), `removeAppointment(actor, scope, id)`, `createAppointmentsRouter()`.

- [ ] **Step 1: Viết test (failing)** — `tests/integration/appointments.test.ts`

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { LeadActivity } from '../../src/modules/leads/lead-activity.model';
import { authHeader, createBranch, createLead, createUser } from '../helpers/factories';

async function setup() {
  const [a, b] = await Promise.all([createBranch({ name: 'A' }), createBranch({ name: 'B' })]);
  const { user: consultantA } = await createUser({ role: 'consultant', branchIds: [a.id], name: 'Tư vấn A' });
  const { user: consultantB } = await createUser({ role: 'consultant', branchIds: [b.id] });
  const lead = await createLead({ branchId: a.id, name: 'Nguyễn Minh Anh', phone: '0903412869' });
  return { app: createApp(), a, b, consultantA, consultantB, lead };
}

const book = (extra: Record<string, unknown>) => ({ startAt: '2026-10-24T08:00', type: 'consult', ...extra });

describe('lịch hẹn', () => {
  it('đặt lịch cho khách: lấy chi nhánh của khách, endAt = start + 30 phút, ghi hoạt động vào khách', async () => {
    const { app, a, consultantA, lead } = await setup();
    const res = await request(app)
      .post('/api/v1/appointments')
      .set(authHeader(consultantA))
      .send(book({ leadId: lead.id, assigneeId: consultantA.id }));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      branchId: a.id,
      startAt: '2026-10-24T08:00:00+07:00',
      endAt: '2026-10-24T08:30:00+07:00',
      durationMinutes: 30,
      status: 'scheduled',
    });
    const activity = await LeadActivity.findOne({ leadId: lead._id, type: 'appointment' });
    expect(activity?.content).toBe('Hẹn tư vấn lúc 24/10/2026 08:00');
  });

  it('branchId gửi lên khác chi nhánh của khách → 400; lịch không gắn khách cho chi nhánh khác → 403', async () => {
    const { app, b, consultantA, lead } = await setup();
    expect((await request(app).post('/api/v1/appointments').set(authHeader(consultantA)).send(book({ leadId: lead.id, branchId: b.id }))).status).toBe(400);
    const other = await request(app).post('/api/v1/appointments').set(authHeader(consultantA)).send(book({ branchId: b.id, title: 'Họp' }));
    expect(other.status).toBe(403);
    expect(other.body.error.code).toBe('BRANCH_FORBIDDEN');
    expect((await request(app).post('/api/v1/appointments').set(authHeader(consultantA)).send(book({ title: 'Thiếu chi nhánh' }))).status).toBe(400);
  });

  it('tư vấn viên B không thấy/không sửa được lịch của A (404) và không đặt được lịch cho khách của A (404)', async () => {
    const { app, consultantA, consultantB, lead } = await setup();
    const { body } = await request(app).post('/api/v1/appointments').set(authHeader(consultantA)).send(book({ leadId: lead.id }));
    const id = body.data.id;
    expect((await request(app).get(`/api/v1/appointments/${id}`).set(authHeader(consultantB))).status).toBe(404);
    expect((await request(app).patch(`/api/v1/appointments/${id}`).set(authHeader(consultantB)).send({ note: 'x' })).status).toBe(404);
    expect((await request(app).post('/api/v1/appointments').set(authHeader(consultantB)).send(book({ leadId: lead.id }))).status).toBe(404);
  });

  it('cùng người phụ trách trùng giờ lịch đang "scheduled" → 409; lịch đã hủy không tính', async () => {
    const { app, a, consultantA } = await setup();
    const h = authHeader(consultantA);
    const first = await request(app).post('/api/v1/appointments').set(h).send(book({ branchId: a.id, title: 'Lịch 1', assigneeId: consultantA.id, durationMinutes: 60 }));
    expect(first.status).toBe(201);
    const clash = book({ branchId: a.id, title: 'Lịch 2', assigneeId: consultantA.id, startAt: '2026-10-24T08:30' });
    expect((await request(app).post('/api/v1/appointments').set(h).send(clash)).status).toBe(409);
    await request(app).patch(`/api/v1/appointments/${first.body.data.id}/status`).set(h).send({ status: 'cancelled' });
    expect((await request(app).post('/api/v1/appointments').set(h).send(clash)).status).toBe(201);
    const adjacent = book({ branchId: a.id, title: 'Lịch 3', assigneeId: consultantA.id, startAt: '2026-10-24T09:00' });
    expect((await request(app).post('/api/v1/appointments').set(h).send(adjacent)).status).toBe(201);
  });

  it('đổi trạng thái ghi hoạt động vào khách; dời giờ tính lại endAt và vẫn kiểm tra trùng', async () => {
    const { app, consultantA, lead } = await setup();
    const h = authHeader(consultantA);
    const { body } = await request(app).post('/api/v1/appointments').set(h).send(book({ leadId: lead.id }));
    const moved = await request(app).patch(`/api/v1/appointments/${body.data.id}`).set(h).send({ startAt: '2026-10-25T14:00', durationMinutes: 45 });
    expect(moved.body.data).toMatchObject({ startAt: '2026-10-25T14:00:00+07:00', endAt: '2026-10-25T14:45:00+07:00' });
    const done = await request(app).patch(`/api/v1/appointments/${body.data.id}/status`).set(h).send({ status: 'done', note: 'Khách đã đặt cọc' });
    expect(done.body.data.status).toBe('done');
    expect(await LeadActivity.countDocuments({ leadId: lead._id, type: 'appointment' })).toBe(3);
    expect((await request(app).patch(`/api/v1/appointments/${body.data.id}/status`).set(h).send({ status: 'done' })).status).toBe(409);
  });

  it('lịch tháng theo giờ VN: lịch 00:30 ngày 01/11 giờ VN thuộc tháng 11; chỉ chi nhánh mình', async () => {
    const { app, a, b, consultantA, lead } = await setup();
    const { user: admin } = await createUser();
    const h = authHeader(consultantA);
    await request(app).post('/api/v1/appointments').set(h).send(book({ leadId: lead.id, startAt: '2026-10-31T23:00', assigneeId: consultantA.id }));
    await request(app).post('/api/v1/appointments').set(h).send(book({ branchId: a.id, title: 'Đầu tháng 11', startAt: '2026-11-01T00:30' }));
    await request(app).post('/api/v1/appointments').set(authHeader(admin)).send(book({ branchId: b.id, title: 'Của B', startAt: '2026-10-10T08:00' }));
    const oct = await request(app).get('/api/v1/appointments/calendar?month=2026-10').set(h);
    expect(oct.status).toBe(200);
    expect(oct.body.data.month).toBe('2026-10');
    expect(oct.body.data.items).toHaveLength(1);
    expect(oct.body.data.items[0]).toMatchObject({
      date: '2026-10-31',
      time: '23:00',
      lead: { code: lead.code, name: 'Nguyễn Minh Anh', phone: '0903412869' },
      assignee: { name: 'Tư vấn A' },
    });
    const nov = await request(app).get('/api/v1/appointments/calendar?month=2026-11').set(h);
    expect(nov.body.data.items.map((x: { title: string }) => x.title)).toEqual(['Đầu tháng 11']);
    expect((await request(app).get('/api/v1/appointments/calendar?month=2026-13').set(h)).status).toBe(400);
  });

  it('danh sách lọc theo khách và khoảng ngày; xóa mềm', async () => {
    const { app, consultantA, lead } = await setup();
    const h = authHeader(consultantA);
    const { body } = await request(app).post('/api/v1/appointments').set(h).send(book({ leadId: lead.id }));
    expect((await request(app).get(`/api/v1/appointments?leadId=${lead.id}`).set(h)).body.meta.total).toBe(1);
    expect((await request(app).get('/api/v1/appointments?from=2026-10-25&to=2026-10-31').set(h)).body.meta.total).toBe(0);
    expect((await request(app).delete(`/api/v1/appointments/${body.data.id}`).set(h)).status).toBe(204);
    expect((await request(app).get(`/api/v1/appointments/${body.data.id}`).set(h)).status).toBe(404);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/integration/appointments.test.ts`
Expected: FAIL — route 404.

- [ ] **Step 3: Viết code**

`src/modules/appointments/appointment.model.ts`:
```ts
import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';
import { softDeletePlugin } from '../../shared/mongoose/softDelete';

export const APPOINTMENT_TYPES = ['consult', 'docs', 'other'] as const;
export const APPOINTMENT_STATUSES = ['scheduled', 'done', 'cancelled', 'no_show'] as const;
export type AppointmentType = (typeof APPOINTMENT_TYPES)[number];
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const TYPE_LABELS: Record<AppointmentType, string> = { consult: 'tư vấn', docs: 'làm hồ sơ', other: 'khác' };
export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Đã lên lịch',
  done: 'Hoàn thành',
  cancelled: 'Đã hủy',
  no_show: 'Khách không đến',
};

export interface IAppointment {
  leadId?: Types.ObjectId | null;
  branchId: Types.ObjectId;
  startAt: Date;
  endAt: Date;
  durationMinutes: number;
  type: AppointmentType;
  title?: string | null;
  assigneeId?: Types.ObjectId | null;
  status: AppointmentStatus;
  note?: string | null;
  createdBy: Types.ObjectId;
  deletedAt?: Date | null;
}

export type AppointmentDoc = HydratedDocument<IAppointment>;

const appointmentSchema = new Schema<IAppointment>(
  {
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', default: null },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    durationMinutes: { type: Number, required: true, min: 15, max: 480 },
    type: { type: String, enum: APPOINTMENT_TYPES, required: true },
    title: { type: String, trim: true, default: null },
    assigneeId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    status: { type: String, enum: APPOINTMENT_STATUSES, default: 'scheduled' },
    note: { type: String, trim: true, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  schemaOptions<IAppointment>(),
);

appointmentSchema.plugin(softDeletePlugin);
appointmentSchema.index({ branchId: 1, startAt: 1 });
appointmentSchema.index({ assigneeId: 1, startAt: 1 });
appointmentSchema.index({ leadId: 1 });

export const Appointment = model<IAppointment>('Appointment', appointmentSchema);
```

`src/modules/appointments/appointments.validation.ts`:
```ts
import { z } from 'zod';
import { listQuerySchema } from '../../shared/mongoose/paginate';
import { objectIdSchema, zDateOnly, zDateTime } from '../../shared/zod';
import { APPOINTMENT_STATUSES, APPOINTMENT_TYPES } from './appointment.model';

const duration = z.number().int().min(15).max(480);

export const createAppointmentSchema = z
  .object({
    leadId: objectIdSchema.optional(),
    branchId: objectIdSchema.optional(),
    startAt: zDateTime,
    durationMinutes: duration.default(30),
    type: z.enum(APPOINTMENT_TYPES),
    title: z.string().trim().min(1).max(150).optional(),
    assigneeId: objectIdSchema.optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .refine((value) => value.leadId || value.branchId, {
    path: ['branchId'],
    message: 'Cần chọn khách hàng hoặc chi nhánh',
  });

export const updateAppointmentSchema = z
  .object({
    startAt: zDateTime,
    durationMinutes: duration,
    type: z.enum(APPOINTMENT_TYPES),
    title: z.string().trim().min(1).max(150).nullable(),
    assigneeId: objectIdSchema.nullable(),
    note: z.string().trim().max(1000).nullable(),
  })
  .partial();

export const appointmentStatusSchema = z.object({
  status: z.enum(APPOINTMENT_STATUSES),
  note: z.string().trim().max(1000).optional(),
});

export const listAppointmentsQuerySchema = listQuerySchema.extend({
  from: zDateOnly.optional(),
  to: zDateOnly.optional(),
  branchId: objectIdSchema.optional(),
  assigneeId: objectIdSchema.optional(),
  leadId: objectIdSchema.optional(),
  status: z.enum(APPOINTMENT_STATUSES).optional(),
});

export const calendarQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Tháng phải có dạng YYYY-MM'),
  branchId: objectIdSchema.optional(),
  assigneeId: objectIdSchema.optional(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type AppointmentStatusInput = z.infer<typeof appointmentStatusSchema>;
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;
export type CalendarQuery = z.infer<typeof calendarQuerySchema>;
```

`src/modules/appointments/appointments.service.ts`:
```ts
import { Types, type FilterQuery } from 'mongoose';
import { assertBranchAccess, branchFilter } from '../../middlewares/authorize.middleware';
import { paginate } from '../../shared/mongoose/paginate';
import { addFixedDays, formatVn, vnMonthRange } from '../../shared/time';
import { ApiError } from '../../utils/ApiError';
import { getBranch } from '../branches/branches.service';
import { Lead } from '../leads/lead.model';
import { addActivity } from '../leads/leads.activity';
import { assertAssignee, getLead } from '../leads/leads.service';
import { User } from '../users/user.model';
import {
  Appointment,
  APPOINTMENT_STATUS_LABELS,
  TYPE_LABELS,
  type AppointmentDoc,
  type IAppointment,
} from './appointment.model';
import type {
  AppointmentStatusInput,
  CalendarQuery,
  CreateAppointmentInput,
  ListAppointmentsQuery,
  UpdateAppointmentInput,
} from './appointments.validation';

type Actor = Express.AuthUser;
type Scope = Express.BranchScope | undefined;
const MINUTE_MS = 60_000;

const endOf = (startAt: Date, minutes: number) => new Date(startAt.getTime() + minutes * MINUTE_MS);

async function assertNoOverlap(assigneeId: string | null | undefined, startAt: Date, endAt: Date, exceptId?: string): Promise<void> {
  if (!assigneeId) return;
  const clash = await Appointment.exists({
    assigneeId,
    status: 'scheduled',
    startAt: { $lt: endAt },
    endAt: { $gt: startAt },
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  });
  if (clash) throw ApiError.conflict('Người phụ trách đã có lịch hẹn trùng giờ');
}

async function logToLead(appointment: AppointmentDoc, content: string, actorId: string): Promise<void> {
  if (appointment.leadId) await addActivity(appointment.leadId.toString(), { type: 'appointment', content, byUserId: actorId });
}

export async function getAppointment(scope: Scope, id: string): Promise<AppointmentDoc> {
  const appointment = await Appointment.findOne({ $and: [{ _id: id }, branchFilter(scope)] });
  if (!appointment) throw ApiError.notFound('Không tìm thấy lịch hẹn');
  return appointment;
}

export async function createAppointment(actor: Actor, scope: Scope, input: CreateAppointmentInput): Promise<AppointmentDoc> {
  let branchId: string;
  if (input.leadId) {
    const lead = await getLead(scope, input.leadId);
    branchId = lead.branchId.toString();
    if (input.branchId && input.branchId !== branchId) {
      throw ApiError.badRequest('Lịch hẹn của khách phải thuộc chi nhánh của khách', [{ path: 'body.branchId', message: 'Không khớp' }]);
    }
  } else {
    branchId = input.branchId!;
    assertBranchAccess(scope, branchId);
    await getBranch(branchId);
  }
  if (input.assigneeId) await assertAssignee(input.assigneeId, branchId);
  const endAt = endOf(input.startAt, input.durationMinutes);
  await assertNoOverlap(input.assigneeId, input.startAt, endAt);

  const appointment = await Appointment.create({
    ...input,
    leadId: input.leadId ?? null,
    branchId,
    endAt,
    status: 'scheduled',
    createdBy: actor.id,
  });
  await logToLead(appointment, `Hẹn ${TYPE_LABELS[appointment.type]} lúc ${formatVn(appointment.startAt, 'dd/MM/yyyy HH:mm')}`, actor.id);
  return appointment;
}

export async function updateAppointment(actor: Actor, scope: Scope, id: string, input: UpdateAppointmentInput): Promise<AppointmentDoc> {
  const appointment = await getAppointment(scope, id);
  if (input.assigneeId) await assertAssignee(input.assigneeId, appointment.branchId.toString());
  const startAt = input.startAt ?? appointment.startAt;
  const durationMinutes = input.durationMinutes ?? appointment.durationMinutes;
  const endAt = endOf(startAt, durationMinutes);
  const assigneeId = input.assigneeId !== undefined ? input.assigneeId : appointment.assigneeId?.toString();
  if (appointment.status === 'scheduled') await assertNoOverlap(assigneeId, startAt, endAt, id);

  const rescheduled = startAt.getTime() !== appointment.startAt.getTime();
  appointment.set({ ...input, startAt, durationMinutes, endAt });
  await appointment.save();
  if (rescheduled) await logToLead(appointment, `Dời lịch ${TYPE_LABELS[appointment.type]} sang ${formatVn(startAt, 'dd/MM/yyyy HH:mm')}`, actor.id);
  return appointment;
}

export async function changeAppointmentStatus(actor: Actor, scope: Scope, id: string, input: AppointmentStatusInput): Promise<AppointmentDoc> {
  const appointment = await getAppointment(scope, id);
  if (appointment.status === input.status) {
    throw ApiError.conflict(`Lịch hẹn đã ở trạng thái "${APPOINTMENT_STATUS_LABELS[input.status]}"`);
  }
  if (input.status === 'scheduled') {
    await assertNoOverlap(appointment.assigneeId?.toString(), appointment.startAt, appointment.endAt, id);
  }
  appointment.status = input.status;
  if (input.note) appointment.note = input.note;
  await appointment.save();
  await logToLead(
    appointment,
    `Lịch ${TYPE_LABELS[appointment.type]} ${formatVn(appointment.startAt, 'dd/MM/yyyy HH:mm')}: ${APPOINTMENT_STATUS_LABELS[input.status]}${input.note ? ` — ${input.note}` : ''}`,
    actor.id,
  );
  return appointment;
}

function scopedFilter(scope: Scope, query: { branchId?: string; assigneeId?: string; leadId?: string; status?: string }) {
  const conditions: FilterQuery<IAppointment>[] = [branchFilter(scope)];
  if (query.branchId) {
    assertBranchAccess(scope, query.branchId);
    conditions.push({ branchId: new Types.ObjectId(query.branchId) });
  }
  if (query.assigneeId) conditions.push({ assigneeId: new Types.ObjectId(query.assigneeId) });
  if (query.leadId) conditions.push({ leadId: new Types.ObjectId(query.leadId) });
  if (query.status) conditions.push({ status: query.status });
  return conditions;
}

export async function listAppointments(scope: Scope, query: ListAppointmentsQuery) {
  const conditions = scopedFilter(scope, query);
  if (query.from || query.to) {
    conditions.push({
      startAt: {
        ...(query.from ? { $gte: query.from } : {}),
        ...(query.to ? { $lt: addFixedDays(query.to, 1) } : {}),
      },
    });
  }
  return paginate(Appointment, { $and: conditions }, query, 'startAt');
}

export async function getCalendar(scope: Scope, query: CalendarQuery) {
  const { start, end } = vnMonthRange(query.month);
  const conditions = scopedFilter(scope, query);
  conditions.push({ startAt: { $gte: start, $lt: end } });
  const appointments = await Appointment.find({ $and: conditions }).sort({ startAt: 1, _id: 1 });
  const [leads, users] = await Promise.all([
    Lead.find({ _id: { $in: appointments.flatMap((a) => (a.leadId ? [a.leadId] : [])) } }),
    User.find({ _id: { $in: appointments.flatMap((a) => (a.assigneeId ? [a.assigneeId] : [])) } }),
  ]);
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  const userById = new Map(users.map((user) => [user.id, user]));
  return {
    month: query.month,
    items: appointments.map((appointment) => {
      const lead = appointment.leadId ? leadById.get(appointment.leadId.toString()) : undefined;
      const assignee = appointment.assigneeId ? userById.get(appointment.assigneeId.toString()) : undefined;
      return {
        id: appointment.id,
        date: formatVn(appointment.startAt, 'yyyy-MM-dd'),
        time: formatVn(appointment.startAt, 'HH:mm'),
        startAt: appointment.startAt,
        endAt: appointment.endAt,
        type: appointment.type,
        title: appointment.title ?? null,
        status: appointment.status,
        branchId: appointment.branchId.toString(),
        lead: lead ? { id: lead.id, code: lead.code, name: lead.name, phone: lead.phone } : null,
        assignee: assignee ? { id: assignee.id, name: assignee.name } : null,
      };
    }),
  };
}

export async function removeAppointment(actor: Actor, scope: Scope, id: string): Promise<void> {
  const appointment = await getAppointment(scope, id);
  appointment.deletedAt = new Date();
  await appointment.save();
  await logToLead(appointment, `Xóa lịch ${TYPE_LABELS[appointment.type]} ${formatVn(appointment.startAt, 'dd/MM/yyyy HH:mm')}`, actor.id);
}
```

Kiểm tra lại số hoạt động trong test "đổi trạng thái…": tạo (1) + dời lịch (2) + done (3) = 3 ✔.

`src/modules/appointments/appointments.controller.ts`:
```ts
import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendData, sendList } from '../../utils/response';
import * as service from './appointments.service';
import type {
  AppointmentStatusInput,
  CalendarQuery,
  CreateAppointmentInput,
  ListAppointmentsQuery,
  UpdateAppointmentInput,
} from './appointments.validation';

const idOf = (req: Request) => validated<{ id: string }>(req, 'params').id;

export async function list(req: Request, res: Response): Promise<void> {
  sendList(res, await service.listAppointments(req.scope, validated<ListAppointmentsQuery>(req, 'query')));
}

export async function calendar(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getCalendar(req.scope, validated<CalendarQuery>(req, 'query')));
}

export async function get(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getAppointment(req.scope, idOf(req)));
}

export async function create(req: Request, res: Response): Promise<void> {
  sendData(res, await service.createAppointment(req.user!, req.scope, validated<CreateAppointmentInput>(req, 'body')), 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  sendData(res, await service.updateAppointment(req.user!, req.scope, idOf(req), validated<UpdateAppointmentInput>(req, 'body')));
}

export async function changeStatus(req: Request, res: Response): Promise<void> {
  sendData(res, await service.changeAppointmentStatus(req.user!, req.scope, idOf(req), validated<AppointmentStatusInput>(req, 'body')));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.removeAppointment(req.user!, req.scope, idOf(req));
  res.status(204).end();
}
```

`src/modules/appointments/appointments.routes.ts`:
```ts
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../shared/zod';
import * as controller from './appointments.controller';
import {
  appointmentStatusSchema,
  calendarQuerySchema,
  createAppointmentSchema,
  listAppointmentsQuerySchema,
  updateAppointmentSchema,
} from './appointments.validation';

export function createAppointmentsRouter(): Router {
  const router = Router();
  const can = (permission: string) => authorize(permission, { branchScoped: true });
  router.use(authenticate);
  router.get('/', can('appointment.read'), validate({ query: listAppointmentsQuerySchema }), controller.list);
  router.get('/calendar', can('appointment.read'), validate({ query: calendarQuerySchema }), controller.calendar);
  router.post('/', can('appointment.create'), validate({ body: createAppointmentSchema }), controller.create);
  router.get('/:id', can('appointment.read'), validate({ params: idParamsSchema }), controller.get);
  router.patch('/:id', can('appointment.update'), validate({ params: idParamsSchema, body: updateAppointmentSchema }), controller.update);
  router.patch('/:id/status', can('appointment.update'), validate({ params: idParamsSchema, body: appointmentStatusSchema }), controller.changeStatus);
  router.delete('/:id', can('appointment.delete'), validate({ params: idParamsSchema }), controller.remove);
  return router;
}
```

Trong `src/routes/index.ts`: thêm `router.use('/appointments', createAppointmentsRouter());`.

- [ ] **Step 4: Chạy test**

Run: `npx vitest run tests/integration/appointments.test.ts`
Expected: PASS

- [ ] **Step 5: Kiểm tra toàn bộ**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: tất cả pass.

---

### Task 6: Swagger + README

**Files:**
- Modify: `src/docs/openapi.ts`, `tests/integration/docs.test.ts`, `README.md`

- [ ] **Step 1: Thêm path vào `paths` trong `src/docs/openapi.ts`** (trước các path `/public/...`):

```ts
    '/leads': {
      get: op('CRM', 'Danh sách khách (theo chi nhánh của nhân viên)', {
        parameters: [
          ...listParams,
          ...['status', 'branchId', 'assigneeId', 'source', 'courseId', 'followUpDue', 'from', 'to'].map((name) => ({ name, in: 'query', schema: { type: 'string' } })),
        ],
      }),
      post: op('CRM', 'Tạo khách (tại quầy/điện thoại)', {
        requestBody: json({ name: 'Nguyễn Văn An', phone: '0903412869', branchId: '<branchId>', courseId: '<courseId>', source: 'walk_in' }),
      }),
    },
    '/leads/export': { get: op('CRM', 'Xuất CSV (quản lý)', { parameters: ['status', 'branchId', 'from', 'to'].map((name) => ({ name, in: 'query', schema: { type: 'string' } })) }) },
    '/leads/{id}': {
      get: op('CRM', 'Chi tiết khách', { parameters: [idParam] }),
      patch: op('CRM', 'Sửa thông tin khách', { parameters: [idParam], requestBody: json({ note: 'Hỏi lịch cuối tuần' }) }),
      delete: op('CRM', 'Xóa (mềm) khách (quản lý)', { parameters: [idParam] }),
    },
    '/leads/{id}/status': {
      patch: op('CRM', 'Chuyển trạng thái', { parameters: [idParam], requestBody: json({ status: 'lost', lostReason: 'Chọn trung tâm khác' }) }),
    },
    '/leads/{id}/assign': { patch: op('CRM', 'Phân công người phụ trách', { parameters: [idParam], requestBody: json({ assigneeId: '<userId>' }) }) },
    '/leads/{id}/activities': {
      get: op('CRM', 'Lịch sử chăm sóc', { parameters: [idParam, ...['page', 'limit'].map((name) => ({ name, in: 'query', schema: { type: 'string' } }))] }),
      post: op('CRM', 'Ghi cuộc gọi / ghi chú', { parameters: [idParam], requestBody: json({ type: 'call', content: 'Khách hẹn gọi lại', nextFollowUpAt: '2026-10-10T09:00' }) }),
    },
    '/appointments': {
      get: op('Lịch hẹn', 'Danh sách lịch hẹn', {
        parameters: [...listParams, ...['from', 'to', 'branchId', 'assigneeId', 'leadId', 'status'].map((name) => ({ name, in: 'query', schema: { type: 'string' } }))],
      }),
      post: op('Lịch hẹn', 'Đặt lịch hẹn', { requestBody: json({ leadId: '<leadId>', startAt: '2026-10-24T08:00', type: 'consult', assigneeId: '<userId>' }) }),
    },
    '/appointments/calendar': {
      get: op('Lịch hẹn', 'Lịch theo tháng', { parameters: ['month', 'branchId', 'assigneeId'].map((name) => ({ name, in: 'query', schema: { type: 'string' } })) }),
    },
    '/appointments/{id}': {
      get: op('Lịch hẹn', 'Chi tiết lịch hẹn', { parameters: [idParam] }),
      patch: op('Lịch hẹn', 'Dời lịch / đổi người phụ trách', { parameters: [idParam], requestBody: json({ startAt: '2026-10-25T14:00' }) }),
      delete: op('Lịch hẹn', 'Xóa (mềm) lịch hẹn', { parameters: [idParam] }),
    },
    '/appointments/{id}/status': {
      patch: op('Lịch hẹn', 'Đổi trạng thái lịch hẹn', { parameters: [idParam], requestBody: json({ status: 'done', note: 'Khách đã đặt cọc' }) }),
    },
    '/public/leads': {
      post: op('Công khai', 'Gửi form tư vấn', {
        requestBody: json({ name: 'Nguyễn Văn An', phone: '0779666664', branch: 'tan-ngai', courseCode: 'B', preferredContactTime: 'Buổi chiều (13:00–17:30)', consent: true }),
      }, false),
    },
```

Trong `tests/integration/docs.test.ts`, thêm vào `arrayContaining`: `'/leads'`, `'/leads/export'`, `'/leads/{id}/status'`, `'/leads/{id}/activities'`, `'/appointments'`, `'/appointments/calendar'`, `'/public/leads'`; đổi tên test thành `'/api/docs.json liệt kê endpoint đợt 1–3'`.

- [ ] **Step 2: README** — thêm sau mục "Bài viết":

```markdown
## Khách hàng (CRM) và lịch hẹn

- Form tư vấn trên website gửi `POST /api/v1/public/leads` với `branch` (slug từ `/public/branches`), `courseCode` (mã từ `/public/pricing`, bỏ trống nếu chưa chọn), `consent: true`. Trường ẩn `website` phải để trống (chống spam). Giới hạn 10 lần/giờ/IP và 3 lần/24 giờ/SĐT.
- Cùng SĐT gửi lại khi khách còn đang chăm sóc → không tạo khách mới, ghi "gửi lại form" vào lịch sử.
- Trạng thái: `new → contacted → consulted → deposited → docs_completed` (đi tiến, có thể nhảy bước); `lost` cần lý do, mở lại bằng `contacted`. "Nhập học" sẽ có ở đợt học viên.
- Nhân viên chỉ thấy khách và lịch hẹn của chi nhánh mình. Xuất CSV (`/leads/export`) và xóa khách chỉ dành cho quản lý chi nhánh / quản trị viên.
```

- [ ] **Step 3: Kiểm tra toàn bộ + build**

Run: `npm run typecheck && npm run lint && npx vitest run && npm run build`
Expected: tất cả pass, có `dist/server.js`.
