# Backend Đợt 5 — Học phí, thu tiền, công nợ quá hạn, dashboard: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mỗi học viên có sổ học phí (giá theo chi nhánh, giảm trừ, kế hoạch đóng 1 lần/theo đợt); nhân viên ghi nhận các lần thu tiền với số phiếu thu; hệ thống tự đánh dấu công nợ quá hạn; màn Tổng quan có số liệu thật (hồ sơ, học viên, lịch, phễu tuyển sinh, nguồn khách, doanh thu thực thu, tỷ lệ đậu sát hạch lần đầu).

**Architecture:** Thêm module `tuition` (sổ học phí + phiếu thu + job quá hạn) và `dashboard` (chỉ đọc, tổng hợp bằng aggregation theo giờ VN). Quy tắc tiền/trạng thái là hàm thuần trong `tuition.calc.ts` (test riêng). Sổ học phí **tự tạo khi tạo học viên** (gồm cả khi chuyển khách thành học viên). Ghi tiền dùng cập nhật có điều kiện (`$expr`) để không thu vượt. Job quá hạn chạy định kỳ trong process server (không thêm thư viện).

**Tech Stack:** giữ nguyên (Express 5, Mongoose 8, zod 4, Vitest + Supertest + mongodb-memory-server). Không thêm thư viện.

**Spec:** `docs/superpowers/specs/2026-10-03-backend-api-design.md` — mục 6 "Tài chính" (`tuitionAccounts`, `payments`), 7 (`tuition`, `dashboard`), 9 (audit cho thêm/xóa payment), 10 (test sổ học phí, dashboard theo giờ VN), 12 đợt 5.

## Global Constraints

- Mọi lệnh chạy trong `back-end/`. **KHÔNG commit, KHÔNG stage. Không chạy prettier cho cả project** (chỉ file mình tạo/sửa). Kiểm tra: `npm run typecheck && npm run lint && npx vitest run`.
- Dùng lại hạ tầng có sẵn (xem `.superpowers/sdd/2026-10-04-backend-dot-4-dao-tao/context-notes.md`): `authorize(..., { branchScoped: true })`, `branchFilter`, `assertBranchAccess`, `validate/validated`, `paginate/listQuerySchema/sortSchema`, `atLeastOneField`, `objectIdSchema/idParamsSchema/zDateOnly/zDateTime`, `nextDailyCode`, `startOfVnDay`, `formatVn`, `vnMonthRange`, `addFixedDays`, `recordAudit/snapshot`, `logger`, `Student`, `Lead`, `LeadActivity`, `Appointment`, `ExamSession`, `ExamCandidate`, `Course`, `getBranch`.
- **Tiền là số nguyên đồng**, không âm, ≤ 1.000.000.000. Không thu vượt số còn phải đóng.
- Quyền (`src/config/roles.ts`, **không thêm quyền cho vai trò nào**): branch_manager có `tuition.*` và `dashboard.read`; consultant có `tuition.read` và `dashboard.read`; super_admin `*`. Hủy phiếu thu dùng quyền `payment.void` — **chỉ super_admin có** (qua `*`). instructor/editor không có quyền tài chính/dashboard.
- Mọi route dùng `branchScoped: true`: dữ liệu chi nhánh khác → 404 khi đọc theo id, 403 `BRANCH_FORBIDDEN` khi ghi; dashboard chỉ tổng hợp trong chi nhánh của người gọi (tham số `branchId` phải thuộc phạm vi).
- Mốc thời gian theo **giờ VN (+07:00)**: "hôm nay", tuần (Thứ 2 → Chủ nhật), tháng `YYYY-MM`; aggregation dùng `timezone: '+07:00'`.
- Ghi audit: tạo/sửa sổ học phí, thu tiền, hủy phiếu thu.
- Response/lỗi chuẩn như các đợt trước, message tiếng Việt.

### Quyết định thiết kế trong đợt này (chi tiết hóa spec)
- **Trạng thái sổ:** `paid` (đã thu đủ) | `partial` (đang đóng, kể cả chưa đóng đồng nào nhưng chưa tới hạn) | `overdue` (đã qua hạn một đợt mà tổng đã thu < tổng các đợt đến hạn). Đợt có hạn **hôm nay** chưa tính quá hạn (hết ngày mới tính).
- **Tạo sổ tự động** khi tạo học viên: `listPrice` = giá cuối của gói tại chi nhánh (giá riêng nếu có, không thì mặc định — dùng lại bộ tính giá đợt 2), giảm trừ rỗng, kế hoạch `one_time`, 1 đợt có hạn = ngày nhập học + 14 ngày. Học viên tạo trước đợt này: tạo bù bằng `POST /tuition { studentId }`.
- **Giảm trừ** (`discounts[{ label, amount }]`, vd HSSV) nhập tay khi sửa sổ; `total = max(0, listPrice − Σ giảm trừ)`; không cho `total` nhỏ hơn số đã thu.
- **Kế hoạch theo đợt:** các đợt có ngày hạn tăng dần, mỗi đợt > 0, tổng các đợt = `total`. Với `one_time`, sửa giảm trừ thì đợt duy nhất tự cập nhật số tiền.
- **Phiếu thu** (`payments`): số phiếu `PT-yyMMdd-NN`; lưu thêm `studentId`, `branchId`, `courseCode` để báo cáo nhanh. **Hủy phiếu thu là hủy mềm** (`voidedAt`, `voidedBy`, `voidReason`) qua `DELETE /tuition/:id/payments/:paymentId` — giữ bản ghi để đối soát; số đã thu giảm tương ứng.
- **`paidAmount` lưu sẵn trên sổ** (cập nhật bằng `$inc` có điều kiện) để lọc/sắp xếp nhanh; nguồn sự thật vẫn là các phiếu chưa hủy.
- **Job quá hạn** chạy khi server khởi động (sau 5 giây) và mỗi 60 phút, idempotent; ngoài ra trạng thái được tính lại ngay khi thu tiền/hủy phiếu/sửa sổ.
- **Xóa học viên:** sổ chưa có phiếu thu nào (kể cả đã hủy) bị xóa theo; sổ đã có phiếu thu được giữ để đối soát. Chuyển khách thất bại (bù trừ) cũng xóa sổ vừa tạo.
- **Dashboard** (tất cả theo chi nhánh trong phạm vi): `summary`, `registrations?days=7`, `funnel?month=`, `sources?month=`, `revenue?months=12`, `pass-rate?months=12`.
  - Phễu: khách **tạo trong tháng**, đếm số khách **đã từng đạt** từng mốc (`new` → `contacted` → `consulted` → `deposited` → `docs_completed` → `enrolled`), dựa trên trạng thái hiện tại và lịch sử `status_change`.
  - Doanh thu = **thực thu** (tổng phiếu chưa hủy theo tháng `paidAt`), kèm cơ cấu theo hạng. Chưa có "chỉ tiêu" (target) — màn admin hiện có cột target sẽ cần dữ liệu ở đợt sau.
  - Tỷ lệ đậu = đậu/(đậu+trượt) của thí sinh **lần thi đầu (`attempt = 1`)**, ca **sát hạch** (`official`) không hủy, ngày thi trong khoảng; theo hạng.

## Review Focus

1. Hai phiếu thu đồng thời cho sổ còn 1.000.000đ, mỗi phiếu 800.000đ → đúng một phiếu thành công, một bị 409; `paidAmount` không vượt `total` (Task 3).
2. Đợt có hạn hôm nay chưa đóng → `partial`; qua 00:00 giờ VN ngày hôm sau → job đổi sang `overdue` (Task 1, Task 4).
3. Quản lý chi nhánh A gọi `GET /tuition/:id`, thu tiền vào sổ chi nhánh B → 404; `GET /dashboard/summary?branchId=<B>` → 403 (Task 2, 3, 5).
4. Khách tạo lúc 23:30 ngày 30/09 giờ VN được tính vào tháng 09, không phải tháng 10 (Task 5).
5. Quản lý chi nhánh (có `tuition.*`) **không** hủy được phiếu thu → 403; chỉ super_admin hủy được (Task 3).

---

## File Structure

```
back-end/src/
├── shared/time.ts                         # + vnMonthKey, shiftMonth, vnWeekRange
├── modules/pricing/pricing.service.ts     # + resolveCoursePrice(branchId, courseId)
├── modules/tuition/
│   ├── tuition.calc.ts                    # hàm thuần: tổng tiền, kiểm tra đợt, trạng thái
│   ├── tuition-account.model.ts  payment.model.ts
│   ├── tuition.validation.ts  tuition.service.ts  payments.service.ts  tuition.job.ts
│   ├── tuition.controller.ts  tuition.routes.ts
├── modules/students/students.service.ts   # createStudent tạo sổ; removeStudent dọn sổ chưa thu
├── modules/leads/leads.convert.ts         # bù trừ xóa cả sổ
├── modules/dashboard/
│   ├── dashboard.validation.ts  dashboard.service.ts  dashboard.finance.ts
│   ├── dashboard.controller.ts  dashboard.routes.ts
├── jobs/index.ts                          # startJobs / stopJobs
├── server.ts                              # gọi startJobs sau listen, stopJobs khi tắt
├── routes/index.ts                        # + /tuition, /dashboard
└── docs/openapi.ts
back-end/tests/
├── unit/tuition-calc.test.ts  unit/time-calendar.test.ts
└── integration/tuition.test.ts payments.test.ts tuition-job.test.ts dashboard.test.ts dashboard-finance.test.ts
```

---

### Task 1: Hàm thuần học phí + mốc thời gian lịch VN

**Files:**
- Create: `src/modules/tuition/tuition.calc.ts`
- Modify: `src/shared/time.ts`
- Test: `tests/unit/tuition-calc.test.ts`, `tests/unit/time-calendar.test.ts`

**Interfaces:**
- Produces:
  - `type Installment = { dueDate: Date; amount: number }`, `type Discount = { label: string; amount: number }`, `type TuitionStatus = 'paid' | 'partial' | 'overdue'`.
  - `computeTotal(listPrice: number, discounts: Discount[]): number` (không âm).
  - `installmentsError(installments: Installment[], total: number): string | null` (null = hợp lệ).
  - `amountDueBefore(installments, cutoff: Date): number` (tổng các đợt có `dueDate < cutoff`).
  - `computeTuitionStatus(input: { total: number; paid: number; installments: Installment[] }, today: Date): TuitionStatus` (`today` = 00:00 giờ VN hôm nay).
  - `nextDue(installments, paid): { dueDate: Date; amount: number } | null` (đợt đầu tiên chưa được trả đủ, `amount` = phần còn thiếu của đợt đó).
  - `vnMonthKey(date: Date): string` (`YYYY-MM` giờ VN), `shiftMonth(month: string, delta: number): string`, `vnWeekRange(date?: Date): { start: Date; end: Date }` (Thứ 2 00:00 → Thứ 2 tuần sau, giờ VN).

- [ ] **Step 1: Viết test (failing)**

`tests/unit/tuition-calc.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  amountDueBefore,
  computeTotal,
  computeTuitionStatus,
  installmentsError,
  nextDue,
} from '../../src/modules/tuition/tuition.calc';
import { parseDateOnly } from '../../src/shared/time';

const d = parseDateOnly;
const plan = [
  { dueDate: d('2026-10-01'), amount: 5_500_000 },
  { dueDate: d('2026-10-15'), amount: 5_500_000 },
  { dueDate: d('2026-11-01'), amount: 5_500_000 },
];

describe('computeTotal', () => {
  it('trừ giảm trừ, không âm', () => {
    expect(computeTotal(16_500_000, [{ label: 'HSSV', amount: 1_000_000 }])).toBe(15_500_000);
    expect(computeTotal(500_000, [{ label: 'X', amount: 900_000 }])).toBe(0);
  });
});

describe('installmentsError', () => {
  it('hợp lệ khi tổng = total, số tiền > 0, ngày tăng dần', () => {
    expect(installmentsError(plan, 16_500_000)).toBeNull();
  });
  it.each([
    [[{ dueDate: d('2026-10-01'), amount: 1 }], 2, 'Tổng các đợt'],
    [[{ dueDate: d('2026-10-01'), amount: 0 }, { dueDate: d('2026-10-02'), amount: 2 }], 2, 'lớn hơn 0'],
    [[{ dueDate: d('2026-10-02'), amount: 1 }, { dueDate: d('2026-10-01'), amount: 1 }], 2, 'tăng dần'],
    [[], 0, 'ít nhất một đợt'],
  ])('báo lỗi %#', (items, total, message) => {
    expect(installmentsError(items, total)).toContain(message);
  });
});

describe('trạng thái', () => {
  it('paid khi thu đủ; partial khi chưa tới hạn; overdue khi đã qua hạn mà thiếu', () => {
    expect(computeTuitionStatus({ total: 16_500_000, paid: 16_500_000, installments: plan }, d('2026-12-01'))).toBe('paid');
    expect(computeTuitionStatus({ total: 16_500_000, paid: 0, installments: plan }, d('2026-10-01'))).toBe('partial');
    expect(computeTuitionStatus({ total: 16_500_000, paid: 0, installments: plan }, d('2026-10-02'))).toBe('overdue');
    expect(computeTuitionStatus({ total: 16_500_000, paid: 5_500_000, installments: plan }, d('2026-10-15'))).toBe('partial');
    expect(computeTuitionStatus({ total: 16_500_000, paid: 5_500_000, installments: plan }, d('2026-10-16'))).toBe('overdue');
  });

  it('amountDueBefore và nextDue', () => {
    expect(amountDueBefore(plan, d('2026-10-16'))).toBe(11_000_000);
    expect(nextDue(plan, 0)).toEqual({ dueDate: d('2026-10-01'), amount: 5_500_000 });
    expect(nextDue(plan, 7_000_000)).toEqual({ dueDate: d('2026-10-15'), amount: 4_000_000 });
    expect(nextDue(plan, 16_500_000)).toBeNull();
  });
});
```

`tests/unit/time-calendar.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { shiftMonth, vnMonthKey, vnWeekRange } from '../../src/shared/time';

describe('lịch VN', () => {
  it('vnMonthKey theo giờ VN', () => {
    expect(vnMonthKey(new Date('2026-09-30T16:30:00Z'))).toBe('2026-09');
    expect(vnMonthKey(new Date('2026-09-30T17:00:00Z'))).toBe('2026-10');
  });

  it('shiftMonth qua năm', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-10', -11)).toBe('2025-11');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('vnWeekRange: Thứ 2 → Thứ 2 tuần sau, giờ VN', () => {
    const sunday = vnWeekRange(new Date('2026-10-04T10:00:00Z')); // CN 04/10 17:00 VN
    expect(sunday.start.toISOString()).toBe('2026-09-27T17:00:00.000Z'); // T2 28/09 00:00 VN
    expect(sunday.end.toISOString()).toBe('2026-10-04T17:00:00.000Z');
    const monday = vnWeekRange(new Date('2026-10-04T17:30:00Z')); // T2 05/10 00:30 VN
    expect(monday.start.toISOString()).toBe('2026-10-04T17:00:00.000Z');
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/unit/tuition-calc.test.ts tests/unit/time-calendar.test.ts`
Expected: FAIL — module/export không tồn tại.

- [ ] **Step 3: Viết code**

`src/modules/tuition/tuition.calc.ts`:
```ts
export type Installment = { dueDate: Date; amount: number };
export type Discount = { label: string; amount: number };
export type TuitionStatus = 'paid' | 'partial' | 'overdue';

export function computeTotal(listPrice: number, discounts: Discount[]): number {
  return Math.max(0, listPrice - discounts.reduce((sum, discount) => sum + discount.amount, 0));
}

export function installmentsError(installments: Installment[], total: number): string | null {
  if (installments.length === 0) return 'Cần ít nhất một đợt đóng';
  if (installments.some((item) => item.amount <= 0)) return 'Số tiền mỗi đợt phải lớn hơn 0';
  for (let i = 1; i < installments.length; i += 1) {
    if (installments[i]!.dueDate.getTime() <= installments[i - 1]!.dueDate.getTime()) {
      return 'Ngày hạn các đợt phải tăng dần';
    }
  }
  const sum = installments.reduce((acc, item) => acc + item.amount, 0);
  if (sum !== total) return `Tổng các đợt (${sum}) phải bằng tổng học phí (${total})`;
  return null;
}

export function amountDueBefore(installments: Installment[], cutoff: Date): number {
  return installments.filter((item) => item.dueDate.getTime() < cutoff.getTime()).reduce((sum, item) => sum + item.amount, 0);
}

export function computeTuitionStatus(input: { total: number; paid: number; installments: Installment[] }, today: Date): TuitionStatus {
  if (input.paid >= input.total) return 'paid';
  return input.paid < amountDueBefore(input.installments, today) ? 'overdue' : 'partial';
}

export function nextDue(installments: Installment[], paid: number): { dueDate: Date; amount: number } | null {
  let covered = paid;
  for (const item of installments) {
    if (covered >= item.amount) {
      covered -= item.amount;
      continue;
    }
    return { dueDate: item.dueDate, amount: item.amount - covered };
  }
  return null;
}
```

Thêm vào cuối `src/shared/time.ts`:
```ts
export function vnMonthKey(date: Date): string {
  return formatInTimeZone(date, VN_OFFSET, 'yyyy-MM');
}

export function shiftMonth(month: string, delta: number): string {
  const index = Number(month.slice(0, 4)) * 12 + (Number(month.slice(5, 7)) - 1) + delta;
  const year = Math.floor(index / 12);
  return `${year}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export function vnWeekRange(date: Date = new Date()): { start: Date; end: Date } {
  const dayStart = startOfVnDay(date);
  const isoWeekday = Number(formatInTimeZone(date, VN_OFFSET, 'i')); // 1 = Thứ 2 … 7 = Chủ nhật
  const start = addFixedDays(dayStart, -(isoWeekday - 1));
  return { start, end: addFixedDays(start, 7) };
}
```
(`startOfVnDay` và `addFixedDays` đã có trong file; đặt các hàm mới sau định nghĩa của chúng.)

- [ ] **Step 4: Chạy test**

Run: `npx vitest run tests/unit/tuition-calc.test.ts tests/unit/time-calendar.test.ts`
Expected: PASS

- [ ] **Step 5: Kiểm tra toàn bộ**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: tất cả pass.

---

### Task 2: Sổ học phí (`/tuition`) — tự tạo, tạo bù, xem, sửa kế hoạch

**Files:**
- Create: `src/modules/tuition/tuition-account.model.ts`, `payment.model.ts` (model dùng chung với Task 3), `tuition.validation.ts`, `tuition.service.ts`, `tuition.controller.ts`, `tuition.routes.ts`
- Modify: `src/modules/pricing/pricing.service.ts` (export `resolveCoursePrice`), `src/modules/students/students.service.ts` (`createStudent` tạo sổ; `removeStudent` xóa sổ chưa có phiếu), `src/modules/leads/leads.convert.ts` (bù trừ xóa sổ), `src/routes/index.ts`
- Test: `tests/integration/tuition.test.ts`

**Interfaces:**
- Consumes: Task 1, `resolveFor` (nội bộ pricing.service), `Student`, `branchFilter`, `assertBranchAccess`, `startOfVnDay`, `addFixedDays`.
- Produces:
  - `TuitionAccount` model (`studentId` unique, `courseId`, `courseCode`, `branchId`, `listPrice`, `priceNote|null`, `discounts[]`, `total`, `plan: one_time|installments`, `installments[]`, `paidAmount`, `status`, `lastPaymentAt|null`, `note|null`), `TuitionAccountDoc`, `TUITION_STATUSES`, `DEFAULT_DUE_DAYS = 14`.
  - `Payment` model (`tuitionAccountId`, `studentId`, `branchId`, `courseCode`, `amount`, `method: cash|transfer`, `paidAt`, `receivedBy`, `receiptNo` unique, `note|null`, `voidedAt|null`, `voidedBy|null`, `voidReason|null`), `PaymentDoc`, `PAYMENT_METHODS`.
  - `resolveCoursePrice(branchId, courseId): Promise<{ price: number; priceNote: string | null }>`.
  - Service: `createAccountForStudent(student: StudentDoc): Promise<TuitionAccountDoc>` (idempotent), `getAccountDoc(scope, id)`, `getAccount(scope, id)` (kèm `student`, `remaining`, `nextDue`, `payments`), `listAccounts(scope, query)`, `backfillAccount(actor, scope, studentId)`, `updateAccount(actor, scope, id, input)`, `refreshAccountStatus(account, now?)`.
  - `createTuitionRouter()`.

- [ ] **Step 1: Viết test (failing)** — `tests/integration/tuition.test.ts`

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { PriceOverride } from '../../src/modules/pricing/price-override.model';
import { Student } from '../../src/modules/students/student.model';
import { TuitionAccount } from '../../src/modules/tuition/tuition-account.model';
import { authHeader, createBranch, createCourse, createLead, createUser } from '../helpers/factories';

async function setup() {
  const [a, b] = await Promise.all([createBranch({ name: 'A' }), createBranch({ name: 'Vũng Liêm' })]);
  const course = await createCourse({ code: 'A', defaultPrice: 1_750_000 });
  await PriceOverride.create({ branchId: b._id, courseId: course._id, price: 1_595_000 });
  const { user: managerA } = await createUser({ role: 'branch_manager', branchIds: [a.id] });
  const { user: consultantA } = await createUser({ role: 'consultant', branchIds: [a.id] });
  const { user: admin } = await createUser();
  return { app: createApp(), a, b, course, managerA, consultantA, admin };
}

async function newStudent(app: ReturnType<typeof createApp>, user: Parameters<typeof authHeader>[0], branchId: string, courseId: string) {
  const res = await request(app)
    .post('/api/v1/students')
    .set(authHeader(user))
    .send({ name: 'Nguyễn Minh Anh', phone: '0903412869', courseId, branchId, enrolledAt: '2026-10-01' });
  return res.body.data as { id: string; code: string };
}

describe('sổ học phí', () => {
  it('tạo học viên → tự tạo sổ: giá theo chi nhánh, 1 đợt hạn nhập học + 14 ngày, trạng thái tính theo ngày', async () => {
    const { app, a, b, course, consultantA, admin } = await setup();
    const sa = await newStudent(app, consultantA, a.id, course.id);
    const sb = await newStudent(app, admin, b.id, course.id);
    const accA = await TuitionAccount.findOne({ studentId: sa.id });
    const accB = await TuitionAccount.findOne({ studentId: sb.id });
    expect(accA).toMatchObject({ listPrice: 1_750_000, total: 1_750_000, paidAmount: 0, plan: 'one_time', courseCode: 'A' });
    expect(accB?.listPrice).toBe(1_595_000);
    expect(accA?.installments).toHaveLength(1);
    expect(accA?.installments[0]?.dueDate.toISOString()).toBe('2026-10-14T17:00:00.000Z'); // 15/10/2026 00:00 VN
  });

  it('chi tiết: kèm học viên, còn phải đóng, đợt tiếp theo; tư vấn viên xem được nhưng không sửa được', async () => {
    const { app, a, course, consultantA } = await setup();
    const student = await newStudent(app, consultantA, a.id, course.id);
    const account = await TuitionAccount.findOne({ studentId: student.id });
    const res = await request(app).get(`/api/v1/tuition/${account!.id}`).set(authHeader(consultantA));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      student: { id: student.id, code: student.code, name: 'Nguyễn Minh Anh', phone: '0903412869' },
      remaining: 1_750_000,
      nextDue: { dueDate: '2026-10-15T00:00:00+07:00', amount: 1_750_000 },
      payments: [],
    });
    expect((await request(app).patch(`/api/v1/tuition/${account!.id}`).set(authHeader(consultantA)).send({ note: 'x' })).status).toBe(403);
  });

  it('sửa: giảm trừ HSSV cập nhật total và đợt duy nhất; chia 3 đợt phải đủ tổng; có audit', async () => {
    const { app, a, managerA } = await setup();
    const courseB = await createCourse({ code: 'B', defaultPrice: 16_500_000 });
    const student = await newStudent(app, managerA, a.id, courseB.id);
    const account = await TuitionAccount.findOne({ studentId: student.id });
    const url = `/api/v1/tuition/${account!.id}`;
    const h = authHeader(managerA);
    const discounted = await request(app).patch(url).set(h).send({ discounts: [{ label: 'HSSV', amount: 1_000_000 }] });
    expect(discounted.body.data).toMatchObject({ total: 15_500_000, installments: [{ amount: 15_500_000 }] });
    const wrong = await request(app)
      .patch(url)
      .set(h)
      .send({ plan: 'installments', installments: [{ dueDate: '2026-10-10', amount: 5_000_000 }, { dueDate: '2026-11-10', amount: 5_000_000 }] });
    expect(wrong.status).toBe(400);
    const split = await request(app)
      .patch(url)
      .set(h)
      .send({
        plan: 'installments',
        installments: [
          { dueDate: '2026-10-10', amount: 5_500_000 },
          { dueDate: '2026-10-25', amount: 5_000_000 },
          { dueDate: '2026-11-10', amount: 5_000_000 },
        ],
      });
    expect(split.status).toBe(200);
    expect(split.body.data.installments).toHaveLength(3);
    expect(await AuditLog.countDocuments({ action: 'tuition.update' })).toBe(2);
  });

  it('danh sách: lọc trạng thái, tìm theo tên/mã/SĐT học viên; chỉ chi nhánh mình; chi nhánh khác 404', async () => {
    const { app, a, b, course, managerA, admin } = await setup();
    await newStudent(app, managerA, a.id, course.id);
    const other = await newStudent(app, admin, b.id, course.id);
    await TuitionAccount.updateOne({ studentId: other.id }, { status: 'overdue' });
    const h = authHeader(managerA);
    const list = await request(app).get('/api/v1/tuition').set(h);
    expect(list.body.meta.total).toBe(1);
    expect(list.body.data[0]).toMatchObject({ remaining: 1_750_000, student: { name: 'Nguyễn Minh Anh' } });
    expect((await request(app).get('/api/v1/tuition?q=0903412869').set(h)).body.meta.total).toBe(1);
    expect((await request(app).get('/api/v1/tuition?status=overdue').set(h)).body.meta.total).toBe(0);
    const foreign = await TuitionAccount.findOne({ studentId: other.id });
    expect((await request(app).get(`/api/v1/tuition/${foreign!.id}`).set(h)).status).toBe(404);
  });

  it('tạo bù cho học viên chưa có sổ; đã có → 409', async () => {
    const { app, a, course, managerA } = await setup();
    const student = await Student.create({
      code: 'HV-CU-01', name: 'Học viên cũ', phone: '0911000000', courseId: course._id, courseCode: 'A',
      branchId: a._id, classId: null, status: 'studying', enrolledAt: new Date('2026-09-01T00:00:00+07:00'),
    });
    const h = authHeader(managerA);
    const created = await request(app).post('/api/v1/tuition').set(h).send({ studentId: student.id });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ total: 1_750_000, status: 'overdue' });
    expect((await request(app).post('/api/v1/tuition').set(h).send({ studentId: student.id })).status).toBe(409);
  });

  it('chuyển khách thành học viên cũng tạo sổ; xóa học viên chưa thu đồng nào thì xóa sổ', async () => {
    const { app, a, course, managerA } = await setup();
    const lead = await createLead({ branchId: a.id, status: 'deposited' });
    const converted = await request(app).post(`/api/v1/leads/${lead.id}/convert`).set(authHeader(managerA)).send({ courseId: course.id });
    const studentId = converted.body.data.student.id;
    expect(await TuitionAccount.countDocuments({ studentId })).toBe(1);
    await request(app).delete(`/api/v1/students/${studentId}`).set(authHeader(managerA));
    expect(await TuitionAccount.countDocuments({ studentId })).toBe(0);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/integration/tuition.test.ts`
Expected: FAIL — module không tồn tại.

- [ ] **Step 3: Viết code**

`src/modules/tuition/tuition-account.model.ts`:
```ts
import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';
import type { Discount, Installment, TuitionStatus } from './tuition.calc';

export const TUITION_STATUSES = ['paid', 'partial', 'overdue'] as const;
export const TUITION_PLANS = ['one_time', 'installments'] as const;
export const DEFAULT_DUE_DAYS = 14;

export interface ITuitionAccount {
  studentId: Types.ObjectId;
  courseId: Types.ObjectId;
  courseCode: string;
  branchId: Types.ObjectId;
  listPrice: number;
  priceNote: string | null;
  discounts: Discount[];
  total: number;
  plan: (typeof TUITION_PLANS)[number];
  installments: Installment[];
  paidAmount: number;
  status: TuitionStatus;
  lastPaymentAt: Date | null;
  note: string | null;
}

export type TuitionAccountDoc = HydratedDocument<ITuitionAccount>;

const tuitionAccountSchema = new Schema<ITuitionAccount>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, unique: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    courseCode: { type: String, required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    listPrice: { type: Number, required: true, min: 0 },
    priceNote: { type: String, default: null },
    discounts: { type: [new Schema<Discount>({ label: { type: String, required: true }, amount: { type: Number, required: true, min: 0 } }, { _id: false })], default: [] },
    total: { type: Number, required: true, min: 0 },
    plan: { type: String, enum: TUITION_PLANS, default: 'one_time' },
    installments: { type: [new Schema<Installment>({ dueDate: { type: Date, required: true }, amount: { type: Number, required: true, min: 1 } }, { _id: false })], default: [] },
    paidAmount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: TUITION_STATUSES, default: 'partial' },
    lastPaymentAt: { type: Date, default: null },
    note: { type: String, default: null },
  },
  schemaOptions<ITuitionAccount>(),
);

tuitionAccountSchema.index({ branchId: 1, status: 1 });

export const TuitionAccount = model<ITuitionAccount>('TuitionAccount', tuitionAccountSchema);
```

`src/modules/tuition/payment.model.ts`:
```ts
import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';

export const PAYMENT_METHODS = ['cash', 'transfer'] as const;

export interface IPayment {
  tuitionAccountId: Types.ObjectId;
  studentId: Types.ObjectId;
  branchId: Types.ObjectId;
  courseCode: string;
  amount: number;
  method: (typeof PAYMENT_METHODS)[number];
  paidAt: Date;
  receivedBy: Types.ObjectId;
  receiptNo: string;
  note: string | null;
  voidedAt: Date | null;
  voidedBy: Types.ObjectId | null;
  voidReason: string | null;
}

export type PaymentDoc = HydratedDocument<IPayment>;

const paymentSchema = new Schema<IPayment>(
  {
    tuitionAccountId: { type: Schema.Types.ObjectId, ref: 'TuitionAccount', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    courseCode: { type: String, required: true },
    amount: { type: Number, required: true, min: 1 },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    paidAt: { type: Date, required: true },
    receivedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    receiptNo: { type: String, required: true, unique: true },
    note: { type: String, default: null },
    voidedAt: { type: Date, default: null },
    voidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    voidReason: { type: String, default: null },
  },
  schemaOptions<IPayment>(),
);

paymentSchema.index({ tuitionAccountId: 1, paidAt: -1 });
paymentSchema.index({ branchId: 1, paidAt: -1 });

export const Payment = model<IPayment>('Payment', paymentSchema);
```

Thêm vào `src/modules/pricing/pricing.service.ts` (sau `resolveFor`):
```ts
export async function resolveCoursePrice(branchId: string, courseId: string): Promise<{ price: number; priceNote: string | null }> {
  const resolved = (await resolveFor([branchId])).get(branchId)?.find((course) => course.id === courseId);
  if (resolved) return { price: resolved.price, priceNote: resolved.priceNote };
  const course = await Course.findOne({ _id: courseId, ...WITH_DELETED });
  return { price: course?.defaultPrice ?? 0, priceNote: course?.priceNote ?? null };
}
```
(import `WITH_DELETED` nếu file chưa có; gói ngừng bán không có trong bộ tính giá nên dùng giá mặc định.)

`src/modules/tuition/tuition.validation.ts`:
```ts
import { z } from 'zod';
import { listQuerySchema, sortSchema } from '../../shared/mongoose/paginate';
import { atLeastOneField, objectIdSchema, zDateOnly } from '../../shared/zod';
import { moneySchema } from '../courses/courses.validation';
import { TUITION_PLANS, TUITION_STATUSES } from './tuition-account.model';

const discountSchema = z.object({ label: z.string().trim().min(1).max(100), amount: moneySchema });
const installmentSchema = z.object({ dueDate: zDateOnly, amount: moneySchema });

export const backfillSchema = z.object({ studentId: objectIdSchema });

export const updateAccountSchema = atLeastOneField(
  z
    .object({
      discounts: z.array(discountSchema).max(10),
      plan: z.enum(TUITION_PLANS),
      installments: z.array(installmentSchema).min(1).max(12),
      note: z.string().trim().max(500).nullable(),
    })
    .partial(),
);

export const listAccountsQuerySchema = listQuerySchema.extend({
  status: z.enum(TUITION_STATUSES).optional(),
  branchId: objectIdSchema.optional(),
  courseId: objectIdSchema.optional(),
  sort: sortSchema(['createdAt', 'updatedAt', 'total', 'paidAmount', 'status', 'lastPaymentAt']),
});

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type ListAccountsQuery = z.infer<typeof listAccountsQuerySchema>;
```

`src/modules/tuition/tuition.service.ts`:
```ts
import { Types, type FilterQuery } from 'mongoose';
import { assertBranchAccess, branchFilter } from '../../middlewares/authorize.middleware';
import { paginate } from '../../shared/mongoose/paginate';
import { WITH_DELETED } from '../../shared/mongoose/softDelete';
import { addFixedDays, startOfVnDay } from '../../shared/time';
import { ApiError } from '../../utils/ApiError';
import { normalizePhone } from '../../utils/phone';
import { escapeRegex } from '../../utils/regex';
import { recordAudit, snapshot } from '../audit/audit.service';
import { resolveCoursePrice } from '../pricing/pricing.service';
import { Student, type StudentDoc } from '../students/student.model';
import { Payment } from './payment.model';
import { computeTotal, computeTuitionStatus, installmentsError, nextDue } from './tuition.calc';
import { DEFAULT_DUE_DAYS, TuitionAccount, type ITuitionAccount, type TuitionAccountDoc } from './tuition-account.model';
import type { ListAccountsQuery, UpdateAccountInput } from './tuition.validation';

type Actor = Express.AuthUser;
type Scope = Express.BranchScope | undefined;

export function applyStatus(account: TuitionAccountDoc, now: Date = new Date()): void {
  account.status = computeTuitionStatus(
    { total: account.total, paid: account.paidAmount, installments: account.installments },
    startOfVnDay(now),
  );
}

export async function createAccountForStudent(student: StudentDoc): Promise<TuitionAccountDoc> {
  const existing = await TuitionAccount.findOne({ studentId: student._id });
  if (existing) return existing;
  const { price, priceNote } = await resolveCoursePrice(student.branchId.toString(), student.courseId.toString());
  const account = new TuitionAccount({
    studentId: student._id,
    courseId: student.courseId,
    courseCode: student.courseCode,
    branchId: student.branchId,
    listPrice: price,
    priceNote,
    discounts: [],
    total: price,
    plan: 'one_time',
    installments: price > 0 ? [{ dueDate: addFixedDays(startOfVnDay(student.enrolledAt), DEFAULT_DUE_DAYS), amount: price }] : [],
    paidAmount: 0,
  });
  applyStatus(account);
  await account.save();
  return account;
}

export async function getAccountDoc(scope: Scope, id: string): Promise<TuitionAccountDoc> {
  const account = await TuitionAccount.findOne({ $and: [{ _id: id }, branchFilter(scope)] });
  if (!account) throw ApiError.notFound('Không tìm thấy sổ học phí');
  return account;
}

async function studentSummaries(studentIds: Types.ObjectId[]) {
  const students = await Student.find({ _id: { $in: studentIds }, ...WITH_DELETED });
  return new Map(
    students.map((student) => [
      student.id,
      { id: student.id, code: student.code, name: student.name, phone: student.phone, status: student.status, deleted: Boolean(student.deletedAt) },
    ]),
  );
}

function present(account: TuitionAccountDoc, student: unknown) {
  return {
    ...(account.toJSON() as Record<string, unknown>),
    student: student ?? null,
    remaining: Math.max(0, account.total - account.paidAmount),
    nextDue: nextDue(account.installments, account.paidAmount),
  };
}

export async function getAccount(scope: Scope, id: string) {
  const account = await getAccountDoc(scope, id);
  const [students, payments] = await Promise.all([
    studentSummaries([account.studentId]),
    Payment.find({ tuitionAccountId: account._id }).sort({ paidAt: -1, _id: -1 }),
  ]);
  return { ...present(account, students.get(account.studentId.toString())), payments };
}

export async function listAccounts(scope: Scope, query: ListAccountsQuery) {
  const conditions: FilterQuery<ITuitionAccount>[] = [branchFilter(scope)];
  if (query.branchId) {
    assertBranchAccess(scope, query.branchId);
    conditions.push({ branchId: new Types.ObjectId(query.branchId) });
  }
  if (query.status) conditions.push({ status: query.status });
  if (query.courseId) conditions.push({ courseId: new Types.ObjectId(query.courseId) });
  if (query.q) {
    const text = new RegExp(escapeRegex(query.q), 'i');
    const digits = normalizePhone(query.q).replace(/\D/g, '');
    const matches = await Student.find({
      $or: [{ name: text }, { code: text }, ...(digits.length >= 3 ? [{ phone: new RegExp(digits) }] : [])],
      ...WITH_DELETED,
    }).select('_id');
    conditions.push({ studentId: { $in: matches.map((student) => student._id) } });
  }
  const result = await paginate(TuitionAccount, { $and: conditions }, query, '-updatedAt');
  const students = await studentSummaries(result.data.map((account) => account.studentId));
  return { data: result.data.map((account) => present(account, students.get(account.studentId.toString()))), meta: result.meta };
}

export async function backfillAccount(actor: Actor, scope: Scope, studentId: string) {
  const student = await Student.findOne({ $and: [{ _id: studentId }, branchFilter(scope)] });
  if (!student) throw ApiError.notFound('Không tìm thấy học viên');
  if (await TuitionAccount.exists({ studentId: student._id })) throw ApiError.conflict('Học viên đã có sổ học phí');
  const account = await createAccountForStudent(student);
  await recordAudit({ actorId: actor.id, action: 'tuition.create', entity: 'tuition', entityId: account.id, after: snapshot(account) });
  return getAccount(scope, account.id);
}

export async function updateAccount(actor: Actor, scope: Scope, id: string, input: UpdateAccountInput) {
  const account = await getAccountDoc(scope, id);
  const before = snapshot(account);
  const discounts = input.discounts ?? account.discounts;
  const total = computeTotal(account.listPrice, discounts);
  if (total < account.paidAmount) throw ApiError.conflict('Tổng học phí mới nhỏ hơn số đã thu');
  const plan = input.plan ?? account.plan;
  let installments = input.installments ?? account.installments.map((item) => ({ dueDate: item.dueDate, amount: item.amount }));
  if (plan === 'one_time') {
    const dueDate = installments[0]?.dueDate ?? addFixedDays(startOfVnDay(), DEFAULT_DUE_DAYS);
    installments = total > 0 ? [{ dueDate, amount: total }] : [];
  } else {
    const error = installmentsError(installments, total);
    if (error) throw ApiError.badRequest(error, [{ path: 'body.installments', message: error }]);
  }
  account.set({ discounts, total, plan, installments, ...(input.note !== undefined ? { note: input.note } : {}) });
  applyStatus(account);
  await account.save();
  await recordAudit({ actorId: actor.id, action: 'tuition.update', entity: 'tuition', entityId: id, before, after: snapshot(account) });
  return getAccount(scope, id);
}
```
Ghi chú: test "sửa" gửi PATCH giảm trừ trước (plan vẫn `one_time` → đợt duy nhất = total mới), rồi chuyển sang `installments` với đủ tổng. Lần PATCH lỗi (400) không ghi audit, nên tổng audit `tuition.update` = 2 ✔.

`src/modules/tuition/tuition.controller.ts` (Task 3 thêm handler thu tiền/hủy phiếu vào cùng file):
```ts
import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendData, sendList } from '../../utils/response';
import * as service from './tuition.service';
import type { ListAccountsQuery, UpdateAccountInput } from './tuition.validation';

const idOf = (req: Request) => validated<{ id: string }>(req, 'params').id;

export async function list(req: Request, res: Response): Promise<void> {
  sendList(res, await service.listAccounts(req.scope, validated<ListAccountsQuery>(req, 'query')));
}

export async function get(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getAccount(req.scope, idOf(req)));
}

export async function backfill(req: Request, res: Response): Promise<void> {
  sendData(res, await service.backfillAccount(req.user!, req.scope, validated<{ studentId: string }>(req, 'body').studentId), 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  sendData(res, await service.updateAccount(req.user!, req.scope, idOf(req), validated<UpdateAccountInput>(req, 'body')));
}
```

`src/modules/tuition/tuition.routes.ts`:
```ts
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../shared/zod';
import * as controller from './tuition.controller';
import { backfillSchema, listAccountsQuerySchema, updateAccountSchema } from './tuition.validation';

export function createTuitionRouter(): Router {
  const router = Router();
  const can = (permission: string) => authorize(permission, { branchScoped: true });
  router.use(authenticate);
  router.get('/', can('tuition.read'), validate({ query: listAccountsQuerySchema }), controller.list);
  router.post('/', can('tuition.create'), validate({ body: backfillSchema }), controller.backfill);
  router.get('/:id', can('tuition.read'), validate({ params: idParamsSchema }), controller.get);
  router.patch('/:id', can('tuition.update'), validate({ params: idParamsSchema, body: updateAccountSchema }), controller.update);
  return router;
}
```
Trong `src/routes/index.ts`: `router.use('/tuition', createTuitionRouter());`.

Sửa `src/modules/students/students.service.ts`:
- `createStudent`: ngay sau `Student.create(...)` (trước `recordAudit`), thêm
  ```ts
  try {
    await createAccountForStudent(student);
  } catch (error) {
    logger.error({ err: error, studentId: student.id }, 'Không tạo được sổ học phí cho học viên');
  }
  ```
  (import `createAccountForStudent` từ `../tuition/tuition.service`; lỗi tạo sổ không làm hỏng việc tạo học viên — có `POST /tuition` để tạo bù.)
- `removeStudent`: trước khi soft-delete học viên, thêm
  ```ts
  const account = await TuitionAccount.findOne({ studentId: student._id });
  if (account && !(await Payment.exists({ tuitionAccountId: account._id }))) await account.deleteOne();
  ```
  (import model `TuitionAccount`, `Payment` — chỉ model, không import service để tránh vòng tròn.)

Sửa `src/modules/leads/leads.convert.ts`: ở **cả hai** chỗ bù trừ xóa học viên (nhánh `catch` và nhánh `!updated`), xóa thêm sổ: `await TuitionAccount.deleteOne({ studentId: student._id })` (trong cùng try/catch ghi log ở nhánh `catch`; ở nhánh `!updated` cũng bọc try/catch + `logger.error` cho cả hai lệnh xóa, rồi ném 409 như cũ).

Lưu ý vòng import: `tuition.service` import `students/student.model` (model) và `pricing.service`; `students.service` import `tuition.service`. `tuition.service` **không** được import `students.service`.

- [ ] **Step 4: Chạy test**

Run: `npx vitest run tests/integration/tuition.test.ts tests/integration/students.test.ts tests/integration/lead-convert.test.ts tests/integration/followups.test.ts`
Expected: PASS

- [ ] **Step 5: Kiểm tra toàn bộ**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: tất cả pass.

---

### Task 3: Thu tiền và hủy phiếu thu

**Files:**
- Create: `src/modules/tuition/payments.service.ts`
- Modify: `src/modules/tuition/tuition.validation.ts`, `tuition.controller.ts`, `tuition.routes.ts`
- Test: `tests/integration/payments.test.ts`

**Interfaces:**
- Consumes: `TuitionAccount`, `Payment`, `getAccountDoc`, `applyStatus`, `getAccount`, `nextDailyCode`.
- Produces: `addPaymentSchema` (`amount`, `method`, `paidAt?` zDateTime, `note?`), `voidPaymentSchema` (`reason` 3–300 ký tự, body), `paymentParamsSchema`, `addPayment(actor, scope, accountId, input)` → sổ cập nhật (như `getAccount`) + `payment`, `voidPayment(actor, scope, accountId, paymentId, reason)`.

- [ ] **Step 1: Viết test (failing)** — `tests/integration/payments.test.ts`

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { Payment } from '../../src/modules/tuition/payment.model';
import { TuitionAccount } from '../../src/modules/tuition/tuition-account.model';
import { authHeader, createBranch, createCourse, createUser } from '../helpers/factories';

async function setup(price = 1_000_000) {
  const [a, b] = await Promise.all([createBranch({ name: 'A' }), createBranch({ name: 'B' })]);
  const course = await createCourse({ code: 'A1', defaultPrice: price });
  const { user: managerA } = await createUser({ role: 'branch_manager', branchIds: [a.id] });
  const { user: consultantA } = await createUser({ role: 'consultant', branchIds: [a.id] });
  const { user: admin } = await createUser();
  const app = createApp();
  const student = await request(app)
    .post('/api/v1/students')
    .set(authHeader(managerA))
    .send({ name: 'Trần Quốc Bảo', phone: '0786205114', courseId: course.id, branchId: a.id });
  const account = (await TuitionAccount.findOne({ studentId: student.body.data.id }))!;
  return { app, a, b, course, managerA, consultantA, admin, account };
}

const pay = (amount: number, extra: Record<string, unknown> = {}) => ({ amount, method: 'cash', ...extra });

describe('thu tiền', () => {
  it('thu một phần: số phiếu PT-yyMMdd-NN, cập nhật đã thu/còn lại, người thu, có audit; thu đủ → paid', async () => {
    const { app, managerA, account } = await setup();
    const url = `/api/v1/tuition/${account.id}/payments`;
    const first = await request(app).post(url).set(authHeader(managerA)).send(pay(400_000, { note: 'Đợt 1' }));
    expect(first.status).toBe(201);
    expect(first.body.data.payment).toMatchObject({ amount: 400_000, method: 'cash', courseCode: 'A1', receivedBy: managerA.id });
    expect(first.body.data.payment.receiptNo).toMatch(/^PT-\d{6}-\d{2,}$/);
    expect(first.body.data.account).toMatchObject({ paidAmount: 400_000, remaining: 600_000, status: 'partial' });
    const second = await request(app).post(url).set(authHeader(managerA)).send(pay(600_000, { method: 'transfer' }));
    expect(second.body.data.account).toMatchObject({ paidAmount: 1_000_000, remaining: 0, status: 'paid', nextDue: null });
    expect(await AuditLog.countDocuments({ action: 'tuition.payment' })).toBe(2);
  });

  it('không thu vượt số còn lại (409); số tiền 0 hoặc lẻ → 400', async () => {
    const { app, managerA, account } = await setup();
    const url = `/api/v1/tuition/${account.id}/payments`;
    expect((await request(app).post(url).set(authHeader(managerA)).send(pay(1_000_001))).status).toBe(409);
    expect((await request(app).post(url).set(authHeader(managerA)).send(pay(0))).status).toBe(400);
    expect((await request(app).post(url).set(authHeader(managerA)).send(pay(10.5))).status).toBe(400);
  });

  it('hai phiếu đồng thời vượt tổng → đúng một thành công, đã thu không vượt tổng', async () => {
    const { app, managerA, account } = await setup();
    const url = `/api/v1/tuition/${account.id}/payments`;
    const results = await Promise.all([
      request(app).post(url).set(authHeader(managerA)).send(pay(800_000)),
      request(app).post(url).set(authHeader(managerA)).send(pay(800_000)),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await TuitionAccount.findById(account.id))?.paidAmount).toBe(800_000);
    expect(await Payment.countDocuments({ tuitionAccountId: account._id })).toBe(1);
  });

  it('tư vấn viên không thu được (403); sổ chi nhánh khác → 404', async () => {
    const { app, b, course, consultantA, managerA, admin, account } = await setup();
    expect((await request(app).post(`/api/v1/tuition/${account.id}/payments`).set(authHeader(consultantA)).send(pay(1))).status).toBe(403);
    const other = await request(app)
      .post('/api/v1/students')
      .set(authHeader(admin))
      .send({ name: 'Khác', phone: '0911222333', courseId: course.id, branchId: b.id });
    const foreign = await TuitionAccount.findOne({ studentId: other.body.data.id });
    expect((await request(app).post(`/api/v1/tuition/${foreign!.id}/payments`).set(authHeader(managerA)).send(pay(1))).status).toBe(404);
  });
});

describe('hủy phiếu thu', () => {
  it('chỉ super_admin hủy được (quản lý chi nhánh 403); hủy mềm, giảm đã thu, cần lý do, có audit', async () => {
    const { app, managerA, admin, account } = await setup();
    const { body } = await request(app).post(`/api/v1/tuition/${account.id}/payments`).set(authHeader(managerA)).send(pay(1_000_000));
    const url = `/api/v1/tuition/${account.id}/payments/${body.data.payment.id}`;
    expect((await request(app).delete(url).set(authHeader(managerA)).send({ reason: 'Nhập nhầm' })).status).toBe(403);
    expect((await request(app).delete(url).set(authHeader(admin)).send({})).status).toBe(400);
    const voided = await request(app).delete(url).set(authHeader(admin)).send({ reason: 'Nhập nhầm số tiền' });
    expect(voided.status).toBe(200);
    expect(voided.body.data.account).toMatchObject({ paidAmount: 0, status: 'partial' });
    const payment = await Payment.findById(body.data.payment.id);
    expect(payment).toMatchObject({ voidReason: 'Nhập nhầm số tiền' });
    expect(payment?.voidedAt).toBeInstanceOf(Date);
    expect((await request(app).delete(url).set(authHeader(admin)).send({ reason: 'Lần 2' })).status).toBe(409);
    expect(await AuditLog.countDocuments({ action: 'tuition.payment_void' })).toBe(1);
  });

  it('chi tiết sổ liệt kê cả phiếu đã hủy (để đối soát)', async () => {
    const { app, managerA, admin, account } = await setup();
    const { body } = await request(app).post(`/api/v1/tuition/${account.id}/payments`).set(authHeader(managerA)).send(pay(300_000));
    await request(app).delete(`/api/v1/tuition/${account.id}/payments/${body.data.payment.id}`).set(authHeader(admin)).send({ reason: 'Sai người nộp' });
    const detail = await request(app).get(`/api/v1/tuition/${account.id}`).set(authHeader(managerA));
    expect(detail.body.data.payments).toHaveLength(1);
    expect(detail.body.data.payments[0].voidReason).toBe('Sai người nộp');
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/integration/payments.test.ts`
Expected: FAIL — route 404.

- [ ] **Step 3: Viết code**

Thêm vào `src/modules/tuition/tuition.validation.ts` (import `PAYMENT_METHODS` từ `./payment.model`, `zDateTime` từ shared/zod):
```ts
export const addPaymentSchema = z.object({
  amount: moneySchema.refine((value) => value > 0, 'Số tiền phải lớn hơn 0'),
  method: z.enum(PAYMENT_METHODS),
  paidAt: zDateTime.optional(),
  note: z.string().trim().max(500).optional(),
});
export const voidPaymentSchema = z.object({ reason: z.string().trim().min(3).max(300) });
export const paymentParamsSchema = z.object({ id: objectIdSchema, paymentId: objectIdSchema });

export type AddPaymentInput = z.infer<typeof addPaymentSchema>;
```

`src/modules/tuition/payments.service.ts`:
```ts
import { logger } from '../../config/logger';
import { nextDailyCode } from '../../shared/codes';
import { ApiError } from '../../utils/ApiError';
import { recordAudit, snapshot } from '../audit/audit.service';
import { Payment } from './payment.model';
import { TuitionAccount } from './tuition-account.model';
import { applyStatus, getAccount, getAccountDoc } from './tuition.service';
import type { AddPaymentInput } from './tuition.validation';

type Actor = Express.AuthUser;
type Scope = Express.BranchScope | undefined;

export async function addPayment(actor: Actor, scope: Scope, accountId: string, input: AddPaymentInput) {
  const account = await getAccountDoc(scope, accountId);
  const now = new Date();
  const reserved = await TuitionAccount.findOneAndUpdate(
    { _id: account._id, $expr: { $lte: [{ $add: ['$paidAmount', input.amount] }, '$total'] } },
    { $inc: { paidAmount: input.amount }, lastPaymentAt: now },
    { returnDocument: 'after' },
  );
  if (!reserved) {
    throw ApiError.conflict(`Số tiền vượt quá số còn phải đóng (${Math.max(0, account.total - account.paidAmount)}đ)`);
  }

  let payment;
  try {
    payment = await Payment.create({
      tuitionAccountId: account._id,
      studentId: account.studentId,
      branchId: account.branchId,
      courseCode: account.courseCode,
      amount: input.amount,
      method: input.method,
      paidAt: input.paidAt ?? now,
      receivedBy: actor.id,
      receiptNo: await nextDailyCode('PT', now),
      note: input.note ?? null,
    });
  } catch (error) {
    await TuitionAccount.updateOne({ _id: account._id }, { $inc: { paidAmount: -input.amount } }).catch((rollbackError: unknown) =>
      logger.error({ err: rollbackError, accountId }, 'Không hoàn lại được số đã thu khi tạo phiếu thất bại'),
    );
    throw error;
  }

  applyStatus(reserved, now);
  await TuitionAccount.updateOne({ _id: reserved._id }, { status: reserved.status });
  await recordAudit({ actorId: actor.id, action: 'tuition.payment', entity: 'payment', entityId: payment.id, after: snapshot(payment) });
  return { payment, account: await getAccount(scope, accountId) };
}

export async function voidPayment(actor: Actor, scope: Scope, accountId: string, paymentId: string, reason: string) {
  const account = await getAccountDoc(scope, accountId);
  const now = new Date();
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, tuitionAccountId: account._id, voidedAt: null },
    { voidedAt: now, voidedBy: actor.id, voidReason: reason },
    { returnDocument: 'after' },
  );
  if (!payment) {
    if (await Payment.exists({ _id: paymentId, tuitionAccountId: account._id })) throw ApiError.conflict('Phiếu thu đã được hủy trước đó');
    throw ApiError.notFound('Không tìm thấy phiếu thu');
  }
  const updated = await TuitionAccount.findOneAndUpdate({ _id: account._id }, { $inc: { paidAmount: -payment.amount } }, { returnDocument: 'after' });
  applyStatus(updated!, now);
  await TuitionAccount.updateOne({ _id: account._id }, { status: updated!.status });
  await recordAudit({ actorId: actor.id, action: 'tuition.payment_void', entity: 'payment', entityId: payment.id, after: snapshot(payment) });
  return { payment, account: await getAccount(scope, accountId) };
}
```

Thêm vào `src/modules/tuition/tuition.controller.ts` (import `* as payments from './payments.service'`, type `AddPaymentInput`):
```ts
export async function addPayment(req: Request, res: Response): Promise<void> {
  sendData(res, await payments.addPayment(req.user!, req.scope, idOf(req), validated<AddPaymentInput>(req, 'body')), 201);
}

export async function voidPayment(req: Request, res: Response): Promise<void> {
  const { id, paymentId } = validated<{ id: string; paymentId: string }>(req, 'params');
  sendData(res, await payments.voidPayment(req.user!, req.scope, id, paymentId, validated<{ reason: string }>(req, 'body').reason));
}
```

Thêm vào `tuition.routes.ts`:
```ts
router.post('/:id/payments', can('tuition.collect'), validate({ params: idParamsSchema, body: addPaymentSchema }), controller.addPayment);
router.delete('/:id/payments/:paymentId', can('payment.void'), validate({ params: paymentParamsSchema, body: voidPaymentSchema }), controller.voidPayment);
```
(`tuition.collect` thuộc `tuition.*` của branch_manager; `payment.void` không vai trò nào có ngoài super_admin.)

Lưu ý: `authorize` chạy trước `validate`, nên quản lý gửi body hợp lệ vẫn nhận 403; super_admin gửi body thiếu `reason` nhận 400 ✔.

- [ ] **Step 4: Chạy test**

Run: `npx vitest run tests/integration/payments.test.ts tests/integration/tuition.test.ts`
Expected: PASS

- [ ] **Step 5: Kiểm tra toàn bộ**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: tất cả pass.

---

### Task 4: Job đánh dấu quá hạn + lịch chạy trong server

**Files:**
- Create: `src/modules/tuition/tuition.job.ts`, `src/jobs/index.ts`
- Modify: `src/server.ts`
- Test: `tests/integration/tuition-job.test.ts`

**Interfaces:**
- Produces: `refreshTuitionStatuses(now?: Date): Promise<{ checked: number; changed: number }>`, `startJobs(): void`, `stopJobs(): void`, hằng `JOB_INTERVAL_MS = 60 * 60 * 1000`, `JOB_START_DELAY_MS = 5000`.

- [ ] **Step 1: Viết test (failing)** — `tests/integration/tuition-job.test.ts`

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshTuitionStatuses } from '../../src/modules/tuition/tuition.job';
import { TuitionAccount } from '../../src/modules/tuition/tuition-account.model';
import { JOB_INTERVAL_MS, startJobs, stopJobs } from '../../src/jobs';
import { parseDateOnly } from '../../src/shared/time';
import { createBranch, createCourse, createStudent } from '../helpers/factories';

async function account(dueDate: string, paidAmount = 0, total = 1_000_000) {
  const branch = await createBranch();
  const course = await createCourse();
  const student = await createStudent({ branchId: branch.id, courseId: course.id });
  await TuitionAccount.deleteMany({ studentId: student._id });
  return TuitionAccount.create({
    studentId: student._id,
    courseId: course._id,
    courseCode: course.code,
    branchId: branch._id,
    listPrice: total,
    total,
    installments: [{ dueDate: parseDateOnly(dueDate), amount: total }],
    paidAmount,
    status: 'partial',
  });
}

afterEach(() => {
  stopJobs();
  vi.useRealTimers();
});

describe('refreshTuitionStatuses', () => {
  it('đợt hạn hôm nay chưa quá hạn; sang 00:00 VN hôm sau thành overdue; đã đủ thì paid', async () => {
    const dueToday = await account('2026-10-05');
    const paidUp = await account('2026-09-01', 1_000_000);
    const first = await refreshTuitionStatuses(new Date('2026-10-05T16:59:00Z')); // 23:59 05/10 VN
    expect((await TuitionAccount.findById(dueToday.id))?.status).toBe('partial');
    expect((await TuitionAccount.findById(paidUp.id))?.status).toBe('paid');
    expect(first.changed).toBe(1);
    const second = await refreshTuitionStatuses(new Date('2026-10-05T17:00:00Z')); // 00:00 06/10 VN
    expect((await TuitionAccount.findById(dueToday.id))?.status).toBe('overdue');
    expect(second).toEqual({ checked: 1, changed: 1 });
    expect((await refreshTuitionStatuses(new Date('2026-10-05T17:00:00Z'))).changed).toBe(0);
  });
});

describe('startJobs', () => {
  it('chạy sau 5 giây rồi mỗi 60 phút; stopJobs dừng hẳn', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    const job = await import('../../src/modules/tuition/tuition.job');
    const spy = vi.spyOn(job, 'refreshTuitionStatuses').mockResolvedValue({ checked: 0, changed: 0 });
    startJobs();
    await vi.advanceTimersByTimeAsync(4_999);
    expect(spy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(spy).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(JOB_INTERVAL_MS);
    expect(spy).toHaveBeenCalledTimes(2);
    stopJobs();
    await vi.advanceTimersByTimeAsync(JOB_INTERVAL_MS * 3);
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});
```

Ghi chú test: `checked` = số sổ **chưa `paid`** được xét trong lần chạy (lần đầu 2 sổ `partial` → `paidUp` sang `paid`; lần hai chỉ còn `dueToday`).

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/integration/tuition-job.test.ts`
Expected: FAIL — module không tồn tại.

- [ ] **Step 3: Viết code**

`src/modules/tuition/tuition.job.ts`:
```ts
import { startOfVnDay } from '../../shared/time';
import { computeTuitionStatus } from './tuition.calc';
import { TuitionAccount } from './tuition-account.model';

export async function refreshTuitionStatuses(now: Date = new Date()): Promise<{ checked: number; changed: number }> {
  const today = startOfVnDay(now);
  const accounts = await TuitionAccount.find({ status: { $ne: 'paid' } }).select('total paidAmount installments status');
  const updates = accounts.flatMap((account) => {
    const status = computeTuitionStatus({ total: account.total, paid: account.paidAmount, installments: account.installments }, today);
    return status === account.status ? [] : [{ updateOne: { filter: { _id: account._id, status: account.status }, update: { status } } }];
  });
  if (updates.length) await TuitionAccount.bulkWrite(updates);
  return { checked: accounts.length, changed: updates.length };
}
```
(Bộ lọc `status: account.status` trong `updateOne` tránh ghi đè trạng thái vừa được thu tiền cập nhật.)

`src/jobs/index.ts`:
```ts
import { logger } from '../config/logger';
import * as tuitionJob from '../modules/tuition/tuition.job';

export const JOB_INTERVAL_MS = 60 * 60 * 1000;
export const JOB_START_DELAY_MS = 5000;

let startTimer: NodeJS.Timeout | null = null;
let intervalTimer: NodeJS.Timeout | null = null;

async function runAll(): Promise<void> {
  try {
    const result = await tuitionJob.refreshTuitionStatuses();
    if (result.changed) logger.info(result, 'Đã cập nhật trạng thái học phí');
  } catch (err) {
    logger.error({ err }, 'Job cập nhật trạng thái học phí thất bại');
  }
}

export function startJobs(): void {
  stopJobs();
  startTimer = setTimeout(() => {
    void runAll();
    intervalTimer = setInterval(() => void runAll(), JOB_INTERVAL_MS);
    intervalTimer.unref();
  }, JOB_START_DELAY_MS);
  startTimer.unref();
}

export function stopJobs(): void {
  if (startTimer) clearTimeout(startTimer);
  if (intervalTimer) clearInterval(intervalTimer);
  startTimer = null;
  intervalTimer = null;
}
```
(Gọi qua namespace `tuitionJob.refreshTuitionStatuses` để `vi.spyOn` trong test thay được hàm.)

`src/server.ts`: import `{ startJobs, stopJobs } from './jobs'`; gọi `startJobs()` ngay sau `listen` (trong callback), và `stopJobs()` ở đầu hàm `shutdown`.

- [ ] **Step 4: Chạy test**

Run: `npx vitest run tests/integration/tuition-job.test.ts`
Expected: PASS

- [ ] **Step 5: Kiểm tra toàn bộ**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: tất cả pass.

---

### Task 5: Dashboard — tổng quan, đăng ký theo ngày, nguồn khách, phễu tuyển sinh

**Files:**
- Create: `src/modules/dashboard/dashboard.validation.ts`, `dashboard.service.ts`, `dashboard.controller.ts`, `dashboard.routes.ts`
- Modify: `src/routes/index.ts`
- Test: `tests/integration/dashboard.test.ts`

**Interfaces:**
- Consumes: `Lead`, `LeadActivity`, `Student`, `Appointment`, `TuitionAccount`, `branchFilter`, `assertBranchAccess`, `vnMonthRange`, `vnMonthKey`, `shiftMonth`, `vnWeekRange`, `startOfVnDay`, `addFixedDays`, `formatVn`, `PIPELINE`, `STATUS_LABELS`.
- Produces:
  - `dashboardScopeQuerySchema` (`branchId?`), `registrationsQuerySchema` (`days` 1–90, mặc định 7), `monthQuerySchema` (`month?` `YYYY-MM`, mặc định tháng hiện tại VN), `monthsQuerySchema` (`months` 1–24, mặc định 12) — mỗi schema đều có `branchId?`.
  - `scopeConditions(scope, branchId?): FilterQuery<unknown>` — `branchFilter(scope)` + `branchId` (assertBranchAccess).
  - `getSummary(scope, query)` → `{ leads: { thisMonth, lastMonth, changePct }, students: { studying, newThisMonth }, appointments: { thisWeek, today }, tuition: { overdueAccounts, outstanding } }`.
  - `getRegistrations(scope, query)` → `[{ date: 'YYYY-MM-DD', count }]` đủ `days` ngày, ngày cũ nhất trước.
  - `getSources(scope, query)` → `[{ source, count }]` sắp giảm dần.
  - `getFunnel(scope, query)` → `[{ stage, label, count }]` 6 mốc (`new` nhãn "Tiếp nhận", … `enrolled` "Nhập học").
  - `createDashboardRouter()` (Task 6 thêm route).

- [ ] **Step 1: Viết test (failing)** — `tests/integration/dashboard.test.ts`

```ts
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import { Appointment } from '../../src/modules/appointments/appointment.model';
import { LeadActivity } from '../../src/modules/leads/lead-activity.model';
import { TuitionAccount } from '../../src/modules/tuition/tuition-account.model';
import { authHeader, createBranch, createCourse, createLead, createStudent, createUser } from '../helpers/factories';

const NOW = new Date('2026-10-14T03:00:00Z'); // T4 14/10/2026 10:00 VN

afterEach(() => vi.useRealTimers());

async function setup() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  const [a, b] = await Promise.all([createBranch({ name: 'A' }), createBranch({ name: 'B' })]);
  const { user: managerA } = await createUser({ role: 'branch_manager', branchIds: [a.id] });
  return { app: createApp(), a, b, managerA };
}

describe('GET /dashboard/summary', () => {
  it('đếm theo tháng/tuần/ngày giờ VN, chỉ chi nhánh mình', async () => {
    const { app, a, b, managerA } = await setup();
    await createLead({ branchId: a.id, createdAt: new Date('2026-10-02T03:00:00Z') });
    await createLead({ branchId: a.id, createdAt: new Date('2026-10-13T03:00:00Z') });
    await createLead({ branchId: a.id, createdAt: new Date('2026-09-30T16:30:00Z') }); // 23:30 30/09 VN → tháng 9
    await createLead({ branchId: b.id, createdAt: new Date('2026-10-05T03:00:00Z') });
    const course = await createCourse();
    await createStudent({ branchId: a.id, courseId: course.id });
    await createStudent({ branchId: a.id, courseId: course.id, status: 'completed' });
    const base = { branchId: a._id, durationMinutes: 30, type: 'consult', status: 'scheduled', createdBy: managerA._id };
    await Appointment.create([
      { ...base, startAt: new Date('2026-10-14T01:00:00Z'), endAt: new Date('2026-10-14T01:30:00Z') }, // hôm nay
      { ...base, startAt: new Date('2026-10-16T01:00:00Z'), endAt: new Date('2026-10-16T01:30:00Z') }, // tuần này
      { ...base, startAt: new Date('2026-10-20T01:00:00Z'), endAt: new Date('2026-10-20T01:30:00Z') }, // tuần sau
      { ...base, startAt: new Date('2026-10-15T01:00:00Z'), endAt: new Date('2026-10-15T01:30:00Z'), status: 'cancelled' },
    ]);
    const course2 = await createCourse();
    const s1 = await createStudent({ branchId: a.id, courseId: course2.id });
    const s2 = await createStudent({ branchId: a.id, courseId: course2.id, status: 'paused' });
    for (const student of [s1, s2]) {
      await TuitionAccount.create({
        studentId: student._id, courseId: course2._id, courseCode: course2.code, branchId: a._id,
        listPrice: 1_000_000, total: 1_000_000, installments: [], paidAmount: 250_000, status: 'overdue',
      });
    }
    const res = await request(app).get('/api/v1/dashboard/summary').set(authHeader(managerA));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      leads: { thisMonth: 2, lastMonth: 1, changePct: 100 },
      students: { studying: 2, newThisMonth: 4 },
      appointments: { thisWeek: 2, today: 1 },
      tuition: { overdueAccounts: 2, outstanding: 1_500_000 },
    });
  });

  it('branchId ngoài phạm vi → 403; tư vấn viên xem được; giáo viên không (403)', async () => {
    const { app, a, b, managerA } = await setup();
    const { user: consultant } = await createUser({ role: 'consultant', branchIds: [a.id] });
    const { user: teacher } = await createUser({ role: 'instructor', branchIds: [a.id] });
    expect((await request(app).get(`/api/v1/dashboard/summary?branchId=${b.id}`).set(authHeader(managerA))).status).toBe(403);
    expect((await request(app).get('/api/v1/dashboard/summary').set(authHeader(consultant))).status).toBe(200);
    expect((await request(app).get('/api/v1/dashboard/summary').set(authHeader(teacher))).status).toBe(403);
  });
});

describe('đăng ký, nguồn, phễu', () => {
  it('registrations: đủ 7 ngày gần nhất theo giờ VN, ngày trống = 0', async () => {
    const { app, a, managerA } = await setup();
    await createLead({ branchId: a.id, createdAt: new Date('2026-10-13T16:30:00Z') }); // 23:30 13/10 VN
    await createLead({ branchId: a.id, createdAt: new Date('2026-10-13T17:30:00Z') }); // 00:30 14/10 VN
    await createLead({ branchId: a.id, createdAt: new Date('2026-10-01T03:00:00Z') }); // ngoài 7 ngày
    const res = await request(app).get('/api/v1/dashboard/registrations?days=7').set(authHeader(managerA));
    expect(res.body.data).toHaveLength(7);
    expect(res.body.data[0]).toEqual({ date: '2026-10-08', count: 0 });
    expect(res.body.data.slice(-2)).toEqual([
      { date: '2026-10-13', count: 1 },
      { date: '2026-10-14', count: 1 },
    ]);
  });

  it('sources: theo nguồn trong tháng, giảm dần', async () => {
    const { app, a, managerA } = await setup();
    await createLead({ branchId: a.id, source: 'facebook', createdAt: new Date('2026-10-02T03:00:00Z') });
    await createLead({ branchId: a.id, source: 'facebook', createdAt: new Date('2026-10-03T03:00:00Z') });
    await createLead({ branchId: a.id, source: 'website', createdAt: new Date('2026-10-04T03:00:00Z') });
    await createLead({ branchId: a.id, source: 'zalo', createdAt: new Date('2026-09-04T03:00:00Z') });
    const res = await request(app).get('/api/v1/dashboard/sources?month=2026-10').set(authHeader(managerA));
    expect(res.body.data).toEqual([
      { source: 'facebook', count: 2 },
      { source: 'website', count: 1 },
    ]);
  });

  it('funnel: đếm khách đã từng đạt mỗi mốc (kể cả khách sau đó lost)', async () => {
    const { app, a, managerA } = await setup();
    const at = new Date('2026-10-05T03:00:00Z');
    await createLead({ branchId: a.id, status: 'new', createdAt: at });
    await createLead({ branchId: a.id, status: 'consulted', createdAt: at });
    await createLead({ branchId: a.id, status: 'enrolled', createdAt: at });
    const lostAfterDeposit = await createLead({ branchId: a.id, status: 'lost', createdAt: at });
    await LeadActivity.create({ leadId: lostAfterDeposit._id, type: 'status_change', fromStatus: 'consulted', toStatus: 'deposited', at });
    await createLead({ branchId: a.id, status: 'deposited', createdAt: new Date('2026-09-05T03:00:00Z') }); // tháng khác
    const res = await request(app).get('/api/v1/dashboard/funnel?month=2026-10').set(authHeader(managerA));
    expect(res.body.data).toEqual([
      { stage: 'new', label: 'Tiếp nhận', count: 4 },
      { stage: 'contacted', label: 'Đã liên hệ', count: 3 },
      { stage: 'consulted', label: 'Đã tư vấn', count: 3 },
      { stage: 'deposited', label: 'Đặt cọc', count: 2 },
      { stage: 'docs_completed', label: 'Hoàn tất hồ sơ', count: 1 },
      { stage: 'enrolled', label: 'Nhập học', count: 1 },
    ]);
  });
});
```

Ghi chú test: factory `createStudent` gọi `Student.create` trực tiếp nên không tự tạo sổ; test tạo 2 sổ `overdue` thủ công. Học viên: 4 học viên nhập học tháng này (2 + 2), `studying` = 2 (1 ở trên + `s1`). `outstanding` = 2 × (1.000.000 − 250.000) = 1.500.000.

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/integration/dashboard.test.ts`
Expected: FAIL — route 404.

- [ ] **Step 3: Viết code**

`src/modules/dashboard/dashboard.validation.ts`:
```ts
import { z } from 'zod';
import { objectIdSchema } from '../../shared/zod';

const branch = { branchId: objectIdSchema.optional() };
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Tháng phải có dạng YYYY-MM');

export const dashboardScopeQuerySchema = z.object(branch);
export const registrationsQuerySchema = z.object({ ...branch, days: z.coerce.number().int().min(1).max(90).default(7) });
export const monthQuerySchema = z.object({ ...branch, month: monthSchema.optional() });
export const monthsQuerySchema = z.object({ ...branch, months: z.coerce.number().int().min(1).max(24).default(12) });

export type ScopeQuery = z.infer<typeof dashboardScopeQuerySchema>;
export type RegistrationsQuery = z.infer<typeof registrationsQuerySchema>;
export type MonthQuery = z.infer<typeof monthQuerySchema>;
export type MonthsQuery = z.infer<typeof monthsQuerySchema>;
```

`src/modules/dashboard/dashboard.service.ts`:
```ts
import { Types, type FilterQuery } from 'mongoose';
import { assertBranchAccess, branchFilter } from '../../middlewares/authorize.middleware';
import { addFixedDays, formatVn, shiftMonth, startOfVnDay, vnMonthKey, vnMonthRange, vnWeekRange } from '../../shared/time';
import { Appointment } from '../appointments/appointment.model';
import { LeadActivity } from '../leads/lead-activity.model';
import { Lead } from '../leads/lead.model';
import { PIPELINE, STATUS_LABELS, type LeadStatus } from '../leads/lead.status';
import { Student } from '../students/student.model';
import { TuitionAccount } from '../tuition/tuition-account.model';
import type { MonthQuery, RegistrationsQuery, ScopeQuery } from './dashboard.validation';

type Scope = Express.BranchScope | undefined;
const STAGES: LeadStatus[] = [...PIPELINE, 'enrolled'];
const STAGE_LABELS: Partial<Record<LeadStatus, string>> = { ...STATUS_LABELS, new: 'Tiếp nhận' };

export function scopeConditions(scope: Scope, branchId?: string): FilterQuery<unknown> {
  const conditions: FilterQuery<unknown>[] = [branchFilter(scope)];
  if (branchId) {
    assertBranchAccess(scope, branchId);
    conditions.push({ branchId: new Types.ObjectId(branchId) });
  }
  return { $and: conditions };
}

const range = (field: string, start: Date, end: Date) => ({ [field]: { $gte: start, $lt: end } });

export async function getSummary(scope: Scope, query: ScopeQuery) {
  const base = scopeConditions(scope, query.branchId);
  const now = new Date();
  const thisMonth = vnMonthRange(vnMonthKey(now));
  const lastMonth = vnMonthRange(shiftMonth(vnMonthKey(now), -1));
  const week = vnWeekRange(now);
  const today = startOfVnDay(now);
  const notCancelled = { status: { $ne: 'cancelled' } };
  const [leadsThis, leadsLast, studying, newStudents, apptWeek, apptToday, overdue, outstandingRows] = await Promise.all([
    Lead.countDocuments({ $and: [base, range('createdAt', thisMonth.start, thisMonth.end)] }),
    Lead.countDocuments({ $and: [base, range('createdAt', lastMonth.start, lastMonth.end)] }),
    Student.countDocuments({ $and: [base, { status: 'studying' }] }),
    Student.countDocuments({ $and: [base, range('enrolledAt', thisMonth.start, thisMonth.end)] }),
    Appointment.countDocuments({ $and: [base, notCancelled, range('startAt', week.start, week.end)] }),
    Appointment.countDocuments({ $and: [base, notCancelled, range('startAt', today, addFixedDays(today, 1))] }),
    TuitionAccount.countDocuments({ $and: [base, { status: 'overdue' }] }),
    TuitionAccount.aggregate<{ total: number }>([
      { $match: { $and: [base, { status: { $ne: 'paid' } }] } },
      { $group: { _id: null, total: { $sum: { $subtract: ['$total', '$paidAmount'] } } } },
    ]),
  ]);
  return {
    leads: { thisMonth: leadsThis, lastMonth: leadsLast, changePct: leadsLast ? Math.round(((leadsThis - leadsLast) / leadsLast) * 1000) / 10 : null },
    students: { studying, newThisMonth: newStudents },
    appointments: { thisWeek: apptWeek, today: apptToday },
    tuition: { overdueAccounts: overdue, outstanding: outstandingRows[0]?.total ?? 0 },
  };
}

export async function getRegistrations(scope: Scope, query: RegistrationsQuery) {
  const end = addFixedDays(startOfVnDay(), 1);
  const start = addFixedDays(end, -query.days);
  const rows = await Lead.aggregate<{ _id: string; count: number }>([
    { $match: { $and: [scopeConditions(scope, query.branchId), range('createdAt', start, end), { deletedAt: null }] } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+07:00' } }, count: { $sum: 1 } } },
  ]);
  const counts = new Map(rows.map((row) => [row._id, row.count]));
  return Array.from({ length: query.days }, (_, i) => {
    const date = formatVn(addFixedDays(start, i), 'yyyy-MM-dd');
    return { date, count: counts.get(date) ?? 0 };
  });
}

export async function getSources(scope: Scope, query: MonthQuery) {
  const { start, end } = vnMonthRange(query.month ?? vnMonthKey(new Date()));
  const rows = await Lead.aggregate<{ _id: string; count: number }>([
    { $match: { $and: [scopeConditions(scope, query.branchId), range('createdAt', start, end), { deletedAt: null }] } },
    { $group: { _id: '$source', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ]);
  return rows.map((row) => ({ source: row._id, count: row.count }));
}

export async function getFunnel(scope: Scope, query: MonthQuery) {
  const { start, end } = vnMonthRange(query.month ?? vnMonthKey(new Date()));
  const leads = await Lead.find({ $and: [scopeConditions(scope, query.branchId), range('createdAt', start, end)] }).select('_id status');
  const activities = await LeadActivity.find({ leadId: { $in: leads.map((lead) => lead._id) }, type: 'status_change' }).select('leadId toStatus');
  const reached = new Map(leads.map((lead) => [lead.id, STAGES.indexOf(lead.status)]));
  for (const activity of activities) {
    const key = activity.leadId.toString();
    const index = activity.toStatus ? STAGES.indexOf(activity.toStatus) : -1;
    reached.set(key, Math.max(reached.get(key) ?? 0, index));
  }
  const levels = [...reached.values()].map((index) => Math.max(0, index));
  return STAGES.map((stage, i) => ({ stage, label: STAGE_LABELS[stage]!, count: levels.filter((level) => level >= i).length }));
}
```
Ghi chú: khách `lost` không có hoạt động nào được tính ở mốc "Tiếp nhận" (`STAGES.indexOf('lost') = -1` → 0). Các `aggregate` cần `{ deletedAt: null }` vì `$match` đầu tiên có `$and` (plugin xóa mềm chỉ tự thêm khi stage đầu không nhắc `deletedAt` — thêm tường minh cho chắc; `Lead.find/countDocuments` đã có plugin). `TuitionAccount` không xóa mềm nên không cần.

`src/modules/dashboard/dashboard.controller.ts`:
```ts
import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendData } from '../../utils/response';
import * as service from './dashboard.service';
import type { MonthQuery, RegistrationsQuery, ScopeQuery } from './dashboard.validation';

export async function summary(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getSummary(req.scope, validated<ScopeQuery>(req, 'query')));
}

export async function registrations(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getRegistrations(req.scope, validated<RegistrationsQuery>(req, 'query')));
}

export async function sources(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getSources(req.scope, validated<MonthQuery>(req, 'query')));
}

export async function funnel(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getFunnel(req.scope, validated<MonthQuery>(req, 'query')));
}
```

`src/modules/dashboard/dashboard.routes.ts`:
```ts
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as controller from './dashboard.controller';
import { dashboardScopeQuerySchema, monthQuerySchema, registrationsQuerySchema } from './dashboard.validation';

export function createDashboardRouter(): Router {
  const router = Router();
  router.use(authenticate, authorize('dashboard.read', { branchScoped: true }));
  router.get('/summary', validate({ query: dashboardScopeQuerySchema }), controller.summary);
  router.get('/registrations', validate({ query: registrationsQuerySchema }), controller.registrations);
  router.get('/sources', validate({ query: monthQuerySchema }), controller.sources);
  router.get('/funnel', validate({ query: monthQuerySchema }), controller.funnel);
  return router;
}
```
Trong `src/routes/index.ts`: `router.use('/dashboard', createDashboardRouter());`.

- [ ] **Step 4: Chạy test**

Run: `npx vitest run tests/integration/dashboard.test.ts`
Expected: PASS

- [ ] **Step 5: Kiểm tra toàn bộ**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: tất cả pass.

---

### Task 6: Dashboard doanh thu + tỷ lệ đậu, Swagger, README

**Files:**
- Create: `src/modules/dashboard/dashboard.finance.ts`
- Modify: `src/modules/dashboard/dashboard.controller.ts`, `dashboard.routes.ts`, `src/docs/openapi.ts`, `tests/integration/docs.test.ts`, `README.md`
- Test: `tests/integration/dashboard-finance.test.ts`

**Interfaces:**
- Produces:
  - `getRevenue(scope, query: MonthsQuery)` → `{ months: [{ month: 'YYYY-MM', amount }], byCourse: [{ courseCode, amount, share }] }` (đủ `months` tháng, cũ nhất trước; chỉ phiếu chưa hủy; `share` = % làm tròn 1 chữ số).
  - `getPassRate(scope, query: MonthsQuery)` → `[{ courseCode, passed, failed, rate }]` (thí sinh `attempt = 1`, ca `official` không hủy, ngày thi trong `months` tháng gần nhất; `rate` = % làm tròn 1 chữ số; sắp theo `courseCode`).
  - Route `GET /dashboard/revenue`, `GET /dashboard/pass-rate`.

- [ ] **Step 1: Viết test (failing)** — `tests/integration/dashboard-finance.test.ts`

```ts
import { Types } from 'mongoose';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import { ExamCandidate } from '../../src/modules/exams/exam-candidate.model';
import { ExamSession } from '../../src/modules/exams/exam-session.model';
import { Payment } from '../../src/modules/tuition/payment.model';
import { authHeader, createBranch, createCourse, createUser } from '../helpers/factories';

afterEach(() => vi.useRealTimers());

async function setup() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-14T03:00:00Z'));
  const [a, b] = await Promise.all([createBranch({ name: 'A' }), createBranch({ name: 'B' })]);
  const { user: managerA } = await createUser({ role: 'branch_manager', branchIds: [a.id] });
  return { app: createApp(), a, b, managerA };
}

let receipt = 0;
const payment = (branchId: Types.ObjectId, courseCode: string, amount: number, paidAt: string, voided = false) => {
  receipt += 1;
  return {
    tuitionAccountId: new Types.ObjectId(),
    studentId: new Types.ObjectId(),
    branchId,
    courseCode,
    amount,
    method: 'cash',
    paidAt: new Date(paidAt),
    receivedBy: new Types.ObjectId(),
    receiptNo: `PT-TEST-${receipt}`,
    voidedAt: voided ? new Date() : null,
  };
};

describe('GET /dashboard/revenue', () => {
  it('thực thu theo tháng giờ VN, bỏ phiếu đã hủy và chi nhánh khác, kèm cơ cấu theo hạng', async () => {
    const { app, a, b, managerA } = await setup();
    await Payment.create([
      payment(a._id, 'B', 16_000_000, '2026-10-02T03:00:00Z'),
      payment(a._id, 'A1', 4_000_000, '2026-10-05T03:00:00Z'),
      payment(a._id, 'B', 5_000_000, '2026-09-30T16:30:00Z'), // 23:30 30/09 VN → tháng 9
      payment(a._id, 'B', 9_000_000, '2026-10-06T03:00:00Z', true),
      payment(b._id, 'B', 7_000_000, '2026-10-06T03:00:00Z'),
    ]);
    const res = await request(app).get('/api/v1/dashboard/revenue?months=3').set(authHeader(managerA));
    expect(res.status).toBe(200);
    expect(res.body.data.months).toEqual([
      { month: '2026-08', amount: 0 },
      { month: '2026-09', amount: 5_000_000 },
      { month: '2026-10', amount: 20_000_000 },
    ]);
    expect(res.body.data.byCourse).toEqual([
      { courseCode: 'B', amount: 21_000_000, share: 84 },
      { courseCode: 'A1', amount: 4_000_000, share: 16 },
    ]);
  });
});

describe('GET /dashboard/pass-rate', () => {
  it('chỉ lần thi đầu, ca sát hạch không hủy, trong khoảng tháng; theo hạng', async () => {
    const { app, a, managerA } = await setup();
    const [a1, bCourse] = await Promise.all([createCourse({ code: 'A1' }), createCourse({ code: 'B' })]);
    const session = (code: string, courseId: Types.ObjectId, courseCode: string, extra: Record<string, unknown> = {}) =>
      ExamSession.create({ code, type: 'official', courseId, courseCode, branchId: a._id, date: new Date('2026-10-01T00:00:00+07:00'), ...extra });
    const shA1 = await session('SH-A1', a1._id, 'A1');
    const shB = await session('SH-B', bCourse._id, 'B');
    const graduation = await session('TN-B', bCourse._id, 'B', { type: 'graduation' });
    const cancelled = await session('SH-HUY', bCourse._id, 'B', { status: 'cancelled' });
    const old = await session('SH-CU', bCourse._id, 'B', { date: new Date('2025-01-10T00:00:00+07:00') });
    const cand = (sessionId: Types.ObjectId, result: string, attempt = 1) => ({ sessionId, studentId: new Types.ObjectId(), result, attempt });
    await ExamCandidate.create([
      cand(shA1._id, 'passed'), cand(shA1._id, 'passed'), cand(shA1._id, 'failed'), cand(shA1._id, 'absent'),
      cand(shB._id, 'passed'), cand(shB._id, 'failed', 2),
      cand(graduation._id, 'failed'), cand(cancelled._id, 'failed'), cand(old._id, 'failed'),
    ]);
    const res = await request(app).get('/api/v1/dashboard/pass-rate?months=12').set(authHeader(managerA));
    expect(res.body.data).toEqual([
      { courseCode: 'A1', passed: 2, failed: 1, rate: 66.7 },
      { courseCode: 'B', passed: 1, failed: 0, rate: 100 },
    ]);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/integration/dashboard-finance.test.ts`
Expected: FAIL — route 404.

- [ ] **Step 3: Viết code** — `src/modules/dashboard/dashboard.finance.ts`

```ts
import { shiftMonth, vnMonthKey, vnMonthRange } from '../../shared/time';
import { ExamCandidate } from '../exams/exam-candidate.model';
import { ExamSession } from '../exams/exam-session.model';
import { Payment } from '../tuition/payment.model';
import { scopeConditions } from './dashboard.service';
import type { MonthsQuery } from './dashboard.validation';

type Scope = Express.BranchScope | undefined;
const pct = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10);

function window(months: number) {
  const current = vnMonthKey(new Date());
  const first = shiftMonth(current, -(months - 1));
  return { first, keys: Array.from({ length: months }, (_, i) => shiftMonth(first, i)), start: vnMonthRange(first).start, end: vnMonthRange(current).end };
}

export async function getRevenue(scope: Scope, query: MonthsQuery) {
  const { keys, start, end } = window(query.months);
  const match = { $and: [scopeConditions(scope, query.branchId), { voidedAt: null, paidAt: { $gte: start, $lt: end } }] };
  const [byMonth, byCourse] = await Promise.all([
    Payment.aggregate<{ _id: string; amount: number }>([
      { $match: match },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$paidAt', timezone: '+07:00' } }, amount: { $sum: '$amount' } } },
    ]),
    Payment.aggregate<{ _id: string; amount: number }>([
      { $match: match },
      { $group: { _id: '$courseCode', amount: { $sum: '$amount' } } },
      { $sort: { amount: -1, _id: 1 } },
    ]),
  ]);
  const monthly = new Map(byMonth.map((row) => [row._id, row.amount]));
  const total = byCourse.reduce((sum, row) => sum + row.amount, 0);
  return {
    months: keys.map((month) => ({ month, amount: monthly.get(month) ?? 0 })),
    byCourse: byCourse.map((row) => ({ courseCode: row._id, amount: row.amount, share: pct(row.amount, total) })),
  };
}

export async function getPassRate(scope: Scope, query: MonthsQuery) {
  const { start, end } = window(query.months);
  const sessions = await ExamSession.find({
    $and: [scopeConditions(scope, query.branchId), { type: 'official', status: { $ne: 'cancelled' }, date: { $gte: start, $lt: end } }],
  }).select('_id courseCode');
  const courseBySession = new Map(sessions.map((session) => [session.id, session.courseCode]));
  const candidates = await ExamCandidate.find({
    sessionId: { $in: sessions.map((session) => session._id) },
    attempt: 1,
    result: { $in: ['passed', 'failed'] },
  }).select('sessionId result');
  const stats = new Map<string, { passed: number; failed: number }>();
  for (const candidate of candidates) {
    const code = courseBySession.get(candidate.sessionId.toString())!;
    const entry = stats.get(code) ?? { passed: 0, failed: 0 };
    if (candidate.result === 'passed') entry.passed += 1;
    else entry.failed += 1;
    stats.set(code, entry);
  }
  return [...stats.entries()]
    .sort(([x], [y]) => x.localeCompare(y))
    .map(([courseCode, entry]) => ({ courseCode, ...entry, rate: pct(entry.passed, entry.passed + entry.failed) }));
}
```

Thêm vào `dashboard.controller.ts` (import `* as finance from './dashboard.finance'`, type `MonthsQuery`):
```ts
export async function revenue(req: Request, res: Response): Promise<void> {
  sendData(res, await finance.getRevenue(req.scope, validated<MonthsQuery>(req, 'query')));
}

export async function passRate(req: Request, res: Response): Promise<void> {
  sendData(res, await finance.getPassRate(req.scope, validated<MonthsQuery>(req, 'query')));
}
```
Thêm vào `dashboard.routes.ts` (import `monthsQuerySchema`):
```ts
router.get('/revenue', validate({ query: monthsQuerySchema }), controller.revenue);
router.get('/pass-rate', validate({ query: monthsQuerySchema }), controller.passRate);
```

Ghi chú: `ExamSession` có xóa mềm — `find` tự lọc. `Payment` không xóa mềm (hủy = `voidedAt`).

- [ ] **Step 4: Swagger** — thêm vào `paths` trong `src/docs/openapi.ts` (trước các path `/public/...`):

```ts
    '/tuition': {
      get: op('Tài chính', 'Danh sách sổ học phí', { parameters: [...listParams, ...['status', 'branchId', 'courseId'].map((name) => ({ name, in: 'query', schema: { type: 'string' } }))] }),
      post: op('Tài chính', 'Tạo bù sổ học phí cho học viên cũ', { requestBody: json({ studentId: '<studentId>' }) }),
    },
    '/tuition/{id}': {
      get: op('Tài chính', 'Chi tiết sổ (kèm phiếu thu)', { parameters: [idParam] }),
      patch: op('Tài chính', 'Sửa giảm trừ / kế hoạch đóng', {
        parameters: [idParam],
        requestBody: json({ discounts: [{ label: 'HSSV', amount: 1_000_000 }], plan: 'installments', installments: [{ dueDate: '2026-10-10', amount: 7_750_000 }, { dueDate: '2026-11-10', amount: 7_750_000 }] }),
      }),
    },
    '/tuition/{id}/payments': {
      post: op('Tài chính', 'Thu tiền', { parameters: [idParam], requestBody: json({ amount: 5_000_000, method: 'transfer', note: 'Đợt 1' }) }),
    },
    '/tuition/{id}/payments/{paymentId}': {
      delete: op('Tài chính', 'Hủy phiếu thu (super_admin)', {
        parameters: [idParam, { name: 'paymentId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: json({ reason: 'Nhập nhầm số tiền' }),
      }),
    },
    '/dashboard/summary': { get: op('Tổng quan', 'Số liệu tổng quan', { parameters: [{ name: 'branchId', in: 'query', schema: { type: 'string' } }] }) },
    '/dashboard/registrations': { get: op('Tổng quan', 'Khách mới theo ngày', { parameters: ['days', 'branchId'].map((name) => ({ name, in: 'query', schema: { type: 'string' } })) }) },
    '/dashboard/sources': { get: op('Tổng quan', 'Nguồn khách theo tháng', { parameters: ['month', 'branchId'].map((name) => ({ name, in: 'query', schema: { type: 'string' } })) }) },
    '/dashboard/funnel': { get: op('Tổng quan', 'Phễu tuyển sinh theo tháng', { parameters: ['month', 'branchId'].map((name) => ({ name, in: 'query', schema: { type: 'string' } })) }) },
    '/dashboard/revenue': { get: op('Tổng quan', 'Thực thu theo tháng và theo hạng', { parameters: ['months', 'branchId'].map((name) => ({ name, in: 'query', schema: { type: 'string' } })) }) },
    '/dashboard/pass-rate': { get: op('Tổng quan', 'Tỷ lệ đậu sát hạch lần đầu', { parameters: ['months', 'branchId'].map((name) => ({ name, in: 'query', schema: { type: 'string' } })) }) },
```

Trong `tests/integration/docs.test.ts`, thêm vào `arrayContaining`: `'/tuition'`, `'/tuition/{id}/payments'`, `'/tuition/{id}/payments/{paymentId}'`, `'/dashboard/summary'`, `'/dashboard/funnel'`, `'/dashboard/revenue'`, `'/dashboard/pass-rate'`; đổi tên test thành `'/api/docs.json liệt kê endpoint đợt 1–5'`.

- [ ] **Step 5: README** — thêm sau mục "Đào tạo":

```markdown
## Học phí và báo cáo

- **Sổ học phí** tự tạo khi tạo học viên (giá theo chi nhánh, 1 đợt hạn sau 14 ngày). Học viên tạo trước đó: `POST /api/v1/tuition { studentId }`. Sửa giảm trừ / chia đợt: `PATCH /tuition/:id` (tổng các đợt phải bằng tổng học phí).
- **Thu tiền:** `POST /tuition/:id/payments` (quản lý chi nhánh), số phiếu `PT-yyMMdd-NN`, không thu vượt số còn lại. **Hủy phiếu** chỉ super_admin: `DELETE /tuition/:id/payments/:paymentId { reason }` (hủy mềm, giữ để đối soát).
- **Quá hạn:** server tự chạy job mỗi 60 phút (và lúc khởi động); đợt có hạn hôm nay chỉ thành quá hạn từ 00:00 hôm sau (giờ VN).
- **Tổng quan** (`/dashboard/*`): số liệu theo chi nhánh của người xem; doanh thu là **thực thu** theo ngày thu tiền; tỷ lệ đậu là sát hạch lần đầu. Chưa có chỉ tiêu doanh thu.
```

- [ ] **Step 6: Kiểm tra toàn bộ + build**

Run: `npm run typecheck && npm run lint && npx vitest run && npm run build`
Expected: tất cả pass, có `dist/server.js`.
