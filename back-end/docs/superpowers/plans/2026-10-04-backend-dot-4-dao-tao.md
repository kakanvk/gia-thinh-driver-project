# Backend Đợt 4 — Đào tạo: giáo viên, xe tập lái, lớp học, học viên, lịch thi, chuyển khách thành học viên: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Có API cho các màn Giáo viên, Xe tập lái, Lớp học, Lịch thi và hồ sơ học viên; chuyển khách (lead) đã đặt cọc thành học viên; website lấy lịch khai giảng và lịch thi sắp tới qua API công khai.

**Architecture:** Thêm 5 module feature-based: `instructors`, `vehicles`, `classes` (model `TrainingClass`), `students`, `exams` (`ExamSession` + `ExamCandidate`), và endpoint `POST /leads/:id/convert` trong module `leads`. Mọi route admin dùng `branchScoped`; riêng vai trò `instructor` còn bị thu hẹp về **lớp mình phụ trách** qua hồ sơ giáo viên liên kết tài khoản (`Instructor.userId`). Số học viên của lớp, số thí sinh/đậu/vắng của ca thi được **tính khi đọc** (đếm), không lưu.

**Tech Stack:** giữ nguyên các đợt trước (Express 5, Mongoose 8, zod 4, Vitest + Supertest + mongodb-memory-server). Không thêm thư viện.

**Spec:** `docs/superpowers/specs/2026-10-03-backend-api-design.md` — mục 5 (phân quyền), 6 "Đào tạo", 7 (endpoint `students`, `classes`, `instructors`, `vehicles`, `exams`, `/public/classes/upcoming`, `/public/exams/upcoming`, `POST /leads/:id/convert`), 12 đợt 4.

## Global Constraints

- Mọi lệnh chạy trong `back-end/`. **KHÔNG commit, KHÔNG stage.** Kiểm tra: `npm run typecheck && npm run lint && npx vitest run`. **Không chạy `prettier --write` trên cả project** — chỉ format file mình tạo/sửa.
- Dùng lại hạ tầng có sẵn (xem `.superpowers/sdd/2026-10-04-backend-dot-3-crm/context-notes.md`): `validate/validated`, `authenticate`, `authorize(perm, { branchScoped: true })`, `branchFilter`, `assertBranchAccess`, `ApiError`, `sendData/sendList`, `paginate/listQuerySchema`, `objectIdSchema/idParamsSchema/zDateOnly/zDateTime/slugSchema`, `phoneSchema`, `normalizePhone`, `escapeRegex`, `schemaOptions<T>()` (không cast), `softDeletePlugin`, `WITH_DELETED`, `nextSequence`, `formatVn`, `parseDateOnly`, `addFixedDays`, `getBranch`, `Branch`, `Course`, `User`, `recordAudit/snapshot`, `getLead`, `addActivity`, `Lead`.
- Quyền (`src/config/roles.ts`): branch_manager có `student.*`, `class.*`, `instructor.*`, `vehicle.*`, `exam.*`; consultant có `student.read`, `student.create` **và thêm `student.update` trong đợt này**; instructor có `class.read`, `student.read`, `exam.read`; super_admin `*`. editor không có quyền đào tạo.
- **Mọi route admin đào tạo dùng `branchScoped: true`**: đọc id chi nhánh khác → **404**; ghi sang chi nhánh khác → **403 `BRANCH_FORBIDDEN`**.
- **Vai trò `instructor`** chỉ thấy lớp có `instructorId` là hồ sơ giáo viên gắn với tài khoản của mình, học viên của các lớp đó, và ca thi của chi nhánh mình (chỉ đọc). Response học viên trả cho vai trò `instructor` **không có `idNumber`, `address`, `dob`**.
- Ngày (khai giảng, kết thúc, thi, bảo dưỡng, đăng kiểm, ngày sinh, nhập học) nhận `YYYY-MM-DD`, lưu 00:00 giờ VN, trả `+07:00`.
- Thay đổi dữ liệu đào tạo (tạo/sửa/xóa giáo viên, xe, lớp, học viên, ca thi; xếp lớp; nhập kết quả thi) đều ghi audit.
- Response/lỗi chuẩn như các đợt trước, message tiếng Việt.

### Quyết định thiết kế trong đợt này (chi tiết hóa spec)
- **Hạng B số sàn / tự động:** gói học vẫn là `B`; lớp học và xe có thêm `transmission: 'manual' | 'automatic' | null` để phân biệt (khớp bộ lọc "B số sàn / B tự động" ở màn admin).
- **Mã học viên** `HV-yyMMdd-NN` (ngày nhập học giờ VN, tăng theo ngày, dùng `nextSequence`). Mã lớp (vd `A1-VL-2609`) và mã ca thi (vd `SH-2609-01`) do người dùng nhập, tự viết hoa, duy nhất.
- **Trạng thái lớp** do người dùng đặt (`enrolling` → `upcoming` → `ongoing` → `finished`), không tự đổi theo ngày. Lớp `finished` không nhận thêm học viên. Sĩ số = số học viên `studying` + `completed` + `paused` của lớp; vượt `capacity` → 409.
- **Trạng thái ca thi:** `scheduled | done | cancelled` (bỏ `upcoming` trong spec — "sắp diễn ra" suy ra từ ngày). Số thí sinh/đậu/trượt/vắng tính từ `examCandidates`. Thí sinh phải là học viên `studying` cùng chi nhánh **và** cùng gói học với ca thi. `attempt` = số lần đã dự thi cùng loại trước đó + 1. Đậu sát hạch (`official` + `passed`) → học viên tự chuyển `completed`.
- **Chuyển khách thành học viên** chỉ từ trạng thái `deposited` hoặc `docs_completed`; gói học lấy từ body hoặc từ khách; có thể xếp lớp ngay. Không dùng transaction (MongoDB test là standalone): tạo học viên trước, rồi cập nhật lead có điều kiện (`status` chưa đổi và `studentId` còn trống); nếu cập nhật thất bại thì xóa học viên vừa tạo và trả 409. **Sổ học phí sẽ được tạo ở đợt 5** (spec ghi convert tạo cả `tuitionAccount`).
- **Thống kê giáo viên** (`/instructors/:id/stats`): số lớp, số lớp đang hoạt động, số học viên, kết quả sát hạch (đậu/trượt/vắng) và tỷ lệ đậu = đậu/(đậu+trượt) của học viên các lớp giáo viên đó. Chưa có "giờ dạy trong tháng" (chưa có dữ liệu chấm công).
- **Cảnh báo xe** (`/vehicles/alerts?days=30`): xe chưa `paused` có hạn bảo dưỡng hoặc đăng kiểm trong `days` ngày tới hoặc đã quá hạn.
- **Không seed** giáo viên, xe, lớp, học viên (dữ liệu trong `front-end/lib/admin-data.ts` là dữ liệu mẫu có tên/SĐT người).

## Review Focus

1. Giáo viên (vai trò `instructor`) gọi `GET /students/:id` của học viên lớp khác → 404; response học viên không có `idNumber`/`address`/`dob` (Task 4).
2. Hai người xếp học viên vào lớp còn 1 chỗ cùng lúc → không vượt `capacity` quá 1 (chấp nhận rủi ro nhỏ, nhưng tuần tự phải 409) (Task 4).
3. Chuyển khách 2 lần đồng thời → chỉ một học viên được tạo; khách `new`/`lost` không chuyển được (Task 5).
4. Thêm học viên chi nhánh khác hoặc khác gói học vào ca thi → bị từ chối, không thêm một phần rồi lỗi (Task 6).
5. Ngày thi `2026-10-05` không hiện ở `/public/exams/upcoming` khi đã qua ngày 05/10 giờ VN, và vẫn hiện trong ngày 05/10 (Task 6).

---

## File Structure

```
back-end/src/
├── config/roles.ts                           # consultant + 'student.update'
├── shared/time.ts                            # + startOfVnDay
├── shared/zod.ts                             # + atLeastOneField, transmissionSchema
├── shared/codes.ts                           # nextDailyCode(prefix)
├── modules/instructors/  instructor.model.ts instructors.validation.ts instructors.service.ts
│                         instructors.scope.ts instructors.controller.ts instructors.routes.ts
├── modules/vehicles/     vehicle.model.ts vehicles.validation.ts vehicles.service.ts vehicles.controller.ts vehicles.routes.ts
├── modules/classes/      class.model.ts classes.validation.ts classes.service.ts classes.public.ts
│                         classes.controller.ts classes.routes.ts
├── modules/students/     student.model.ts students.validation.ts students.service.ts students.controller.ts students.routes.ts
├── modules/leads/        leads.convert.ts (+ route trong leads.routes.ts)
├── modules/exams/        exam-session.model.ts exam-candidate.model.ts exams.validation.ts exams.service.ts
│                         exams.public.ts exams.controller.ts exams.routes.ts
├── modules/public/public.routes.ts           # + /classes/upcoming, /exams/upcoming
├── routes/index.ts                           # + /instructors /vehicles /classes /students /exams
└── docs/openapi.ts
back-end/tests/
├── helpers/factories.ts                      # + createInstructor, createClass, createStudent
├── unit/time-day.test.ts
└── integration/instructors.test.ts vehicles.test.ts classes.test.ts students.test.ts
                lead-convert.test.ts exams.test.ts instructor-stats.test.ts
```

---

### Task 1: Chuẩn bị chung + Giáo viên (`/instructors`)

**Files:**
- Modify: `src/config/roles.ts` (consultant thêm `'student.update'`), `src/shared/time.ts`, `src/shared/zod.ts`, `src/routes/index.ts`, `tests/helpers/factories.ts`
- Create: `src/shared/codes.ts`, `src/modules/instructors/instructor.model.ts`, `instructors.validation.ts`, `instructors.service.ts`, `instructors.scope.ts`, `instructors.controller.ts`, `instructors.routes.ts`
- Test: `tests/unit/time-day.test.ts`, `tests/integration/instructors.test.ts`

**Interfaces:**
- Produces:
  - `startOfVnDay(date?: Date): Date` (00:00 giờ VN của ngày chứa `date`).
  - `atLeastOneField(schema: z.ZodObject)` → schema có refine "Không có thay đổi nào"; `transmissionSchema = z.enum(['manual','automatic']).nullable()`.
  - `nextDailyCode(prefix: string, now?: Date): Promise<string>` → `${prefix}-yyMMdd-NN`.
  - `Instructor` model (`name`, `phone`, `userId|null`, `specialties: string[]`, `branchId`, `status: active|on_leave|inactive`, `note?`, xóa mềm), `IInstructor`, `InstructorDoc`, `INSTRUCTOR_STATUSES`.
  - `instructorIdsOfUser(userId: string): Promise<Types.ObjectId[]>` (instructors.scope.ts).
  - Service: `listInstructors(scope, query)`, `getInstructor(scope, id)`, `createInstructor(actor, scope, input)`, `updateInstructor(actor, scope, id, input)`, `removeInstructor(actor, scope, id)`, `assertInstructorInBranch(instructorId, branchId)` (dùng ở Task 3).
  - `createInstructorsRouter()`.
  - Test helper `createInstructor(overrides: { branchId: string } & Partial<{ name; phone; userId; specialties; status }>) → Promise<InstructorDoc>`.

- [ ] **Step 1: Viết test (failing)**

`tests/unit/time-day.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { startOfVnDay } from '../../src/shared/time';

describe('startOfVnDay', () => {
  it('00:00 giờ VN của ngày chứa thời điểm', () => {
    expect(startOfVnDay(new Date('2026-10-04T18:30:00Z')).toISOString()).toBe('2026-10-04T17:00:00.000Z');
    expect(startOfVnDay(new Date('2026-10-04T16:59:59Z')).toISOString()).toBe('2026-10-03T17:00:00.000Z');
  });
});
```

Thêm vào `tests/helpers/factories.ts`:
```ts
import { Instructor, type InstructorDoc } from '../../src/modules/instructors/instructor.model';

let instructorSeq = 0;

export async function createInstructor(
  overrides: { branchId: string } & Partial<{
    name: string;
    phone: string;
    userId: string;
    specialties: string[];
    status: 'active' | 'on_leave' | 'inactive';
  }>,
): Promise<InstructorDoc> {
  instructorSeq += 1;
  return Instructor.create({
    name: overrides.name ?? `Giáo viên ${instructorSeq}`,
    phone: overrides.phone ?? `08${String(instructorSeq).padStart(8, '0')}`,
    userId: overrides.userId ?? null,
    specialties: overrides.specialties ?? ['B'],
    branchId: overrides.branchId,
    status: overrides.status ?? 'active',
  });
}
```

`tests/integration/instructors.test.ts`:
```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { authHeader, createBranch, createInstructor, createUser } from '../helpers/factories';

async function setup() {
  const [a, b] = await Promise.all([createBranch({ name: 'A' }), createBranch({ name: 'B' })]);
  const { user: managerA } = await createUser({ role: 'branch_manager', branchIds: [a.id] });
  const { user: consultantA } = await createUser({ role: 'consultant', branchIds: [a.id] });
  return { app: createApp(), a, b, managerA, consultantA };
}

describe('/instructors', () => {
  it('quản lý tạo giáo viên chi nhánh mình: SĐT chuẩn hóa, chuyên môn viết hoa, có audit', async () => {
    const { app, a, managerA } = await setup();
    const res = await request(app)
      .post('/api/v1/instructors')
      .set(authHeader(managerA))
      .send({ name: 'Nguyễn Hoàng Đức', phone: '0907 226 880', specialties: ['b', 'c1'], branchId: a.id });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ phone: '0907226880', specialties: ['B', 'C1'], status: 'active', userId: null });
    expect(await AuditLog.countDocuments({ action: 'instructor.create' })).toBe(1);
  });

  it('chi nhánh khác: tạo → 403 BRANCH_FORBIDDEN, đọc → 404; tư vấn viên không có quyền (403)', async () => {
    const { app, b, managerA, consultantA } = await setup();
    const created = await request(app)
      .post('/api/v1/instructors')
      .set(authHeader(managerA))
      .send({ name: 'GV B', phone: '0907000001', branchId: b.id });
    expect(created.status).toBe(403);
    expect(created.body.error.code).toBe('BRANCH_FORBIDDEN');
    const other = await createInstructor({ branchId: b.id });
    expect((await request(app).get(`/api/v1/instructors/${other.id}`).set(authHeader(managerA))).status).toBe(404);
    expect((await request(app).get('/api/v1/instructors').set(authHeader(consultantA))).status).toBe(403);
  });

  it('liên kết tài khoản: phải là user vai trò instructor cùng chi nhánh, mỗi tài khoản một hồ sơ', async () => {
    const { app, a, b, managerA } = await setup();
    const { user: teacherA } = await createUser({ role: 'instructor', branchIds: [a.id] });
    const { user: teacherB } = await createUser({ role: 'instructor', branchIds: [b.id] });
    const { user: consultant } = await createUser({ role: 'consultant', branchIds: [a.id] });
    const body = (userId: string) => ({ name: 'GV', phone: '0907000002', branchId: a.id, userId });
    expect((await request(app).post('/api/v1/instructors').set(authHeader(managerA)).send(body(teacherB.id))).status).toBe(400);
    expect((await request(app).post('/api/v1/instructors').set(authHeader(managerA)).send(body(consultant.id))).status).toBe(400);
    expect((await request(app).post('/api/v1/instructors').set(authHeader(managerA)).send(body(teacherA.id))).status).toBe(201);
    expect((await request(app).post('/api/v1/instructors').set(authHeader(managerA)).send(body(teacherA.id))).status).toBe(409);
  });

  it('danh sách lọc theo trạng thái và q; sửa; PATCH rỗng → 400; xóa mềm', async () => {
    const { app, a, managerA } = await setup();
    await createInstructor({ branchId: a.id, name: 'Phạm Minh Tuấn', status: 'on_leave' });
    const target = await createInstructor({ branchId: a.id, name: 'Lê Văn Tám' });
    const h = authHeader(managerA);
    expect((await request(app).get('/api/v1/instructors?status=on_leave').set(h)).body.data[0].name).toBe('Phạm Minh Tuấn');
    expect((await request(app).get('/api/v1/instructors?q=t%C3%A1m').set(h)).body.meta.total).toBe(1);
    expect((await request(app).patch(`/api/v1/instructors/${target.id}`).set(h).send({ status: 'inactive' })).body.data.status).toBe('inactive');
    expect((await request(app).patch(`/api/v1/instructors/${target.id}`).set(h).send({})).status).toBe(400);
    expect((await request(app).delete(`/api/v1/instructors/${target.id}`).set(h)).status).toBe(204);
    expect((await request(app).get(`/api/v1/instructors/${target.id}`).set(h)).status).toBe(404);
  });
});
```

Ghi chú: test xóa giáo viên còn lớp đang hoạt động (409) nằm ở Task 3, khi đã có lớp.

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/unit/time-day.test.ts tests/integration/instructors.test.ts`
Expected: FAIL — export/module không tồn tại.

- [ ] **Step 3: Viết code**

`src/config/roles.ts` — trong mảng `consultant`, thêm `'student.update'` ngay sau `'student.create'`.

Thêm vào cuối `src/shared/time.ts`:
```ts
export function startOfVnDay(date: Date = new Date()): Date {
  return parseDateOnly(formatInTimeZone(date, VN_OFFSET, 'yyyy-MM-dd'));
}
```

Thêm vào cuối `src/shared/zod.ts`:
```ts
export function atLeastOneField<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.refine((value) => Object.keys(value).length > 0, { message: 'Không có thay đổi nào' });
}

export const transmissionSchema = z.enum(['manual', 'automatic']).nullable();
```

`src/shared/codes.ts`:
```ts
import { nextSequence } from './mongoose/counter';
import { formatVn } from './time';

export async function nextDailyCode(prefix: string, now: Date = new Date()): Promise<string> {
  const day = formatVn(now, 'yyMMdd');
  const seq = await nextSequence(`${prefix.toLowerCase()}:${day}`);
  return `${prefix}-${day}-${String(seq).padStart(2, '0')}`;
}
```

`src/modules/instructors/instructor.model.ts`:
```ts
import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';
import { softDeletePlugin } from '../../shared/mongoose/softDelete';

export const INSTRUCTOR_STATUSES = ['active', 'on_leave', 'inactive'] as const;
export type InstructorStatus = (typeof INSTRUCTOR_STATUSES)[number];

export interface IInstructor {
  name: string;
  phone: string;
  userId: Types.ObjectId | null;
  specialties: string[];
  branchId: Types.ObjectId;
  status: InstructorStatus;
  note?: string | null;
  deletedAt?: Date | null;
}

export type InstructorDoc = HydratedDocument<IInstructor>;

const instructorSchema = new Schema<IInstructor>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    specialties: { type: [String], default: [] },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    status: { type: String, enum: INSTRUCTOR_STATUSES, default: 'active' },
    note: { type: String, trim: true, default: null },
  },
  schemaOptions<IInstructor>(),
);

instructorSchema.plugin(softDeletePlugin);
instructorSchema.index({ branchId: 1, status: 1 });
instructorSchema.index({ userId: 1 }, { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } });

export const Instructor = model<IInstructor>('Instructor', instructorSchema);
```

`src/modules/instructors/instructors.validation.ts`:
```ts
import { z } from 'zod';
import { listQuerySchema } from '../../shared/mongoose/paginate';
import { atLeastOneField, objectIdSchema } from '../../shared/zod';
import { phoneSchema } from '../users/users.validation';
import { INSTRUCTOR_STATUSES } from './instructor.model';

const specialtiesSchema = z
  .array(z.string().trim().toUpperCase().min(1).max(20))
  .max(10)
  .transform((items) => [...new Set(items)]);

export const createInstructorSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: phoneSchema,
  userId: objectIdSchema.optional(),
  specialties: specialtiesSchema.optional(),
  branchId: objectIdSchema,
  status: z.enum(INSTRUCTOR_STATUSES).optional(),
  note: z.string().trim().max(500).optional(),
});

export const updateInstructorSchema = atLeastOneField(
  z
    .object({
      name: z.string().trim().min(2).max(100),
      phone: phoneSchema,
      userId: objectIdSchema.nullable(),
      specialties: specialtiesSchema,
      status: z.enum(INSTRUCTOR_STATUSES),
      note: z.string().trim().max(500).nullable(),
    })
    .partial(),
);

export const listInstructorsQuerySchema = listQuerySchema.extend({
  status: z.enum(INSTRUCTOR_STATUSES).optional(),
  branchId: objectIdSchema.optional(),
});

export type CreateInstructorInput = z.infer<typeof createInstructorSchema>;
export type UpdateInstructorInput = z.infer<typeof updateInstructorSchema>;
export type ListInstructorsQuery = z.infer<typeof listInstructorsQuerySchema>;
```

`src/modules/instructors/instructors.scope.ts`:
```ts
import type { Types } from 'mongoose';
import { Instructor } from './instructor.model';

/** Hồ sơ giáo viên gắn với tài khoản (dùng để thu hẹp dữ liệu cho vai trò instructor). */
export async function instructorIdsOfUser(userId: string): Promise<Types.ObjectId[]> {
  const profiles = await Instructor.find({ userId }).select('_id');
  return profiles.map((profile) => profile._id);
}
```

`src/modules/instructors/instructors.service.ts`:
```ts
import { Types, type FilterQuery } from 'mongoose';
import { assertBranchAccess, branchFilter } from '../../middlewares/authorize.middleware';
import { paginate } from '../../shared/mongoose/paginate';
import { ApiError } from '../../utils/ApiError';
import { normalizePhone } from '../../utils/phone';
import { escapeRegex } from '../../utils/regex';
import { recordAudit, snapshot } from '../audit/audit.service';
import { getBranch } from '../branches/branches.service';
import { User } from '../users/user.model';
import { Instructor, type IInstructor, type InstructorDoc } from './instructor.model';
import type { CreateInstructorInput, ListInstructorsQuery, UpdateInstructorInput } from './instructors.validation';

type Actor = Express.AuthUser;
type Scope = Express.BranchScope | undefined;

export async function listInstructors(scope: Scope, query: ListInstructorsQuery) {
  const conditions: FilterQuery<IInstructor>[] = [branchFilter(scope)];
  if (query.branchId) {
    assertBranchAccess(scope, query.branchId);
    conditions.push({ branchId: new Types.ObjectId(query.branchId) });
  }
  if (query.status) conditions.push({ status: query.status });
  if (query.q) {
    const text = new RegExp(escapeRegex(query.q), 'i');
    const digits = normalizePhone(query.q).replace(/\D/g, '');
    conditions.push({ $or: [{ name: text }, ...(digits.length >= 3 ? [{ phone: new RegExp(digits) }] : [])] });
  }
  return paginate(Instructor, { $and: conditions }, query, 'name');
}

export async function getInstructor(scope: Scope, id: string): Promise<InstructorDoc> {
  const instructor = await Instructor.findOne({ $and: [{ _id: id }, branchFilter(scope)] });
  if (!instructor) throw ApiError.notFound('Không tìm thấy giáo viên');
  return instructor;
}

async function assertLinkableUser(userId: string, branchId: string, exceptInstructorId?: string): Promise<void> {
  const user = await User.findOne({ _id: userId, role: 'instructor', status: 'active', branchIds: new Types.ObjectId(branchId) });
  if (!user) {
    throw ApiError.badRequest('Tài khoản liên kết phải là giáo viên đang hoạt động thuộc cùng chi nhánh', [
      { path: 'body.userId', message: 'Không hợp lệ' },
    ]);
  }
  const taken = await Instructor.exists({ userId, ...(exceptInstructorId ? { _id: { $ne: exceptInstructorId } } : {}) });
  if (taken) throw ApiError.conflict('Tài khoản này đã gắn với một hồ sơ giáo viên khác');
}

export async function assertInstructorInBranch(instructorId: string, branchId: string): Promise<InstructorDoc> {
  const instructor = await Instructor.findOne({ _id: instructorId, branchId: new Types.ObjectId(branchId), status: { $ne: 'inactive' } });
  if (!instructor) {
    throw ApiError.badRequest('Giáo viên phải thuộc cùng chi nhánh và chưa nghỉ việc', [{ path: 'body.instructorId', message: 'Không hợp lệ' }]);
  }
  return instructor;
}

export async function createInstructor(actor: Actor, scope: Scope, input: CreateInstructorInput): Promise<InstructorDoc> {
  assertBranchAccess(scope, input.branchId);
  await getBranch(input.branchId);
  if (input.userId) await assertLinkableUser(input.userId, input.branchId);
  const instructor = await Instructor.create({ ...input, specialties: input.specialties ?? [], userId: input.userId ?? null });
  await recordAudit({ actorId: actor.id, action: 'instructor.create', entity: 'instructor', entityId: instructor.id, after: snapshot(instructor) });
  return instructor;
}

export async function updateInstructor(actor: Actor, scope: Scope, id: string, input: UpdateInstructorInput): Promise<InstructorDoc> {
  const instructor = await getInstructor(scope, id);
  if (input.userId) await assertLinkableUser(input.userId, instructor.branchId.toString(), id);
  const before = snapshot(instructor);
  instructor.set(input);
  await instructor.save();
  await recordAudit({ actorId: actor.id, action: 'instructor.update', entity: 'instructor', entityId: id, before, after: snapshot(instructor) });
  return instructor;
}

export async function removeInstructor(actor: Actor, scope: Scope, id: string): Promise<void> {
  const instructor = await getInstructor(scope, id);
  const before = snapshot(instructor);
  instructor.deletedAt = new Date();
  instructor.userId = null;
  await instructor.save();
  await recordAudit({ actorId: actor.id, action: 'instructor.delete', entity: 'instructor', entityId: id, before });
}
```
(Task 3 thêm chặn xóa khi còn lớp đang hoạt động vào `removeInstructor`.)

`src/modules/instructors/instructors.controller.ts`:
```ts
import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendData, sendList } from '../../utils/response';
import * as service from './instructors.service';
import type { CreateInstructorInput, ListInstructorsQuery, UpdateInstructorInput } from './instructors.validation';

const idOf = (req: Request) => validated<{ id: string }>(req, 'params').id;

export async function list(req: Request, res: Response): Promise<void> {
  sendList(res, await service.listInstructors(req.scope, validated<ListInstructorsQuery>(req, 'query')));
}

export async function get(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getInstructor(req.scope, idOf(req)));
}

export async function create(req: Request, res: Response): Promise<void> {
  sendData(res, await service.createInstructor(req.user!, req.scope, validated<CreateInstructorInput>(req, 'body')), 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  sendData(res, await service.updateInstructor(req.user!, req.scope, idOf(req), validated<UpdateInstructorInput>(req, 'body')));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.removeInstructor(req.user!, req.scope, idOf(req));
  res.status(204).end();
}
```

`src/modules/instructors/instructors.routes.ts`:
```ts
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../shared/zod';
import * as controller from './instructors.controller';
import { createInstructorSchema, listInstructorsQuerySchema, updateInstructorSchema } from './instructors.validation';

export function createInstructorsRouter(): Router {
  const router = Router();
  const can = (permission: string) => authorize(permission, { branchScoped: true });
  router.use(authenticate);
  router.get('/', can('instructor.read'), validate({ query: listInstructorsQuerySchema }), controller.list);
  router.post('/', can('instructor.create'), validate({ body: createInstructorSchema }), controller.create);
  router.get('/:id', can('instructor.read'), validate({ params: idParamsSchema }), controller.get);
  router.patch('/:id', can('instructor.update'), validate({ params: idParamsSchema, body: updateInstructorSchema }), controller.update);
  router.delete('/:id', can('instructor.delete'), validate({ params: idParamsSchema }), controller.remove);
  return router;
}
```

Trong `src/routes/index.ts`: thêm `router.use('/instructors', createInstructorsRouter());`.

- [ ] **Step 4: Chạy test**

Run: `npx vitest run tests/unit/time-day.test.ts tests/integration/instructors.test.ts tests/unit/roles.test.ts`
Expected: PASS

- [ ] **Step 5: Kiểm tra toàn bộ**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: tất cả pass.

---

### Task 2: Xe tập lái (`/vehicles`) và cảnh báo hạn

**Files:**
- Create: `src/modules/vehicles/vehicle.model.ts`, `vehicles.validation.ts`, `vehicles.service.ts`, `vehicles.controller.ts`, `vehicles.routes.ts`
- Modify: `src/routes/index.ts` (mount `/vehicles`; `/alerts` trước `/:id`)
- Test: `tests/integration/vehicles.test.ts`

**Interfaces:**
- Produces: `Vehicle` model (`plate` unique, `model`, `courseCode`, `transmission`, `branchId`, `odometer`, `datKm`, `lastServiceAt?`, `nextServiceAt?`, `registrationExpiresAt?`, `status: active|maintenance|paused`, `note?`, xóa mềm), `VEHICLE_STATUSES`, `normalizePlate(input): string`, service `listVehicles`, `getVehicle`, `createVehicle`, `updateVehicle`, `removeVehicle`, `listVehicleAlerts(scope, days)` → `[{ vehicle, reasons: [{ type: 'service'|'registration', dueAt, daysLeft, overdue }] }]`, `createVehiclesRouter()`.

- [ ] **Step 1: Viết test (failing)** — `tests/integration/vehicles.test.ts`

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { Vehicle } from '../../src/modules/vehicles/vehicle.model';
import { formatVn } from '../../src/shared/time';
import { authHeader, createBranch, createCourse, createUser } from '../helpers/factories';

const day = (offset: number) => formatVn(new Date(Date.now() + offset * 86_400_000), 'yyyy-MM-dd');

async function setup() {
  const [a, b] = await Promise.all([createBranch({ name: 'A' }), createBranch({ name: 'B' })]);
  await createCourse({ code: 'B', vehicleType: 'car' });
  const { user: managerA } = await createUser({ role: 'branch_manager', branchIds: [a.id] });
  return { app: createApp(), a, b, managerA };
}

const vehicle = (branchId: string, extra: Record<string, unknown> = {}) => ({
  plate: ' 64a-123.45 ',
  model: 'Toyota Vios 1.5G',
  courseCode: 'b',
  transmission: 'automatic',
  branchId,
  odometer: 128_400,
  datKm: 1_240,
  nextServiceAt: day(100),
  registrationExpiresAt: day(200),
  ...extra,
});

describe('/vehicles', () => {
  it('tạo xe: biển số chuẩn hóa, mã hạng viết hoa, ngày giờ VN, có audit', async () => {
    const { app, a, managerA } = await setup();
    const res = await request(app).post('/api/v1/vehicles').set(authHeader(managerA)).send(vehicle(a.id));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ plate: '64A-123.45', courseCode: 'B', transmission: 'automatic', status: 'active' });
    expect(res.body.data.nextServiceAt).toMatch(/T00:00:00\+07:00$/);
    expect(await AuditLog.countDocuments({ action: 'vehicle.create' })).toBe(1);
  });

  it('400: biển số sai định dạng, hạng không tồn tại; 409 trùng biển số', async () => {
    const { app, a, managerA } = await setup();
    const h = authHeader(managerA);
    expect((await request(app).post('/api/v1/vehicles').set(h).send(vehicle(a.id, { plate: 'ABC' }))).status).toBe(400);
    expect((await request(app).post('/api/v1/vehicles').set(h).send(vehicle(a.id, { courseCode: 'Z9' }))).status).toBe(400);
    await Vehicle.init();
    await request(app).post('/api/v1/vehicles').set(h).send(vehicle(a.id));
    expect((await request(app).post('/api/v1/vehicles').set(h).send(vehicle(a.id, { plate: '64A-123.45' }))).status).toBe(409);
  });

  it('chi nhánh khác → 403 khi tạo, 404 khi đọc', async () => {
    const { app, a, b, managerA } = await setup();
    const { user: admin } = await createUser();
    expect((await request(app).post('/api/v1/vehicles').set(authHeader(managerA)).send(vehicle(b.id))).status).toBe(403);
    const other = await request(app).post('/api/v1/vehicles').set(authHeader(admin)).send(vehicle(b.id, { plate: '64C-045.90' }));
    expect((await request(app).get(`/api/v1/vehicles/${other.body.data.id}`).set(authHeader(managerA))).status).toBe(404);
    expect(a.id).toBeTruthy();
  });

  it('cảnh báo: sắp đến hạn hoặc quá hạn trong N ngày, bỏ xe tạm dừng, sắp theo hạn gần nhất', async () => {
    const { app, a, managerA } = await setup();
    const h = authHeader(managerA);
    await request(app).post('/api/v1/vehicles').set(h).send(vehicle(a.id, { plate: '64A-000.01', registrationExpiresAt: day(10) }));
    await request(app).post('/api/v1/vehicles').set(h).send(vehicle(a.id, { plate: '64A-000.02', nextServiceAt: day(-3) }));
    await request(app).post('/api/v1/vehicles').set(h).send(vehicle(a.id, { plate: '64A-000.03' }));
    await request(app).post('/api/v1/vehicles').set(h).send(vehicle(a.id, { plate: '64A-000.04', nextServiceAt: day(5), status: 'paused' }));
    const res = await request(app).get('/api/v1/vehicles/alerts?days=30').set(h);
    expect(res.status).toBe(200);
    expect(res.body.data.map((x: { vehicle: { plate: string } }) => x.vehicle.plate)).toEqual(['64A-000.02', '64A-000.01']);
    expect(res.body.data[0].reasons[0]).toMatchObject({ type: 'service', overdue: true, daysLeft: -3 });
    expect(res.body.data[1].reasons[0]).toMatchObject({ type: 'registration', overdue: false, daysLeft: 10 });
  });

  it('lọc theo trạng thái / hạng; sửa trạng thái; PATCH rỗng 400; xóa mềm', async () => {
    const { app, a, managerA } = await setup();
    const h = authHeader(managerA);
    const { body } = await request(app).post('/api/v1/vehicles').set(h).send(vehicle(a.id));
    const id = body.data.id;
    expect((await request(app).patch(`/api/v1/vehicles/${id}`).set(h).send({ status: 'maintenance', odometer: 128_900 })).body.data.status).toBe('maintenance');
    expect((await request(app).get('/api/v1/vehicles?status=maintenance&courseCode=B').set(h)).body.meta.total).toBe(1);
    expect((await request(app).patch(`/api/v1/vehicles/${id}`).set(h).send({})).status).toBe(400);
    expect((await request(app).delete(`/api/v1/vehicles/${id}`).set(h)).status).toBe(204);
    expect((await request(app).get(`/api/v1/vehicles/${id}`).set(h)).status).toBe(404);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/integration/vehicles.test.ts`
Expected: FAIL — module không tồn tại.

- [ ] **Step 3: Viết code**

`src/modules/vehicles/vehicle.model.ts`:
```ts
import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';
import { softDeletePlugin } from '../../shared/mongoose/softDelete';

export const VEHICLE_STATUSES = ['active', 'maintenance', 'paused'] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];
export const TRANSMISSIONS = ['manual', 'automatic'] as const;

export interface IVehicle {
  plate: string;
  model: string;
  courseCode: string;
  transmission: (typeof TRANSMISSIONS)[number] | null;
  branchId: Types.ObjectId;
  odometer: number;
  datKm: number;
  lastServiceAt?: Date | null;
  nextServiceAt?: Date | null;
  registrationExpiresAt?: Date | null;
  status: VehicleStatus;
  note?: string | null;
  deletedAt?: Date | null;
}

export type VehicleDoc = HydratedDocument<IVehicle>;

const vehicleSchema = new Schema<IVehicle>(
  {
    plate: { type: String, required: true, unique: true, uppercase: true, trim: true },
    model: { type: String, required: true, trim: true },
    courseCode: { type: String, required: true, uppercase: true, trim: true },
    transmission: { type: String, enum: [...TRANSMISSIONS, null], default: null },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    odometer: { type: Number, default: 0, min: 0 },
    datKm: { type: Number, default: 0, min: 0 },
    lastServiceAt: { type: Date, default: null },
    nextServiceAt: { type: Date, default: null },
    registrationExpiresAt: { type: Date, default: null },
    status: { type: String, enum: VEHICLE_STATUSES, default: 'active' },
    note: { type: String, trim: true, default: null },
  },
  schemaOptions<IVehicle>(),
);

vehicleSchema.plugin(softDeletePlugin);
vehicleSchema.index({ branchId: 1, status: 1 });

export const Vehicle = model<IVehicle>('Vehicle', vehicleSchema);
```

`src/modules/vehicles/vehicles.validation.ts`:
```ts
import { z } from 'zod';
import { listQuerySchema } from '../../shared/mongoose/paginate';
import { atLeastOneField, objectIdSchema, transmissionSchema, zDateOnly } from '../../shared/zod';
import { VEHICLE_STATUSES } from './vehicle.model';

const PLATE = /^\d{2}[A-Z][A-Z0-9]?-(\d{3}\.\d{2}|\d{4,5})$/;

export function normalizePlate(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '');
}

const plateSchema = z
  .string()
  .transform(normalizePlate)
  .pipe(z.string().regex(PLATE, 'Biển số không hợp lệ (vd 64A-123.45)'));
const km = z.number().int().min(0).max(5_000_000);
const courseCodeSchema = z.string().trim().toUpperCase().pipe(z.string().regex(/^[A-Z0-9_]{1,10}$/, 'Mã hạng không hợp lệ'));

const fields = {
  plate: plateSchema,
  model: z.string().trim().min(2).max(100),
  courseCode: courseCodeSchema,
  transmission: transmissionSchema.optional(),
  odometer: km.optional(),
  datKm: km.optional(),
  lastServiceAt: zDateOnly.nullable().optional(),
  nextServiceAt: zDateOnly.nullable().optional(),
  registrationExpiresAt: zDateOnly.nullable().optional(),
  status: z.enum(VEHICLE_STATUSES).optional(),
  note: z.string().trim().max(500).nullable().optional(),
};

export const createVehicleSchema = z.object({ ...fields, branchId: objectIdSchema });
export const updateVehicleSchema = atLeastOneField(z.object(fields).partial());
export const listVehiclesQuerySchema = listQuerySchema.extend({
  status: z.enum(VEHICLE_STATUSES).optional(),
  branchId: objectIdSchema.optional(),
  courseCode: courseCodeSchema.optional(),
});
export const alertsQuerySchema = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) });

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type ListVehiclesQuery = z.infer<typeof listVehiclesQuerySchema>;
```

`src/modules/vehicles/vehicles.service.ts`:
```ts
import { Types, type FilterQuery } from 'mongoose';
import { assertBranchAccess, branchFilter } from '../../middlewares/authorize.middleware';
import { paginate } from '../../shared/mongoose/paginate';
import { WITH_DELETED } from '../../shared/mongoose/softDelete';
import { addFixedDays, startOfVnDay } from '../../shared/time';
import { ApiError } from '../../utils/ApiError';
import { escapeRegex } from '../../utils/regex';
import { recordAudit, snapshot } from '../audit/audit.service';
import { getBranch } from '../branches/branches.service';
import { Course } from '../courses/course.model';
import { Vehicle, type IVehicle, type VehicleDoc } from './vehicle.model';
import type { CreateVehicleInput, ListVehiclesQuery, UpdateVehicleInput } from './vehicles.validation';

type Actor = Express.AuthUser;
type Scope = Express.BranchScope | undefined;
const DAY_MS = 86_400_000;

async function assertCourseCode(code: string): Promise<void> {
  if (!(await Course.exists({ code }))) {
    throw ApiError.badRequest('Hạng bằng không tồn tại', [{ path: 'body.courseCode', message: 'Không tồn tại' }]);
  }
}

async function assertPlateFree(plate: string, exceptId?: string): Promise<void> {
  const taken = await Vehicle.exists({ plate, ...WITH_DELETED, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
  if (taken) throw ApiError.conflict('Biển số đã tồn tại', [{ path: 'body.plate', message: 'Đã tồn tại' }]);
}

export async function listVehicles(scope: Scope, query: ListVehiclesQuery) {
  const conditions: FilterQuery<IVehicle>[] = [branchFilter(scope)];
  if (query.branchId) {
    assertBranchAccess(scope, query.branchId);
    conditions.push({ branchId: new Types.ObjectId(query.branchId) });
  }
  if (query.status) conditions.push({ status: query.status });
  if (query.courseCode) conditions.push({ courseCode: query.courseCode });
  if (query.q) {
    const text = new RegExp(escapeRegex(query.q), 'i');
    conditions.push({ $or: [{ plate: text }, { model: text }] });
  }
  return paginate(Vehicle, { $and: conditions }, query, 'plate');
}

export async function getVehicle(scope: Scope, id: string): Promise<VehicleDoc> {
  const vehicle = await Vehicle.findOne({ $and: [{ _id: id }, branchFilter(scope)] });
  if (!vehicle) throw ApiError.notFound('Không tìm thấy xe');
  return vehicle;
}

export async function createVehicle(actor: Actor, scope: Scope, input: CreateVehicleInput): Promise<VehicleDoc> {
  assertBranchAccess(scope, input.branchId);
  await getBranch(input.branchId);
  await assertCourseCode(input.courseCode);
  await assertPlateFree(input.plate);
  const vehicle = await Vehicle.create(input);
  await recordAudit({ actorId: actor.id, action: 'vehicle.create', entity: 'vehicle', entityId: vehicle.id, after: snapshot(vehicle) });
  return vehicle;
}

export async function updateVehicle(actor: Actor, scope: Scope, id: string, input: UpdateVehicleInput): Promise<VehicleDoc> {
  const vehicle = await getVehicle(scope, id);
  if (input.courseCode) await assertCourseCode(input.courseCode);
  if (input.plate && input.plate !== vehicle.plate) await assertPlateFree(input.plate, id);
  const before = snapshot(vehicle);
  vehicle.set(input);
  await vehicle.save();
  await recordAudit({ actorId: actor.id, action: 'vehicle.update', entity: 'vehicle', entityId: id, before, after: snapshot(vehicle) });
  return vehicle;
}

export async function removeVehicle(actor: Actor, scope: Scope, id: string): Promise<void> {
  const vehicle = await getVehicle(scope, id);
  const before = snapshot(vehicle);
  vehicle.deletedAt = new Date();
  await vehicle.save();
  await recordAudit({ actorId: actor.id, action: 'vehicle.delete', entity: 'vehicle', entityId: id, before });
}

export async function listVehicleAlerts(scope: Scope, days: number) {
  const today = startOfVnDay();
  const horizon = addFixedDays(today, days + 1);
  const vehicles = await Vehicle.find({
    $and: [
      branchFilter(scope),
      { status: { $ne: 'paused' } },
      { $or: [{ nextServiceAt: { $ne: null, $lt: horizon } }, { registrationExpiresAt: { $ne: null, $lt: horizon } }] },
    ],
  });
  const reasonOf = (type: 'service' | 'registration', dueAt: Date | null | undefined) => {
    if (!dueAt || dueAt >= horizon) return null;
    const daysLeft = Math.round((dueAt.getTime() - today.getTime()) / DAY_MS);
    return { type, dueAt, daysLeft, overdue: daysLeft < 0 };
  };
  return vehicles
    .map((vehicle) => ({
      vehicle,
      reasons: [reasonOf('service', vehicle.nextServiceAt), reasonOf('registration', vehicle.registrationExpiresAt)]
        .filter((reason): reason is NonNullable<typeof reason> => reason !== null)
        .sort((x, y) => x.daysLeft - y.daysLeft),
    }))
    .sort((x, y) => (x.reasons[0]?.daysLeft ?? 0) - (y.reasons[0]?.daysLeft ?? 0));
}
```

`src/modules/vehicles/vehicles.controller.ts`:
```ts
import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendData, sendList } from '../../utils/response';
import * as service from './vehicles.service';
import type { CreateVehicleInput, ListVehiclesQuery, UpdateVehicleInput } from './vehicles.validation';

const idOf = (req: Request) => validated<{ id: string }>(req, 'params').id;

export async function list(req: Request, res: Response): Promise<void> {
  sendList(res, await service.listVehicles(req.scope, validated<ListVehiclesQuery>(req, 'query')));
}

export async function alerts(req: Request, res: Response): Promise<void> {
  sendData(res, await service.listVehicleAlerts(req.scope, validated<{ days: number }>(req, 'query').days));
}

export async function get(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getVehicle(req.scope, idOf(req)));
}

export async function create(req: Request, res: Response): Promise<void> {
  sendData(res, await service.createVehicle(req.user!, req.scope, validated<CreateVehicleInput>(req, 'body')), 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  sendData(res, await service.updateVehicle(req.user!, req.scope, idOf(req), validated<UpdateVehicleInput>(req, 'body')));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.removeVehicle(req.user!, req.scope, idOf(req));
  res.status(204).end();
}
```

`src/modules/vehicles/vehicles.routes.ts`:
```ts
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../shared/zod';
import * as controller from './vehicles.controller';
import { alertsQuerySchema, createVehicleSchema, listVehiclesQuerySchema, updateVehicleSchema } from './vehicles.validation';

export function createVehiclesRouter(): Router {
  const router = Router();
  const can = (permission: string) => authorize(permission, { branchScoped: true });
  router.use(authenticate);
  router.get('/', can('vehicle.read'), validate({ query: listVehiclesQuerySchema }), controller.list);
  router.get('/alerts', can('vehicle.read'), validate({ query: alertsQuerySchema }), controller.alerts);
  router.post('/', can('vehicle.create'), validate({ body: createVehicleSchema }), controller.create);
  router.get('/:id', can('vehicle.read'), validate({ params: idParamsSchema }), controller.get);
  router.patch('/:id', can('vehicle.update'), validate({ params: idParamsSchema, body: updateVehicleSchema }), controller.update);
  router.delete('/:id', can('vehicle.delete'), validate({ params: idParamsSchema }), controller.remove);
  return router;
}
```

Trong `src/routes/index.ts`: thêm `router.use('/vehicles', createVehiclesRouter());`.

- [ ] **Step 4: Chạy test**

Run: `npx vitest run tests/integration/vehicles.test.ts`
Expected: PASS

- [ ] **Step 5: Kiểm tra toàn bộ**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: tất cả pass.

---

### Task 3: Lớp học (`/classes`) và lịch khai giảng công khai

**Files:**
- Create: `src/modules/classes/class.model.ts`, `classes.validation.ts`, `classes.service.ts`, `classes.public.ts`, `classes.controller.ts`, `classes.routes.ts`
- Modify: `src/modules/instructors/instructors.service.ts` (chặn xóa khi còn lớp hoạt động), `src/modules/public/public.routes.ts`, `src/routes/index.ts`, `tests/helpers/factories.ts` (thêm `createClass`)
- Test: `tests/integration/classes.test.ts`

**Interfaces:**
- Consumes: `assertInstructorInBranch`, `instructorIdsOfUser`, `Course`, `getBranch`.
- Produces:
  - `TrainingClass` model (`code` unique, `courseId`, `courseCode`, `transmission`, `branchId`, `instructorId|null`, `startDate`, `endDate`, `scheduleText`, `capacity`, `status: enrolling|upcoming|ongoing|finished`, `note?`, xóa mềm), `CLASS_STATUSES`, `ACTIVE_CLASS_STATUSES = ['enrolling','upcoming','ongoing']`, `SEATED_STUDENT_STATUSES = ['studying','paused','completed']`.
  - `classScopeFilter(actor, scope): Promise<FilterQuery<ITrainingClass>>` — branch filter, cộng `instructorId ∈ hồ sơ của actor` nếu actor là `instructor`.
  - `seatCounts(classIds): Promise<Map<string, number>>` (đếm học viên — Task 4 có model `Student`; ở task này đếm qua `mongoose.connection.collection('students')` bằng `countDocuments` hoặc aggregate theo tên collection `students` để không phụ thuộc vòng tròn; xem code).
  - Service: `listClasses(actor, scope, query)`, `getClass(actor, scope, id)` (kèm `filled`, `seatsLeft`, `course`, `instructor`), `createClass`, `updateClass`, `removeClass` (409 nếu còn học viên), `listUpcomingClasses(query)`; `createClassesRouter()`.
  - Test helper `createClass(overrides: { branchId: string; courseId: string } & Partial<{ code; instructorId; capacity; status; startDate; endDate; transmission }>) → Promise<TrainingClassDoc>`.

- [ ] **Step 1: Factory và test (failing)**

Thêm vào `tests/helpers/factories.ts`:
```ts
import { TrainingClass, type TrainingClassDoc } from '../../src/modules/classes/class.model';

let classSeq = 0;

export async function createClass(
  overrides: { branchId: string; courseId: string } & Partial<{
    code: string;
    instructorId: string;
    capacity: number;
    status: 'enrolling' | 'upcoming' | 'ongoing' | 'finished';
    startDate: Date;
    endDate: Date;
    transmission: 'manual' | 'automatic' | null;
  }>,
): Promise<TrainingClassDoc> {
  classSeq += 1;
  const startDate = overrides.startDate ?? new Date(Date.now() + 7 * 86_400_000);
  const course = await Course.findById(overrides.courseId);
  return TrainingClass.create({
    code: overrides.code ?? `LOP-${classSeq}`,
    courseId: overrides.courseId,
    courseCode: course?.code ?? 'X',
    transmission: overrides.transmission ?? null,
    branchId: overrides.branchId,
    instructorId: overrides.instructorId ?? null,
    startDate,
    endDate: overrides.endDate ?? new Date(startDate.getTime() + 28 * 86_400_000),
    scheduleText: 'T2–T6 · 08:00',
    capacity: overrides.capacity ?? 50,
    status: overrides.status ?? 'enrolling',
  });
}
```

`tests/integration/classes.test.ts`:
```ts
import mongoose from 'mongoose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { formatVn } from '../../src/shared/time';
import { authHeader, createBranch, createClass, createCourse, createInstructor, createUser } from '../helpers/factories';

const day = (offset: number) => formatVn(new Date(Date.now() + offset * 86_400_000), 'yyyy-MM-dd');

async function setup() {
  const [a, b] = await Promise.all([createBranch({ name: 'Tân Ngãi', slug: 'tan-ngai' }), createBranch({ name: 'B', slug: 'b' })]);
  const course = await createCourse({ code: 'B', name: 'Hạng B', vehicleType: 'car' });
  const { user: managerA } = await createUser({ role: 'branch_manager', branchIds: [a.id] });
  const teacher = await createInstructor({ branchId: a.id, name: 'Trần Quốc Hưng' });
  return { app: createApp(), a, b, course, managerA, teacher };
}

const newClass = (branchId: string, courseId: string, extra: Record<string, unknown> = {}) => ({
  code: 'b-td-2610',
  courseId,
  transmission: 'automatic',
  branchId,
  startDate: day(10),
  endDate: day(38),
  scheduleText: 'T2–T7 · 13:30',
  capacity: 50,
  ...extra,
});

describe('/classes', () => {
  it('tạo lớp: mã viết hoa, lưu mã gói, giáo viên cùng chi nhánh, có audit; trả filled/seatsLeft', async () => {
    const { app, a, course, managerA, teacher } = await setup();
    const res = await request(app)
      .post('/api/v1/classes')
      .set(authHeader(managerA))
      .send(newClass(a.id, course.id, { instructorId: teacher.id }));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ code: 'B-TD-2610', courseCode: 'B', status: 'enrolling', filled: 0, seatsLeft: 50 });
    expect(res.body.data.instructor).toEqual({ id: teacher.id, name: 'Trần Quốc Hưng' });
    expect(await AuditLog.countDocuments({ action: 'class.create' })).toBe(1);
  });

  it('400: ngày kết thúc trước ngày khai giảng, giáo viên chi nhánh khác; 409 trùng mã', async () => {
    const { app, a, b, course, managerA } = await setup();
    const otherTeacher = await createInstructor({ branchId: b.id });
    const h = authHeader(managerA);
    expect((await request(app).post('/api/v1/classes').set(h).send(newClass(a.id, course.id, { endDate: day(5) }))).status).toBe(400);
    expect((await request(app).post('/api/v1/classes').set(h).send(newClass(a.id, course.id, { instructorId: otherTeacher.id }))).status).toBe(400);
    await request(app).post('/api/v1/classes').set(h).send(newClass(a.id, course.id));
    expect((await request(app).post('/api/v1/classes').set(h).send(newClass(a.id, course.id))).status).toBe(409);
  });

  it('filled đếm học viên studying/paused/completed của lớp (không đếm dropped)', async () => {
    const { app, a, course, managerA } = await setup();
    const cls = await createClass({ branchId: a.id, courseId: course.id, capacity: 3 });
    const students = mongoose.connection.collection('students');
    await students.insertMany(
      ['studying', 'paused', 'completed', 'dropped'].map((status, i) => ({
        code: `HV-T-${i}`,
        name: `HV ${i}`,
        phone: `090000000${i}`,
        classId: cls._id,
        branchId: cls.branchId,
        courseId: cls.courseId,
        status,
        deletedAt: null,
      })),
    );
    const res = await request(app).get(`/api/v1/classes/${cls.id}`).set(authHeader(managerA));
    expect(res.body.data).toMatchObject({ filled: 3, seatsLeft: 0 });
  });

  it('giáo viên (vai trò instructor) chỉ thấy lớp mình phụ trách', async () => {
    const { app, a, course } = await setup();
    const { user: teacherUser } = await createUser({ role: 'instructor', branchIds: [a.id] });
    const mine = await createInstructor({ branchId: a.id, userId: teacherUser.id });
    const myClass = await createClass({ branchId: a.id, courseId: course.id, instructorId: mine.id, code: 'CUA-TOI' });
    const other = await createClass({ branchId: a.id, courseId: course.id, code: 'LOP-KHAC' });
    const h = authHeader(teacherUser);
    const list = await request(app).get('/api/v1/classes').set(h);
    expect(list.body.data.map((c: { code: string }) => c.code)).toEqual(['CUA-TOI']);
    expect((await request(app).get(`/api/v1/classes/${other.id}`).set(h)).status).toBe(404);
    expect((await request(app).post('/api/v1/classes').set(h).send(newClass(a.id, course.id))).status).toBe(403);
    expect(myClass.id).toBeTruthy();
  });

  it('xóa lớp còn học viên → 409; xóa giáo viên còn lớp đang hoạt động → 409', async () => {
    const { app, a, course, managerA, teacher } = await setup();
    const cls = await createClass({ branchId: a.id, courseId: course.id, instructorId: teacher.id });
    await mongoose.connection.collection('students').insertOne({ code: 'HV-X', classId: cls._id, status: 'studying', deletedAt: null });
    const h = authHeader(managerA);
    expect((await request(app).delete(`/api/v1/classes/${cls.id}`).set(h)).status).toBe(409);
    expect((await request(app).delete(`/api/v1/instructors/${teacher.id}`).set(h)).status).toBe(409);
  });

  it('GET /public/classes/upcoming: chỉ lớp enrolling/upcoming, theo ngày khai giảng, lọc chi nhánh/hạng, không lộ id nội bộ', async () => {
    const { app, a, b, course } = await setup();
    await createClass({ branchId: a.id, courseId: course.id, code: 'SAU', startDate: new Date(Date.now() + 20 * 86_400_000) });
    await createClass({ branchId: a.id, courseId: course.id, code: 'TRUOC', status: 'upcoming', startDate: new Date(Date.now() + 5 * 86_400_000), capacity: 40 });
    await createClass({ branchId: a.id, courseId: course.id, code: 'DANG-HOC', status: 'ongoing' });
    await createClass({ branchId: b.id, courseId: course.id, code: 'CUA-B' });
    const res = await request(app).get('/api/v1/public/classes/upcoming?branch=tan-ngai&course=b');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toMatchObject({
      course: { code: 'B', name: 'Hạng B' },
      branch: { name: 'Tân Ngãi', slug: 'tan-ngai' },
      status: 'upcoming',
      seatsLeft: 40,
      scheduleText: 'T2–T6 · 08:00',
    });
    expect(res.body.data[0]).not.toHaveProperty('id');
    expect(res.body.data[0]).not.toHaveProperty('instructorId');
    expect((await request(app).get('/api/v1/public/classes/upcoming')).body.data).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/integration/classes.test.ts`
Expected: FAIL — module không tồn tại.

- [ ] **Step 3: Viết code**

`src/modules/classes/class.model.ts`:
```ts
import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';
import { softDeletePlugin } from '../../shared/mongoose/softDelete';

export const CLASS_STATUSES = ['enrolling', 'upcoming', 'ongoing', 'finished'] as const;
export type ClassStatus = (typeof CLASS_STATUSES)[number];
export const ACTIVE_CLASS_STATUSES: ClassStatus[] = ['enrolling', 'upcoming', 'ongoing'];
export const SEATED_STUDENT_STATUSES = ['studying', 'paused', 'completed'];

export interface ITrainingClass {
  code: string;
  courseId: Types.ObjectId;
  courseCode: string;
  transmission: 'manual' | 'automatic' | null;
  branchId: Types.ObjectId;
  instructorId: Types.ObjectId | null;
  startDate: Date;
  endDate: Date;
  scheduleText: string;
  capacity: number;
  status: ClassStatus;
  note?: string | null;
  deletedAt?: Date | null;
}

export type TrainingClassDoc = HydratedDocument<ITrainingClass>;

const classSchema = new Schema<ITrainingClass>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    courseCode: { type: String, required: true },
    transmission: { type: String, enum: ['manual', 'automatic', null], default: null },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    instructorId: { type: Schema.Types.ObjectId, ref: 'Instructor', default: null },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    scheduleText: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 1, max: 200 },
    status: { type: String, enum: CLASS_STATUSES, default: 'enrolling' },
    note: { type: String, trim: true, default: null },
  },
  schemaOptions<ITrainingClass>(),
);

classSchema.plugin(softDeletePlugin);
classSchema.index({ branchId: 1, status: 1, startDate: 1 });
classSchema.index({ instructorId: 1, status: 1 });

export const TrainingClass = model<ITrainingClass>('TrainingClass', classSchema);
```

`src/modules/classes/classes.validation.ts`:
```ts
import { z } from 'zod';
import { listQuerySchema } from '../../shared/mongoose/paginate';
import { atLeastOneField, objectIdSchema, slugSchema, transmissionSchema, zDateOnly } from '../../shared/zod';
import { CLASS_STATUSES } from './class.model';

const codeSchema = z.string().trim().toUpperCase().pipe(z.string().regex(/^[A-Z0-9]+(-[A-Z0-9]+)*$/, 'Mã lớp chỉ gồm chữ, số và dấu gạch ngang').max(30));

const editable = {
  transmission: transmissionSchema.optional(),
  instructorId: objectIdSchema.nullable().optional(),
  startDate: zDateOnly,
  endDate: zDateOnly,
  scheduleText: z.string().trim().min(2).max(100),
  capacity: z.number().int().min(1).max(200),
  status: z.enum(CLASS_STATUSES).optional(),
  note: z.string().trim().max(500).nullable().optional(),
};

const datesInOrder = (value: { startDate?: Date; endDate?: Date }) =>
  !value.startDate || !value.endDate || value.endDate >= value.startDate;

export const createClassSchema = z
  .object({ code: codeSchema, courseId: objectIdSchema, branchId: objectIdSchema, ...editable })
  .refine(datesInOrder, { path: ['endDate'], message: 'Ngày kết thúc phải sau ngày khai giảng' });

export const updateClassSchema = atLeastOneField(z.object({ code: codeSchema, ...editable }).partial()).refine(datesInOrder, {
  path: ['endDate'],
  message: 'Ngày kết thúc phải sau ngày khai giảng',
});

export const listClassesQuerySchema = listQuerySchema.extend({
  status: z.enum(CLASS_STATUSES).optional(),
  branchId: objectIdSchema.optional(),
  courseId: objectIdSchema.optional(),
  instructorId: objectIdSchema.optional(),
});

export const publicClassesQuerySchema = z.object({
  branch: slugSchema.optional(),
  course: z.string().trim().toUpperCase().max(10).optional(),
});

export type CreateClassInput = z.infer<typeof createClassSchema>;
export type UpdateClassInput = z.infer<typeof updateClassSchema>;
export type ListClassesQuery = z.infer<typeof listClassesQuerySchema>;
export type PublicClassesQuery = z.infer<typeof publicClassesQuerySchema>;
```

`src/modules/classes/classes.service.ts`:
```ts
import mongoose, { Types, type FilterQuery } from 'mongoose';
import { assertBranchAccess, branchFilter } from '../../middlewares/authorize.middleware';
import { paginate } from '../../shared/mongoose/paginate';
import { WITH_DELETED } from '../../shared/mongoose/softDelete';
import { ApiError } from '../../utils/ApiError';
import { escapeRegex } from '../../utils/regex';
import { recordAudit, snapshot } from '../audit/audit.service';
import { getBranch } from '../branches/branches.service';
import { Course } from '../courses/course.model';
import { Instructor } from '../instructors/instructor.model';
import { instructorIdsOfUser } from '../instructors/instructors.scope';
import { assertInstructorInBranch } from '../instructors/instructors.service';
import { SEATED_STUDENT_STATUSES, TrainingClass, type ITrainingClass, type TrainingClassDoc } from './class.model';
import type { CreateClassInput, ListClassesQuery, UpdateClassInput } from './classes.validation';

type Actor = Express.AuthUser;
type Scope = Express.BranchScope | undefined;

/** Đếm sĩ số theo lớp, đọc thẳng collection `students` để không phụ thuộc vòng tròn với module students. */
export async function seatCounts(classIds: Types.ObjectId[]): Promise<Map<string, number>> {
  if (classIds.length === 0) return new Map();
  const rows = await mongoose.connection
    .collection('students')
    .aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { classId: { $in: classIds }, status: { $in: SEATED_STUDENT_STATUSES }, deletedAt: null } },
      { $group: { _id: '$classId', count: { $sum: 1 } } },
    ])
    .toArray();
  return new Map(rows.map((row) => [row._id.toString(), row.count]));
}

export async function classScopeFilter(actor: Actor, scope: Scope): Promise<FilterQuery<ITrainingClass>> {
  const conditions: FilterQuery<ITrainingClass>[] = [branchFilter(scope)];
  if (actor.role === 'instructor') conditions.push({ instructorId: { $in: await instructorIdsOfUser(actor.id) } });
  return { $and: conditions };
}

async function present(classes: TrainingClassDoc[]) {
  const [counts, courses, instructors] = await Promise.all([
    seatCounts(classes.map((cls) => cls._id)),
    Course.find({ _id: { $in: classes.map((cls) => cls.courseId) }, ...WITH_DELETED }),
    Instructor.find({ _id: { $in: classes.flatMap((cls) => (cls.instructorId ? [cls.instructorId] : [])) }, ...WITH_DELETED }),
  ]);
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const instructorById = new Map(instructors.map((instructor) => [instructor.id, instructor]));
  return classes.map((cls) => {
    const filled = counts.get(cls.id) ?? 0;
    const course = courseById.get(cls.courseId.toString());
    const instructor = cls.instructorId ? instructorById.get(cls.instructorId.toString()) : undefined;
    return {
      ...(cls.toJSON() as Record<string, unknown>),
      filled,
      seatsLeft: Math.max(0, cls.capacity - filled),
      course: course ? { id: course.id, code: course.code, name: course.name } : null,
      instructor: instructor ? { id: instructor.id, name: instructor.name } : null,
    };
  });
}

export async function getClassDoc(actor: Actor, scope: Scope, id: string): Promise<TrainingClassDoc> {
  const cls = await TrainingClass.findOne({ $and: [{ _id: id }, await classScopeFilter(actor, scope)] });
  if (!cls) throw ApiError.notFound('Không tìm thấy lớp học');
  return cls;
}

export async function listClasses(actor: Actor, scope: Scope, query: ListClassesQuery) {
  const conditions: FilterQuery<ITrainingClass>[] = [await classScopeFilter(actor, scope)];
  if (query.branchId) {
    assertBranchAccess(scope, query.branchId);
    conditions.push({ branchId: new Types.ObjectId(query.branchId) });
  }
  if (query.status) conditions.push({ status: query.status });
  if (query.courseId) conditions.push({ courseId: new Types.ObjectId(query.courseId) });
  if (query.instructorId) conditions.push({ instructorId: new Types.ObjectId(query.instructorId) });
  if (query.q) conditions.push({ code: new RegExp(escapeRegex(query.q), 'i') });
  const result = await paginate(TrainingClass, { $and: conditions }, query, '-startDate');
  return { data: await present(result.data), meta: result.meta };
}

export async function getClass(actor: Actor, scope: Scope, id: string) {
  const [view] = await present([await getClassDoc(actor, scope, id)]);
  return view;
}

async function assertCodeFree(code: string, exceptId?: string): Promise<void> {
  const taken = await TrainingClass.exists({ code, ...WITH_DELETED, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
  if (taken) throw ApiError.conflict('Mã lớp đã tồn tại', [{ path: 'body.code', message: 'Đã tồn tại' }]);
}

export async function createClass(actor: Actor, scope: Scope, input: CreateClassInput) {
  assertBranchAccess(scope, input.branchId);
  await getBranch(input.branchId);
  const course = await Course.findById(input.courseId);
  if (!course) throw ApiError.badRequest('Gói học không tồn tại', [{ path: 'body.courseId', message: 'Không tồn tại' }]);
  if (input.instructorId) await assertInstructorInBranch(input.instructorId, input.branchId);
  await assertCodeFree(input.code);
  const cls = await TrainingClass.create({ ...input, courseCode: course.code, instructorId: input.instructorId ?? null });
  await recordAudit({ actorId: actor.id, action: 'class.create', entity: 'class', entityId: cls.id, after: snapshot(cls) });
  return getClass(actor, scope, cls.id);
}

export async function updateClass(actor: Actor, scope: Scope, id: string, input: UpdateClassInput) {
  const cls = await getClassDoc(actor, scope, id);
  if (input.code && input.code !== cls.code) await assertCodeFree(input.code, id);
  if (input.instructorId) await assertInstructorInBranch(input.instructorId, cls.branchId.toString());
  const startDate = input.startDate ?? cls.startDate;
  const endDate = input.endDate ?? cls.endDate;
  if (endDate < startDate) throw ApiError.badRequest('Ngày kết thúc phải sau ngày khai giảng', [{ path: 'body.endDate', message: 'Không hợp lệ' }]);
  if (input.capacity !== undefined) {
    const filled = (await seatCounts([cls._id])).get(cls.id) ?? 0;
    if (input.capacity < filled) throw ApiError.conflict(`Lớp đang có ${filled} học viên, không thể giảm sĩ số tối đa xuống ${input.capacity}`);
  }
  const before = snapshot(cls);
  cls.set(input);
  await cls.save();
  await recordAudit({ actorId: actor.id, action: 'class.update', entity: 'class', entityId: id, before, after: snapshot(cls) });
  return getClass(actor, scope, id);
}

export async function removeClass(actor: Actor, scope: Scope, id: string): Promise<void> {
  const cls = await getClassDoc(actor, scope, id);
  const hasStudents = await mongoose.connection.collection('students').countDocuments({ classId: cls._id, deletedAt: null }, { limit: 1 });
  if (hasStudents) throw ApiError.conflict('Lớp còn học viên, hãy chuyển học viên sang lớp khác trước');
  const before = snapshot(cls);
  cls.deletedAt = new Date();
  await cls.save();
  await recordAudit({ actorId: actor.id, action: 'class.delete', entity: 'class', entityId: id, before });
}
```

Ghi chú: `present` nạp cả gói học / giáo viên đã xóa mềm (`WITH_DELETED`) để lớp cũ vẫn hiện tên.

Trong `src/modules/instructors/instructors.service.ts` `removeInstructor`, thêm (import `TrainingClass`, `ACTIVE_CLASS_STATUSES` từ `../classes/class.model`) ngay sau `getInstructor`:
```ts
  if (await TrainingClass.exists({ instructorId: instructor._id, status: { $in: ACTIVE_CLASS_STATUSES } })) {
    throw ApiError.conflict('Giáo viên còn phụ trách lớp đang hoạt động, hãy đổi giáo viên cho các lớp đó trước');
  }
```

`src/modules/classes/classes.public.ts`:
```ts
import type { Request, Response } from 'express';
import type { FilterQuery } from 'mongoose';
import { validated } from '../../middlewares/validate.middleware';
import { sendData } from '../../utils/response';
import { Branch } from '../branches/branch.model';
import { Course } from '../courses/course.model';
import { TrainingClass, type ITrainingClass } from './class.model';
import { seatCounts } from './classes.service';
import type { PublicClassesQuery } from './classes.validation';

export async function listUpcomingClasses(query: PublicClassesQuery) {
  const filter: FilterQuery<ITrainingClass> = { status: { $in: ['enrolling', 'upcoming'] } };
  const branches = await Branch.find({ status: 'active', ...(query.branch ? { slug: query.branch } : {}) });
  filter.branchId = { $in: branches.map((branch) => branch._id) };
  if (query.course) filter.courseCode = query.course;
  const classes = await TrainingClass.find(filter).sort({ startDate: 1, _id: 1 }).limit(50);
  const [counts, courses] = await Promise.all([
    seatCounts(classes.map((cls) => cls._id)),
    Course.find({ _id: { $in: classes.map((cls) => cls.courseId) } }),
  ]);
  const branchById = new Map(branches.map((branch) => [branch.id, branch]));
  const courseById = new Map(courses.map((course) => [course.id, course]));
  return classes.flatMap((cls) => {
    const branch = branchById.get(cls.branchId.toString());
    const course = courseById.get(cls.courseId.toString());
    if (!branch || !course || !course.active) return [];
    return [
      {
        code: cls.code,
        course: { code: course.code, name: course.name },
        transmission: cls.transmission,
        branch: { name: branch.name, slug: branch.slug },
        startDate: cls.startDate,
        endDate: cls.endDate,
        scheduleText: cls.scheduleText,
        seatsLeft: Math.max(0, cls.capacity - (counts.get(cls.id) ?? 0)),
        status: cls.status,
      },
    ];
  });
}

export async function upcoming(req: Request, res: Response): Promise<void> {
  sendData(res, await listUpcomingClasses(validated<PublicClassesQuery>(req, 'query')));
}
```

`src/modules/classes/classes.controller.ts`:
```ts
import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendData, sendList } from '../../utils/response';
import * as service from './classes.service';
import type { CreateClassInput, ListClassesQuery, UpdateClassInput } from './classes.validation';

const idOf = (req: Request) => validated<{ id: string }>(req, 'params').id;

export async function list(req: Request, res: Response): Promise<void> {
  sendList(res, await service.listClasses(req.user!, req.scope, validated<ListClassesQuery>(req, 'query')));
}

export async function get(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getClass(req.user!, req.scope, idOf(req)));
}

export async function create(req: Request, res: Response): Promise<void> {
  sendData(res, await service.createClass(req.user!, req.scope, validated<CreateClassInput>(req, 'body')), 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  sendData(res, await service.updateClass(req.user!, req.scope, idOf(req), validated<UpdateClassInput>(req, 'body')));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.removeClass(req.user!, req.scope, idOf(req));
  res.status(204).end();
}
```

`src/modules/classes/classes.routes.ts`:
```ts
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../shared/zod';
import * as controller from './classes.controller';
import { createClassSchema, listClassesQuerySchema, updateClassSchema } from './classes.validation';

export function createClassesRouter(): Router {
  const router = Router();
  const can = (permission: string) => authorize(permission, { branchScoped: true });
  router.use(authenticate);
  router.get('/', can('class.read'), validate({ query: listClassesQuerySchema }), controller.list);
  router.post('/', can('class.create'), validate({ body: createClassSchema }), controller.create);
  router.get('/:id', can('class.read'), validate({ params: idParamsSchema }), controller.get);
  router.patch('/:id', can('class.update'), validate({ params: idParamsSchema, body: updateClassSchema }), controller.update);
  router.delete('/:id', can('class.delete'), validate({ params: idParamsSchema }), controller.remove);
  return router;
}
```
(`GET /classes/:id/students` thêm ở Task 4.)

Trong `src/routes/index.ts`: `router.use('/classes', createClassesRouter());`. Trong `public.routes.ts`: `router.get('/classes/upcoming', validate({ query: publicClassesQuerySchema }), publicClasses.upcoming);` (import từ `../classes/classes.public` và `../classes/classes.validation`).

- [ ] **Step 4: Chạy test**

Run: `npx vitest run tests/integration/classes.test.ts tests/integration/instructors.test.ts`
Expected: PASS

- [ ] **Step 5: Kiểm tra toàn bộ**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: tất cả pass.

---

### Task 4: Học viên (`/students`), xếp lớp, giới hạn cho giáo viên

**Files:**
- Create: `src/modules/students/student.model.ts`, `students.validation.ts`, `students.service.ts`, `students.controller.ts`, `students.routes.ts`
- Modify: `src/modules/classes/classes.routes.ts` (thêm `GET /:id/students`), `src/routes/index.ts`, `tests/helpers/factories.ts` (thêm `createStudent`)
- Test: `tests/integration/students.test.ts`

**Interfaces:**
- Consumes: `TrainingClass`, `seatCounts`, `classScopeFilter`, `getClassDoc`, `instructorIdsOfUser`, `nextDailyCode`, `Course`, `getBranch`.
- Produces:
  - `Student` model (`code` unique, `name`, `phone`, `email?`, `dob?`, `idNumber?` (12 số, unique khi có), `address?`, `courseId`, `courseCode`, `branchId`, `classId|null`, `leadId|null`, `status: studying|paused|completed|dropped`, `enrolledAt`, `note?`, xóa mềm), `STUDENT_STATUSES`, `StudentDoc`.
  - `presentStudent(actor, student)` — bỏ `idNumber`, `address`, `dob` khi `actor.role === 'instructor'`.
  - Service: `listStudents(actor, scope, query)`, `getStudentDoc(actor, scope, id)`, `getStudent(actor, scope, id)`, `createStudent(actor, scope, input & { leadId? })` (dùng lại ở Task 5), `updateStudent`, `assignStudentClass(actor, scope, id, classId|null)`, `removeStudent`, `listClassStudents(actor, scope, classId)`; `createStudentsRouter()`.
  - Test helper `createStudent(overrides: { branchId: string; courseId: string } & Partial<{ name; phone; classId; status; idNumber }>) → Promise<StudentDoc>`.

- [ ] **Step 1: Factory và test (failing)**

Thêm vào `tests/helpers/factories.ts`:
```ts
import { Student, type StudentDoc } from '../../src/modules/students/student.model';

let studentSeq = 0;

export async function createStudent(
  overrides: { branchId: string; courseId: string } & Partial<{
    name: string;
    phone: string;
    classId: string;
    status: 'studying' | 'paused' | 'completed' | 'dropped';
    idNumber: string;
  }>,
): Promise<StudentDoc> {
  studentSeq += 1;
  const course = await Course.findById(overrides.courseId);
  return Student.create({
    code: `HV-TEST-${studentSeq}`,
    name: overrides.name ?? `Học viên ${studentSeq}`,
    phone: overrides.phone ?? `03${String(studentSeq).padStart(8, '0')}`,
    courseId: overrides.courseId,
    courseCode: course?.code ?? 'X',
    branchId: overrides.branchId,
    classId: overrides.classId ?? null,
    status: overrides.status ?? 'studying',
    idNumber: overrides.idNumber ?? null,
    enrolledAt: new Date(),
  });
}
```

`tests/integration/students.test.ts`:
```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { Student } from '../../src/modules/students/student.model';
import {
  authHeader,
  createBranch,
  createClass,
  createCourse,
  createInstructor,
  createStudent,
  createUser,
} from '../helpers/factories';

async function setup() {
  const [a, b] = await Promise.all([createBranch({ name: 'A' }), createBranch({ name: 'B' })]);
  const [courseB, courseA1] = await Promise.all([createCourse({ code: 'B' }), createCourse({ code: 'A1' })]);
  const { user: consultantA } = await createUser({ role: 'consultant', branchIds: [a.id] });
  const { user: managerA } = await createUser({ role: 'branch_manager', branchIds: [a.id] });
  return { app: createApp(), a, b, courseB, courseA1, consultantA, managerA };
}

const newStudent = (branchId: string, courseId: string, extra: Record<string, unknown> = {}) => ({
  name: 'Nguyễn Minh Anh',
  phone: '0903 412 869',
  dob: '2004-05-20',
  idNumber: '086204001234',
  address: 'Tân Ngãi, Vĩnh Long',
  courseId,
  branchId,
  ...extra,
});

describe('/students', () => {
  it('tư vấn viên tạo học viên: mã HV-yyMMdd-NN, mã gói, ngày nhập học mặc định hôm nay, có audit', async () => {
    const { app, a, courseB, consultantA } = await setup();
    const res = await request(app).post('/api/v1/students').set(authHeader(consultantA)).send(newStudent(a.id, courseB.id));
    expect(res.status).toBe(201);
    expect(res.body.data.code).toMatch(/^HV-\d{6}-\d{2,}$/);
    expect(res.body.data).toMatchObject({ phone: '0903412869', courseCode: 'B', status: 'studying', classId: null, dob: '2004-05-20T00:00:00+07:00' });
    expect(res.body.data.enrolledAt).toMatch(/T00:00:00\+07:00$/);
    expect(await AuditLog.countDocuments({ action: 'student.create' })).toBe(1);
  });

  it('400: CCCD không đủ 12 số; 409: trùng CCCD; 403: chi nhánh khác', async () => {
    const { app, a, b, courseB, consultantA } = await setup();
    const h = authHeader(consultantA);
    expect((await request(app).post('/api/v1/students').set(h).send(newStudent(a.id, courseB.id, { idNumber: '123' }))).status).toBe(400);
    await Student.init();
    await request(app).post('/api/v1/students').set(h).send(newStudent(a.id, courseB.id));
    expect((await request(app).post('/api/v1/students').set(h).send(newStudent(a.id, courseB.id, { phone: '0909000000' }))).status).toBe(409);
    const other = await request(app).post('/api/v1/students').set(h).send(newStudent(b.id, courseB.id, { idNumber: '086204009999' }));
    expect(other.body.error.code).toBe('BRANCH_FORBIDDEN');
  });

  it('xếp lớp: cùng chi nhánh + cùng gói + lớp chưa kết thúc + còn chỗ', async () => {
    const { app, a, b, courseB, courseA1, consultantA } = await setup();
    const student = await createStudent({ branchId: a.id, courseId: courseB.id });
    const full = await createClass({ branchId: a.id, courseId: courseB.id, capacity: 1 });
    await createStudent({ branchId: a.id, courseId: courseB.id, classId: full.id });
    const wrongCourse = await createClass({ branchId: a.id, courseId: courseA1.id });
    const finished = await createClass({ branchId: a.id, courseId: courseB.id, status: 'finished' });
    const otherBranch = await createClass({ branchId: b.id, courseId: courseB.id });
    const ok = await createClass({ branchId: a.id, courseId: courseB.id, capacity: 2 });
    const url = `/api/v1/students/${student.id}/class`;
    const h = authHeader(consultantA);
    expect((await request(app).patch(url).set(h).send({ classId: full.id })).status).toBe(409);
    expect((await request(app).patch(url).set(h).send({ classId: wrongCourse.id })).status).toBe(400);
    expect((await request(app).patch(url).set(h).send({ classId: finished.id })).status).toBe(409);
    expect((await request(app).patch(url).set(h).send({ classId: otherBranch.id })).status).toBe(404);
    const assigned = await request(app).patch(url).set(h).send({ classId: ok.id });
    expect(assigned.body.data.classId).toBe(ok.id);
    expect(await AuditLog.countDocuments({ action: 'student.class' })).toBe(1);
    expect((await request(app).patch(url).set(h).send({ classId: null })).body.data.classId).toBeNull();
  });

  it('giáo viên chỉ thấy học viên lớp mình, không có CCCD/địa chỉ/ngày sinh; không sửa được', async () => {
    const { app, a, courseB } = await setup();
    const { user: teacherUser } = await createUser({ role: 'instructor', branchIds: [a.id] });
    const profile = await createInstructor({ branchId: a.id, userId: teacherUser.id });
    const myClass = await createClass({ branchId: a.id, courseId: courseB.id, instructorId: profile.id });
    const mine = await createStudent({ branchId: a.id, courseId: courseB.id, classId: myClass.id, idNumber: '086204001111' });
    const notMine = await createStudent({ branchId: a.id, courseId: courseB.id });
    const h = authHeader(teacherUser);
    const list = await request(app).get('/api/v1/students').set(h);
    expect(list.body.data.map((s: { id: string }) => s.id)).toEqual([mine.id]);
    expect(list.body.data[0]).not.toHaveProperty('idNumber');
    expect(list.body.data[0]).not.toHaveProperty('address');
    expect(list.body.data[0]).not.toHaveProperty('dob');
    expect((await request(app).get(`/api/v1/students/${notMine.id}`).set(h)).status).toBe(404);
    expect((await request(app).patch(`/api/v1/students/${mine.id}`).set(h).send({ name: 'Đổi tên' })).status).toBe(403);
    const roster = await request(app).get(`/api/v1/classes/${myClass.id}/students`).set(h);
    expect(roster.body.data.map((s: { id: string }) => s.id)).toEqual([mine.id]);
  });

  it('lọc theo trạng thái, lớp, q (tên/SĐT/mã/CCCD); sửa; PATCH rỗng 400; tư vấn viên không xóa được, quản lý xóa mềm', async () => {
    const { app, a, courseB, consultantA, managerA } = await setup();
    const student = await createStudent({ branchId: a.id, courseId: courseB.id, name: 'Lê Hoài Thương', idNumber: '086204007777' });
    await createStudent({ branchId: a.id, courseId: courseB.id, status: 'paused' });
    const h = authHeader(consultantA);
    expect((await request(app).get('/api/v1/students?status=paused').set(h)).body.meta.total).toBe(1);
    expect((await request(app).get('/api/v1/students?q=086204007777').set(h)).body.data[0].id).toBe(student.id);
    expect((await request(app).patch(`/api/v1/students/${student.id}`).set(h).send({ status: 'dropped', note: 'Chuyển nơi ở' })).body.data.status).toBe('dropped');
    expect((await request(app).patch(`/api/v1/students/${student.id}`).set(h).send({})).status).toBe(400);
    expect((await request(app).delete(`/api/v1/students/${student.id}`).set(h)).status).toBe(403);
    expect((await request(app).delete(`/api/v1/students/${student.id}`).set(authHeader(managerA))).status).toBe(204);
    expect((await request(app).get(`/api/v1/students/${student.id}`).set(h)).status).toBe(404);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/integration/students.test.ts`
Expected: FAIL — module không tồn tại.

- [ ] **Step 3: Viết code**

`src/modules/students/student.model.ts`:
```ts
import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';
import { softDeletePlugin } from '../../shared/mongoose/softDelete';

export const STUDENT_STATUSES = ['studying', 'paused', 'completed', 'dropped'] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export interface IStudent {
  code: string;
  name: string;
  phone: string;
  email?: string | null;
  dob?: Date | null;
  idNumber?: string | null;
  address?: string | null;
  courseId: Types.ObjectId;
  courseCode: string;
  branchId: Types.ObjectId;
  classId: Types.ObjectId | null;
  leadId?: Types.ObjectId | null;
  status: StudentStatus;
  enrolledAt: Date;
  note?: string | null;
  deletedAt?: Date | null;
}

export type StudentDoc = HydratedDocument<IStudent>;

const studentSchema = new Schema<IStudent>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true, default: null },
    dob: { type: Date, default: null },
    idNumber: { type: String, trim: true, default: null },
    address: { type: String, trim: true, default: null },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    courseCode: { type: String, required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    classId: { type: Schema.Types.ObjectId, ref: 'TrainingClass', default: null },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', default: null },
    status: { type: String, enum: STUDENT_STATUSES, default: 'studying' },
    enrolledAt: { type: Date, required: true },
    note: { type: String, trim: true, default: null },
  },
  schemaOptions<IStudent>(),
);

studentSchema.plugin(softDeletePlugin);
studentSchema.index({ idNumber: 1 }, { unique: true, partialFilterExpression: { idNumber: { $type: 'string' } } });
studentSchema.index({ branchId: 1, status: 1, createdAt: -1 });
studentSchema.index({ classId: 1, status: 1 });
studentSchema.index({ phone: 1 });

export const Student = model<IStudent>('Student', studentSchema);
```

`src/modules/students/students.validation.ts`:
```ts
import { z } from 'zod';
import { listQuerySchema } from '../../shared/mongoose/paginate';
import { atLeastOneField, objectIdSchema, zDateOnly } from '../../shared/zod';
import { phoneSchema } from '../users/users.validation';
import { STUDENT_STATUSES } from './student.model';

const idNumberSchema = z.string().trim().regex(/^\d{12}$/, 'Số CCCD phải gồm 12 chữ số');
const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Email không hợp lệ'));

export const studentProfileFields = {
  name: z.string().trim().min(2).max(100),
  phone: phoneSchema,
  email: emailSchema.optional(),
  dob: zDateOnly.optional(),
  idNumber: idNumberSchema.optional(),
  address: z.string().trim().max(255).optional(),
  note: z.string().trim().max(1000).optional(),
};

export const createStudentSchema = z.object({
  ...studentProfileFields,
  courseId: objectIdSchema,
  branchId: objectIdSchema,
  classId: objectIdSchema.optional(),
  enrolledAt: zDateOnly.optional(),
});

export const updateStudentSchema = atLeastOneField(
  z
    .object({
      name: studentProfileFields.name,
      phone: phoneSchema,
      email: emailSchema.nullable(),
      dob: zDateOnly.nullable(),
      idNumber: idNumberSchema.nullable(),
      address: z.string().trim().max(255).nullable(),
      note: z.string().trim().max(1000).nullable(),
      status: z.enum(STUDENT_STATUSES),
      enrolledAt: zDateOnly,
    })
    .partial(),
);

export const assignClassSchema = z.object({ classId: objectIdSchema.nullable() });

export const listStudentsQuerySchema = listQuerySchema.extend({
  status: z.enum(STUDENT_STATUSES).optional(),
  branchId: objectIdSchema.optional(),
  classId: objectIdSchema.optional(),
  courseId: objectIdSchema.optional(),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;
```

`src/modules/students/students.service.ts`:
```ts
import { Types, type FilterQuery } from 'mongoose';
import { assertBranchAccess, branchFilter } from '../../middlewares/authorize.middleware';
import { nextDailyCode } from '../../shared/codes';
import { paginate } from '../../shared/mongoose/paginate';
import { WITH_DELETED } from '../../shared/mongoose/softDelete';
import { startOfVnDay } from '../../shared/time';
import { ApiError } from '../../utils/ApiError';
import { normalizePhone } from '../../utils/phone';
import { escapeRegex } from '../../utils/regex';
import { recordAudit, snapshot } from '../audit/audit.service';
import { getBranch } from '../branches/branches.service';
import { TrainingClass } from '../classes/class.model';
import { classScopeFilter, getClassDoc, seatCounts } from '../classes/classes.service';
import { Course } from '../courses/course.model';
import { instructorIdsOfUser } from '../instructors/instructors.scope';
import { Student, type IStudent, type StudentDoc } from './student.model';
import type { CreateStudentInput, ListStudentsQuery, UpdateStudentInput } from './students.validation';

type Actor = Express.AuthUser;
type Scope = Express.BranchScope | undefined;
const PRIVATE_FIELDS = ['idNumber', 'address', 'dob'] as const;

export function presentStudent(actor: Actor, student: StudentDoc): Record<string, unknown> {
  const json = student.toJSON() as Record<string, unknown>;
  if (actor.role === 'instructor') for (const field of PRIVATE_FIELDS) delete json[field];
  return json;
}

async function studentScope(actor: Actor, scope: Scope): Promise<FilterQuery<IStudent>> {
  const conditions: FilterQuery<IStudent>[] = [branchFilter(scope)];
  if (actor.role === 'instructor') {
    const classes = await TrainingClass.find({ instructorId: { $in: await instructorIdsOfUser(actor.id) } }).select('_id');
    conditions.push({ classId: { $in: classes.map((cls) => cls._id) } });
  }
  return { $and: conditions };
}

export async function getStudentDoc(actor: Actor, scope: Scope, id: string): Promise<StudentDoc> {
  const student = await Student.findOne({ $and: [{ _id: id }, await studentScope(actor, scope)] });
  if (!student) throw ApiError.notFound('Không tìm thấy học viên');
  return student;
}

export async function getStudent(actor: Actor, scope: Scope, id: string) {
  return presentStudent(actor, await getStudentDoc(actor, scope, id));
}

export async function listStudents(actor: Actor, scope: Scope, query: ListStudentsQuery) {
  const conditions: FilterQuery<IStudent>[] = [await studentScope(actor, scope)];
  if (query.branchId) {
    assertBranchAccess(scope, query.branchId);
    conditions.push({ branchId: new Types.ObjectId(query.branchId) });
  }
  if (query.status) conditions.push({ status: query.status });
  if (query.classId) conditions.push({ classId: new Types.ObjectId(query.classId) });
  if (query.courseId) conditions.push({ courseId: new Types.ObjectId(query.courseId) });
  if (query.q) {
    const text = new RegExp(escapeRegex(query.q), 'i');
    const digits = normalizePhone(query.q).replace(/\D/g, '');
    const or: FilterQuery<IStudent>[] = [{ name: text }, { code: text }];
    if (digits.length >= 3) or.push({ phone: new RegExp(digits) });
    if (/^\d{12}$/.test(query.q.trim()) && actor.role !== 'instructor') or.push({ idNumber: query.q.trim() });
    conditions.push({ $or: or });
  }
  const result = await paginate(Student, { $and: conditions }, query);
  return { data: result.data.map((student) => presentStudent(actor, student)), meta: result.meta };
}

async function assertIdNumberFree(idNumber: string | null | undefined, exceptId?: string): Promise<void> {
  if (!idNumber) return;
  const taken = await Student.exists({ idNumber, ...WITH_DELETED, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
  if (taken) throw ApiError.conflict('Số CCCD đã có trong hồ sơ học viên khác', [{ path: 'body.idNumber', message: 'Đã tồn tại' }]);
}

async function assertClassFor(actor: Actor, scope: Scope, classId: string, student: { branchId: string; courseId: string; exceptStudentId?: string }) {
  const cls = await getClassDoc(actor, scope, classId);
  if (cls.branchId.toString() !== student.branchId) throw ApiError.notFound('Không tìm thấy lớp học');
  if (cls.courseId.toString() !== student.courseId) {
    throw ApiError.badRequest('Lớp không cùng gói học với học viên', [{ path: 'body.classId', message: 'Không hợp lệ' }]);
  }
  if (cls.status === 'finished') throw ApiError.conflict('Lớp đã kết thúc, không nhận thêm học viên');
  const filled = (await seatCounts([cls._id])).get(cls.id) ?? 0;
  if (filled >= cls.capacity) throw ApiError.conflict(`Lớp ${cls.code} đã đủ ${cls.capacity} học viên`);
  return cls;
}

export async function createStudent(actor: Actor, scope: Scope, input: CreateStudentInput & { leadId?: string }): Promise<StudentDoc> {
  assertBranchAccess(scope, input.branchId);
  await getBranch(input.branchId);
  const course = await Course.findById(input.courseId);
  if (!course) throw ApiError.badRequest('Gói học không tồn tại', [{ path: 'body.courseId', message: 'Không tồn tại' }]);
  await assertIdNumberFree(input.idNumber);
  if (input.classId) await assertClassFor(actor, scope, input.classId, { branchId: input.branchId, courseId: input.courseId });
  const enrolledAt = input.enrolledAt ?? startOfVnDay();
  const student = await Student.create({
    ...input,
    code: await nextDailyCode('HV', enrolledAt),
    courseCode: course.code,
    classId: input.classId ?? null,
    leadId: input.leadId ?? null,
    enrolledAt,
    status: 'studying',
  });
  await recordAudit({ actorId: actor.id, action: 'student.create', entity: 'student', entityId: student.id, after: snapshot(student) });
  return student;
}

export async function updateStudent(actor: Actor, scope: Scope, id: string, input: UpdateStudentInput) {
  const student = await getStudentDoc(actor, scope, id);
  if (input.idNumber && input.idNumber !== student.idNumber) await assertIdNumberFree(input.idNumber, id);
  const before = snapshot(student);
  student.set(input);
  await student.save();
  await recordAudit({ actorId: actor.id, action: 'student.update', entity: 'student', entityId: id, before, after: snapshot(student) });
  return presentStudent(actor, student);
}

export async function assignStudentClass(actor: Actor, scope: Scope, id: string, classId: string | null) {
  const student = await getStudentDoc(actor, scope, id);
  if (classId && classId !== student.classId?.toString()) {
    await assertClassFor(actor, scope, classId, { branchId: student.branchId.toString(), courseId: student.courseId.toString() });
  }
  const before = student.classId?.toString() ?? null;
  student.classId = classId ? new Types.ObjectId(classId) : null;
  await student.save();
  await recordAudit({ actorId: actor.id, action: 'student.class', entity: 'student', entityId: id, before: { classId: before }, after: { classId } });
  return presentStudent(actor, student);
}

export async function removeStudent(actor: Actor, scope: Scope, id: string): Promise<void> {
  const student = await getStudentDoc(actor, scope, id);
  const before = snapshot(student);
  student.deletedAt = new Date();
  await student.save();
  await recordAudit({ actorId: actor.id, action: 'student.delete', entity: 'student', entityId: id, before });
}

export async function listClassStudents(actor: Actor, scope: Scope, classId: string) {
  const cls = await TrainingClass.findOne({ $and: [{ _id: classId }, await classScopeFilter(actor, scope)] });
  if (!cls) throw ApiError.notFound('Không tìm thấy lớp học');
  const students = await Student.find({ classId: cls._id }).sort({ name: 1, _id: 1 });
  return students.map((student) => presentStudent(actor, student));
}
```

Ghi chú: `assertClassFor` dùng `getClassDoc` có scope, nên lớp chi nhánh khác trả 404 (khớp test). Kiểm tra sĩ số không atomic — hai người xếp đồng thời vào chỗ cuối cùng có thể vượt 1 (đã ghi ở Review Focus #2, chấp nhận ở đợt này).

`src/modules/students/students.controller.ts`:
```ts
import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendData, sendList } from '../../utils/response';
import * as service from './students.service';
import type { CreateStudentInput, ListStudentsQuery, UpdateStudentInput } from './students.validation';

const idOf = (req: Request) => validated<{ id: string }>(req, 'params').id;

export async function list(req: Request, res: Response): Promise<void> {
  sendList(res, await service.listStudents(req.user!, req.scope, validated<ListStudentsQuery>(req, 'query')));
}

export async function get(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getStudent(req.user!, req.scope, idOf(req)));
}

export async function create(req: Request, res: Response): Promise<void> {
  const student = await service.createStudent(req.user!, req.scope, validated<CreateStudentInput>(req, 'body'));
  sendData(res, service.presentStudent(req.user!, student), 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  sendData(res, await service.updateStudent(req.user!, req.scope, idOf(req), validated<UpdateStudentInput>(req, 'body')));
}

export async function assignClass(req: Request, res: Response): Promise<void> {
  const { classId } = validated<{ classId: string | null }>(req, 'body');
  sendData(res, await service.assignStudentClass(req.user!, req.scope, idOf(req), classId));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.removeStudent(req.user!, req.scope, idOf(req));
  res.status(204).end();
}

export async function listByClass(req: Request, res: Response): Promise<void> {
  sendData(res, await service.listClassStudents(req.user!, req.scope, idOf(req)));
}
```

`src/modules/students/students.routes.ts`:
```ts
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../shared/zod';
import * as controller from './students.controller';
import { assignClassSchema, createStudentSchema, listStudentsQuerySchema, updateStudentSchema } from './students.validation';

export function createStudentsRouter(): Router {
  const router = Router();
  const can = (permission: string) => authorize(permission, { branchScoped: true });
  router.use(authenticate);
  router.get('/', can('student.read'), validate({ query: listStudentsQuerySchema }), controller.list);
  router.post('/', can('student.create'), validate({ body: createStudentSchema }), controller.create);
  router.get('/:id', can('student.read'), validate({ params: idParamsSchema }), controller.get);
  router.patch('/:id', can('student.update'), validate({ params: idParamsSchema, body: updateStudentSchema }), controller.update);
  router.patch('/:id/class', can('student.update'), validate({ params: idParamsSchema, body: assignClassSchema }), controller.assignClass);
  router.delete('/:id', can('student.delete'), validate({ params: idParamsSchema }), controller.remove);
  return router;
}
```

Trong `src/modules/classes/classes.routes.ts` thêm (import `listByClass` từ `../students/students.controller`):
```ts
router.get('/:id/students', can('student.read'), validate({ params: idParamsSchema }), listByClass);
```
Trong `src/routes/index.ts`: `router.use('/students', createStudentsRouter());`.

- [ ] **Step 4: Chạy test**

Run: `npx vitest run tests/integration/students.test.ts tests/integration/classes.test.ts`
Expected: PASS

- [ ] **Step 5: Kiểm tra toàn bộ**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: tất cả pass.

---

### Task 5: Chuyển khách thành học viên — `POST /leads/:id/convert`

**Files:**
- Create: `src/modules/leads/leads.convert.ts`
- Modify: `src/modules/leads/leads.routes.ts`
- Test: `tests/integration/lead-convert.test.ts`

**Interfaces:**
- Consumes: `getLead`, `addActivity`, `Lead`, `createStudent`, `presentStudent`, `Student`, `studentProfileFields`.
- Produces: `convertLeadSchema`, `ConvertLeadInput`, `CONVERTIBLE_STATUSES = ['deposited','docs_completed']`, `convertLead(actor, scope, id, input): Promise<{ lead, student }>`, handler `convert(req, res)`.

- [ ] **Step 1: Viết test (failing)** — `tests/integration/lead-convert.test.ts`

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { LeadActivity } from '../../src/modules/leads/lead-activity.model';
import { Lead } from '../../src/modules/leads/lead.model';
import { Student } from '../../src/modules/students/student.model';
import { authHeader, createBranch, createClass, createCourse, createLead, createUser } from '../helpers/factories';

async function setup() {
  const [a, b] = await Promise.all([createBranch({ name: 'A' }), createBranch({ name: 'B' })]);
  const course = await createCourse({ code: 'B' });
  const { user: consultantA } = await createUser({ role: 'consultant', branchIds: [a.id] });
  return { app: createApp(), a, b, course, consultantA };
}

describe('POST /leads/:id/convert', () => {
  it('khách đã đặt cọc → tạo học viên (lấy tên/SĐT/chi nhánh/gói), xếp lớp, khách "enrolled", có hoạt động', async () => {
    const { app, a, course, consultantA } = await setup();
    const lead = await createLead({ branchId: a.id, name: 'Phạm Gia Huy', phone: '0918440327', status: 'deposited' });
    await Lead.updateOne({ _id: lead._id }, { courseId: course._id, courseCode: 'B' });
    const cls = await createClass({ branchId: a.id, courseId: course.id });
    const res = await request(app)
      .post(`/api/v1/leads/${lead.id}/convert`)
      .set(authHeader(consultantA))
      .send({ classId: cls.id, idNumber: '086204005555', dob: '2003-01-15' });
    expect(res.status).toBe(201);
    expect(res.body.data.student).toMatchObject({ name: 'Phạm Gia Huy', phone: '0918440327', courseCode: 'B', classId: cls.id, leadId: lead.id, branchId: a.id });
    expect(res.body.data.lead).toMatchObject({ status: 'enrolled', studentId: res.body.data.student.id });
    const activity = await LeadActivity.findOne({ leadId: lead._id, type: 'status_change', toStatus: 'enrolled' });
    expect(activity?.content).toContain(res.body.data.student.code);
  });

  it('khách chưa chọn gói thì phải gửi courseId; khách "new"/"lost"/"enrolled" → 409', async () => {
    const { app, a, course, consultantA } = await setup();
    const noCourse = await createLead({ branchId: a.id, status: 'docs_completed' });
    const h = authHeader(consultantA);
    expect((await request(app).post(`/api/v1/leads/${noCourse.id}/convert`).set(h).send({})).status).toBe(400);
    expect((await request(app).post(`/api/v1/leads/${noCourse.id}/convert`).set(h).send({ courseId: course.id })).status).toBe(201);
    for (const status of ['new', 'lost'] as const) {
      const lead = await createLead({ branchId: a.id, status });
      expect((await request(app).post(`/api/v1/leads/${lead.id}/convert`).set(h).send({ courseId: course.id })).status).toBe(409);
    }
    expect((await request(app).post(`/api/v1/leads/${noCourse.id}/convert`).set(h).send({ courseId: course.id })).status).toBe(409);
  });

  it('chuyển đồng thời 2 lần → chỉ 1 học viên', async () => {
    const { app, a, course, consultantA } = await setup();
    const lead = await createLead({ branchId: a.id, status: 'deposited' });
    const h = authHeader(consultantA);
    const results = await Promise.all([
      request(app).post(`/api/v1/leads/${lead.id}/convert`).set(h).send({ courseId: course.id }),
      request(app).post(`/api/v1/leads/${lead.id}/convert`).set(h).send({ courseId: course.id }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await Student.countDocuments({ leadId: lead._id })).toBe(1);
  });

  it('khách chi nhánh khác → 404; lớp đầy → 409 và không tạo học viên', async () => {
    const { app, a, b, course, consultantA } = await setup();
    const other = await createLead({ branchId: b.id, status: 'deposited' });
    const h = authHeader(consultantA);
    expect((await request(app).post(`/api/v1/leads/${other.id}/convert`).set(h).send({ courseId: course.id })).status).toBe(404);
    const lead = await createLead({ branchId: a.id, status: 'deposited' });
    const full = await createClass({ branchId: a.id, courseId: course.id, capacity: 1 });
    await Student.create({ code: 'HV-FULL', name: 'Đã có', phone: '0911111111', courseId: course._id, courseCode: 'B', branchId: a._id, classId: full._id, status: 'studying', enrolledAt: new Date() });
    expect((await request(app).post(`/api/v1/leads/${lead.id}/convert`).set(h).send({ courseId: course.id, classId: full.id })).status).toBe(409);
    expect(await Student.countDocuments({ leadId: lead._id })).toBe(0);
    expect((await Lead.findById(lead.id))?.status).toBe('deposited');
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/integration/lead-convert.test.ts`
Expected: FAIL — 404.

- [ ] **Step 3: Viết code** — `src/modules/leads/leads.convert.ts`

```ts
import type { Request, Response } from 'express';
import { z } from 'zod';
import { branchFilter } from '../../middlewares/authorize.middleware';
import { validated } from '../../middlewares/validate.middleware';
import { objectIdSchema, zDateOnly } from '../../shared/zod';
import { ApiError } from '../../utils/ApiError';
import { sendData } from '../../utils/response';
import { Student } from '../students/student.model';
import { createStudent, presentStudent } from '../students/students.service';
import { studentProfileFields } from '../students/students.validation';
import { Lead } from './lead.model';
import type { LeadStatus } from './lead.status';
import { addActivity } from './leads.activity';
import { getLead } from './leads.service';

export const CONVERTIBLE_STATUSES: LeadStatus[] = ['deposited', 'docs_completed'];

export const convertLeadSchema = z.object({
  courseId: objectIdSchema.optional(),
  classId: objectIdSchema.optional(),
  email: studentProfileFields.email,
  dob: studentProfileFields.dob,
  idNumber: studentProfileFields.idNumber,
  address: studentProfileFields.address,
  note: studentProfileFields.note,
  enrolledAt: zDateOnly.optional(),
});

export type ConvertLeadInput = z.infer<typeof convertLeadSchema>;

export async function convertLead(actor: Express.AuthUser, scope: Express.BranchScope | undefined, id: string, input: ConvertLeadInput) {
  const lead = await getLead(scope, id);
  if (!CONVERTIBLE_STATUSES.includes(lead.status) || lead.studentId) {
    throw ApiError.conflict('Chỉ chuyển thành học viên khi khách đã đặt cọc hoặc hoàn tất hồ sơ');
  }
  const courseId = input.courseId ?? lead.courseId?.toString();
  if (!courseId) throw ApiError.badRequest('Hãy chọn gói học cho học viên', [{ path: 'body.courseId', message: 'Bắt buộc' }]);

  const student = await createStudent(actor, scope, {
    name: lead.name,
    phone: lead.phone,
    email: input.email ?? lead.email ?? undefined,
    dob: input.dob,
    idNumber: input.idNumber,
    address: input.address,
    note: input.note,
    courseId,
    branchId: lead.branchId.toString(),
    classId: input.classId,
    enrolledAt: input.enrolledAt,
    leadId: lead.id,
  });

  const at = new Date();
  const updated = await Lead.findOneAndUpdate(
    { $and: [{ _id: lead._id, status: lead.status, studentId: null }, branchFilter(scope)] },
    { status: 'enrolled', studentId: student._id, lastActivityAt: at },
    { returnDocument: 'after' },
  );
  if (!updated) {
    await Student.deleteOne({ _id: student._id });
    throw ApiError.conflict('Khách vừa được người khác cập nhật, vui lòng tải lại');
  }
  await addActivity(lead.id, {
    type: 'status_change',
    fromStatus: lead.status,
    toStatus: 'enrolled',
    content: `Chuyển thành học viên ${student.code}`,
    byUserId: actor.id,
    at,
  });
  return { lead: updated, student: presentStudent(actor, student) };
}

export async function convert(req: Request, res: Response): Promise<void> {
  const { id } = validated<{ id: string }>(req, 'params');
  sendData(res, await convertLead(req.user!, req.scope, id, validated<ConvertLeadInput>(req, 'body')), 201);
}
```

Trong `src/modules/leads/leads.routes.ts`, thêm (import `convert`, `convertLeadSchema` từ `./leads.convert`):
```ts
router.post('/:id/convert', can('student.create'), validate({ params: idParamsSchema, body: convertLeadSchema }), convert);
```

Ghi chú: `addActivity` trong đợt 3 đã trả document và nhận `at` (xem `leads.activity.ts` hiện tại); nếu chữ ký khác, điều chỉnh lời gọi cho khớp mà không đổi hành vi. Bản ghi audit `student.create` của học viên bị xóa bù (do đua) vẫn còn — chấp nhận, vì audit là nhật ký.

- [ ] **Step 4: Chạy test**

Run: `npx vitest run tests/integration/lead-convert.test.ts tests/integration/leads.test.ts`
Expected: PASS

- [ ] **Step 5: Kiểm tra toàn bộ**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: tất cả pass.

---

### Task 6: Lịch thi (`/exams`), thí sinh, kết quả, lịch thi công khai

**Files:**
- Create: `src/modules/exams/exam-session.model.ts`, `exam-candidate.model.ts`, `exams.validation.ts`, `exams.service.ts`, `exams.public.ts`, `exams.controller.ts`, `exams.routes.ts`
- Modify: `src/modules/public/public.routes.ts`, `src/routes/index.ts`
- Test: `tests/integration/exams.test.ts`

**Interfaces:**
- Produces:
  - `ExamSession` (`code` unique, `type: graduation|official`, `courseId`, `courseCode`, `branchId`, `date`, `location?`, `status: scheduled|done|cancelled`, `note?`, xóa mềm), `ExamCandidate` (`sessionId`, `studentId`, `result: pending|passed|failed|absent`, `score|null`, `attempt`, `note?`; unique `(sessionId, studentId)`), `EXAM_TYPES`, `EXAM_SESSION_STATUSES`, `EXAM_RESULTS`.
  - Service: `listExams(scope, query)` (mỗi ca kèm `stats: { candidates, passed, failed, absent, pending }`), `getExam`, `createExam`, `updateExam`, `removeExam` (409 nếu đã có kết quả), `addCandidates(actor, scope, id, studentIds) → { added: number; skipped: string[] }`, `listCandidates(scope, id)`, `setCandidateResult(actor, scope, id, candidateId, input)`, `removeCandidate(actor, scope, id, candidateId)` (chỉ khi `pending`), `listUpcomingExams(query)`; `createExamsRouter()`.

- [ ] **Step 1: Viết test (failing)** — `tests/integration/exams.test.ts`

```ts
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { ExamCandidate } from '../../src/modules/exams/exam-candidate.model';
import { Student } from '../../src/modules/students/student.model';
import { formatVn } from '../../src/shared/time';
import { authHeader, createBranch, createCourse, createStudent, createUser } from '../helpers/factories';

const day = (offset: number) => formatVn(new Date(Date.now() + offset * 86_400_000), 'yyyy-MM-dd');

async function setup() {
  const [a, b] = await Promise.all([createBranch({ name: 'Tân Ngãi', slug: 'tan-ngai' }), createBranch({ name: 'B', slug: 'b' })]);
  const [courseA1, courseB] = await Promise.all([createCourse({ code: 'A1', name: 'Hạng A1' }), createCourse({ code: 'B', name: 'Hạng B' })]);
  const { user: managerA } = await createUser({ role: 'branch_manager', branchIds: [a.id] });
  return { app: createApp(), a, b, courseA1, courseB, managerA };
}

const session = (branchId: string, courseId: string, extra: Record<string, unknown> = {}) => ({
  code: 'sh-2610-01',
  type: 'official',
  courseId,
  branchId,
  date: day(7),
  location: 'Sân sát hạch Tân Ngãi',
  ...extra,
});

describe('/exams', () => {
  it('tạo ca thi + thêm thí sinh: chỉ học viên đang học cùng chi nhánh & gói; báo bỏ qua; trùng không thêm lại', async () => {
    const { app, a, b, courseA1, courseB, managerA } = await setup();
    const h = authHeader(managerA);
    const created = await request(app).post('/api/v1/exams').set(h).send(session(a.id, courseA1.id));
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ code: 'SH-2610-01', courseCode: 'A1', status: 'scheduled' });
    const ok1 = await createStudent({ branchId: a.id, courseId: courseA1.id });
    const ok2 = await createStudent({ branchId: a.id, courseId: courseA1.id });
    const wrongCourse = await createStudent({ branchId: a.id, courseId: courseB.id });
    const dropped = await createStudent({ branchId: a.id, courseId: courseA1.id, status: 'dropped' });
    const url = `/api/v1/exams/${created.body.data.id}/candidates`;
    const bad = await request(app).post(url).set(h).send({ studentIds: [ok1.id, wrongCourse.id] });
    expect(bad.status).toBe(400);
    expect(await ExamCandidate.countDocuments()).toBe(0);
    const added = await request(app).post(url).set(h).send({ studentIds: [ok1.id, ok2.id] });
    expect(added.body.data).toEqual({ added: 2, skipped: [] });
    const again = await request(app).post(url).set(h).send({ studentIds: [ok1.id] });
    expect(again.body.data).toEqual({ added: 0, skipped: [ok1.id] });
    expect((await request(app).post(url).set(h).send({ studentIds: [dropped.id] })).status).toBe(400);
    expect(b.id).toBeTruthy();
  });

  it('nhập kết quả: thống kê ca thi; đậu sát hạch → học viên hoàn thành; lần thi thứ 2 có attempt 2; có audit', async () => {
    const { app, a, courseA1, managerA } = await setup();
    const h = authHeader(managerA);
    const s1 = await request(app).post('/api/v1/exams').set(h).send(session(a.id, courseA1.id, { date: day(-7) }));
    const student = await createStudent({ branchId: a.id, courseId: courseA1.id });
    const other = await createStudent({ branchId: a.id, courseId: courseA1.id });
    await request(app).post(`/api/v1/exams/${s1.body.data.id}/candidates`).set(h).send({ studentIds: [student.id, other.id] });
    const candidates = await request(app).get(`/api/v1/exams/${s1.body.data.id}/candidates`).set(h);
    const mine = candidates.body.data.find((c: { student: { id: string } }) => c.student.id === student.id);
    const theirs = candidates.body.data.find((c: { student: { id: string } }) => c.student.id === other.id);
    expect(mine).toMatchObject({ result: 'pending', attempt: 1, student: { code: student.code, name: student.name } });
    await request(app).patch(`/api/v1/exams/${s1.body.data.id}/candidates/${mine.id}`).set(h).send({ result: 'failed', score: 18 });
    await request(app).patch(`/api/v1/exams/${s1.body.data.id}/candidates/${theirs.id}`).set(h).send({ result: 'passed', score: 24 });
    expect((await Student.findById(other.id))?.status).toBe('completed');
    expect(await AuditLog.countDocuments({ action: 'exam.result' })).toBe(2);
    const list = await request(app).get('/api/v1/exams').set(h);
    expect(list.body.data[0].stats).toEqual({ candidates: 2, passed: 1, failed: 1, absent: 0, pending: 0 });

    const s2 = await request(app).post('/api/v1/exams').set(h).send(session(a.id, courseA1.id, { code: 'SH-2610-02' }));
    await request(app).post(`/api/v1/exams/${s2.body.data.id}/candidates`).set(h).send({ studentIds: [student.id] });
    expect((await ExamCandidate.findOne({ sessionId: s2.body.data.id }))?.attempt).toBe(2);
  });

  it('ca thi đã hủy không nhập kết quả (409); không xóa ca đã có kết quả (409); thí sinh chưa có kết quả xóa được', async () => {
    const { app, a, courseA1, managerA } = await setup();
    const h = authHeader(managerA);
    const s = await request(app).post('/api/v1/exams').set(h).send(session(a.id, courseA1.id));
    const [x, y] = await Promise.all([createStudent({ branchId: a.id, courseId: courseA1.id }), createStudent({ branchId: a.id, courseId: courseA1.id })]);
    await request(app).post(`/api/v1/exams/${s.body.data.id}/candidates`).set(h).send({ studentIds: [x.id, y.id] });
    const [cx, cy] = await ExamCandidate.find({ sessionId: s.body.data.id }).sort({ _id: 1 });
    expect((await request(app).delete(`/api/v1/exams/${s.body.data.id}/candidates/${cy!.id}`).set(h)).status).toBe(204);
    await request(app).patch(`/api/v1/exams/${s.body.data.id}/candidates/${cx!.id}`).set(h).send({ result: 'absent' });
    expect((await request(app).delete(`/api/v1/exams/${s.body.data.id}`).set(h)).status).toBe(409);
    await request(app).patch(`/api/v1/exams/${s.body.data.id}`).set(h).send({ status: 'cancelled' });
    expect((await request(app).patch(`/api/v1/exams/${s.body.data.id}/candidates/${cx!.id}`).set(h).send({ result: 'passed' })).status).toBe(409);
  });

  it('chi nhánh khác: tạo 403, đọc 404; giáo viên đọc được ca thi chi nhánh mình nhưng không tạo được', async () => {
    const { app, a, b, courseA1, managerA } = await setup();
    const { user: admin } = await createUser();
    const { user: teacher } = await createUser({ role: 'instructor', branchIds: [a.id] });
    expect((await request(app).post('/api/v1/exams').set(authHeader(managerA)).send(session(b.id, courseA1.id))).status).toBe(403);
    const other = await request(app).post('/api/v1/exams').set(authHeader(admin)).send(session(b.id, courseA1.id, { code: 'SH-B' }));
    expect((await request(app).get(`/api/v1/exams/${other.body.data.id}`).set(authHeader(managerA))).status).toBe(404);
    await request(app).post('/api/v1/exams').set(authHeader(managerA)).send(session(a.id, courseA1.id));
    expect((await request(app).get('/api/v1/exams').set(authHeader(teacher))).body.meta.total).toBe(1);
    expect((await request(app).post('/api/v1/exams').set(authHeader(teacher)).send(session(a.id, courseA1.id, { code: 'X' }))).status).toBe(403);
  });

  it('GET /public/exams/upcoming: ca "scheduled" từ hôm nay (giờ VN), không lộ thí sinh/id', async () => {
    const { app, a, courseA1, managerA } = await setup();
    const h = authHeader(managerA);
    await request(app).post('/api/v1/exams').set(h).send(session(a.id, courseA1.id, { code: 'HOM-NAY', date: day(0) }));
    await request(app).post('/api/v1/exams').set(h).send(session(a.id, courseA1.id, { code: 'HOM-QUA', date: day(-1) }));
    await request(app).post('/api/v1/exams').set(h).send(session(a.id, courseA1.id, { code: 'HUY', date: day(3), status: 'cancelled' }));
    await request(app).post('/api/v1/exams').set(h).send(session(a.id, courseA1.id, { code: 'TUAN-SAU', date: day(7), type: 'graduation' }));
    const res = await request(app).get('/api/v1/public/exams/upcoming?branch=tan-ngai');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toEqual({
      type: 'official',
      course: { code: 'A1', name: 'Hạng A1' },
      branch: { name: 'Tân Ngãi', slug: 'tan-ngai' },
      date: `${day(0)}T00:00:00+07:00`,
      location: 'Sân sát hạch Tân Ngãi',
    });
  });

  it('ngày thi đã qua trong giờ VN thì không còn ở lịch công khai', async () => {
    const { app, a, courseA1, managerA } = await setup();
    await request(app).post('/api/v1/exams').set(authHeader(managerA)).send(session(a.id, courseA1.id, { date: '2026-10-05' }));
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-10-05T16:59:00Z')); // 23:59 ngày 05/10 giờ VN
      expect((await request(app).get('/api/v1/public/exams/upcoming')).body.data).toHaveLength(1);
      vi.setSystemTime(new Date('2026-10-05T17:00:00Z')); // 00:00 ngày 06/10 giờ VN
      expect((await request(app).get('/api/v1/public/exams/upcoming')).body.data).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/integration/exams.test.ts`
Expected: FAIL — module không tồn tại.

- [ ] **Step 3: Viết code**

`src/modules/exams/exam-session.model.ts`:
```ts
import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';
import { softDeletePlugin } from '../../shared/mongoose/softDelete';

export const EXAM_TYPES = ['graduation', 'official'] as const;
export const EXAM_SESSION_STATUSES = ['scheduled', 'done', 'cancelled'] as const;
export type ExamType = (typeof EXAM_TYPES)[number];

export interface IExamSession {
  code: string;
  type: ExamType;
  courseId: Types.ObjectId;
  courseCode: string;
  branchId: Types.ObjectId;
  date: Date;
  location?: string | null;
  status: (typeof EXAM_SESSION_STATUSES)[number];
  note?: string | null;
  deletedAt?: Date | null;
}

export type ExamSessionDoc = HydratedDocument<IExamSession>;

const examSessionSchema = new Schema<IExamSession>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    type: { type: String, enum: EXAM_TYPES, required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    courseCode: { type: String, required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    date: { type: Date, required: true },
    location: { type: String, trim: true, default: null },
    status: { type: String, enum: EXAM_SESSION_STATUSES, default: 'scheduled' },
    note: { type: String, trim: true, default: null },
  },
  schemaOptions<IExamSession>(),
);

examSessionSchema.plugin(softDeletePlugin);
examSessionSchema.index({ branchId: 1, date: -1 });
examSessionSchema.index({ status: 1, date: 1 });

export const ExamSession = model<IExamSession>('ExamSession', examSessionSchema);
```

`src/modules/exams/exam-candidate.model.ts`:
```ts
import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';

export const EXAM_RESULTS = ['pending', 'passed', 'failed', 'absent'] as const;
export type ExamResult = (typeof EXAM_RESULTS)[number];

export interface IExamCandidate {
  sessionId: Types.ObjectId;
  studentId: Types.ObjectId;
  result: ExamResult;
  score: number | null;
  attempt: number;
  note?: string | null;
}

export type ExamCandidateDoc = HydratedDocument<IExamCandidate>;

const examCandidateSchema = new Schema<IExamCandidate>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'ExamSession', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    result: { type: String, enum: EXAM_RESULTS, default: 'pending' },
    score: { type: Number, default: null, min: 0, max: 1000 },
    attempt: { type: Number, required: true, min: 1 },
    note: { type: String, trim: true, default: null },
  },
  schemaOptions<IExamCandidate>(),
);

examCandidateSchema.index({ sessionId: 1, studentId: 1 }, { unique: true });
examCandidateSchema.index({ studentId: 1 });

export const ExamCandidate = model<IExamCandidate>('ExamCandidate', examCandidateSchema);
```

`src/modules/exams/exams.validation.ts`:
```ts
import { z } from 'zod';
import { listQuerySchema } from '../../shared/mongoose/paginate';
import { atLeastOneField, objectIdSchema, slugSchema, zDateOnly } from '../../shared/zod';
import { EXAM_RESULTS } from './exam-candidate.model';
import { EXAM_SESSION_STATUSES, EXAM_TYPES } from './exam-session.model';

const codeSchema = z.string().trim().toUpperCase().pipe(z.string().regex(/^[A-Z0-9]+(-[A-Z0-9]+)*$/, 'Mã ca thi chỉ gồm chữ, số và dấu gạch ngang').max(30));

export const createExamSchema = z.object({
  code: codeSchema,
  type: z.enum(EXAM_TYPES),
  courseId: objectIdSchema,
  branchId: objectIdSchema,
  date: zDateOnly,
  location: z.string().trim().max(200).optional(),
  status: z.enum(EXAM_SESSION_STATUSES).optional(),
  note: z.string().trim().max(500).optional(),
});

export const updateExamSchema = atLeastOneField(
  z
    .object({
      code: codeSchema,
      date: zDateOnly,
      location: z.string().trim().max(200).nullable(),
      status: z.enum(EXAM_SESSION_STATUSES),
      note: z.string().trim().max(500).nullable(),
    })
    .partial(),
);

export const addCandidatesSchema = z.object({ studentIds: z.array(objectIdSchema).min(1).max(200) });
export const candidateParamsSchema = z.object({ id: objectIdSchema, candidateId: objectIdSchema });
export const candidateResultSchema = z.object({
  result: z.enum(EXAM_RESULTS),
  score: z.number().min(0).max(1000).nullable().optional(),
  note: z.string().trim().max(500).optional(),
});

export const listExamsQuerySchema = listQuerySchema.extend({
  type: z.enum(EXAM_TYPES).optional(),
  status: z.enum(EXAM_SESSION_STATUSES).optional(),
  branchId: objectIdSchema.optional(),
  courseId: objectIdSchema.optional(),
  from: zDateOnly.optional(),
  to: zDateOnly.optional(),
});

export const publicExamsQuerySchema = z.object({
  branch: slugSchema.optional(),
  course: z.string().trim().toUpperCase().max(10).optional(),
});

export type CreateExamInput = z.infer<typeof createExamSchema>;
export type UpdateExamInput = z.infer<typeof updateExamSchema>;
export type CandidateResultInput = z.infer<typeof candidateResultSchema>;
export type ListExamsQuery = z.infer<typeof listExamsQuerySchema>;
export type PublicExamsQuery = z.infer<typeof publicExamsQuerySchema>;
```

`src/modules/exams/exams.service.ts`:
```ts
import { Types, type FilterQuery } from 'mongoose';
import { assertBranchAccess, branchFilter } from '../../middlewares/authorize.middleware';
import { paginate } from '../../shared/mongoose/paginate';
import { WITH_DELETED } from '../../shared/mongoose/softDelete';
import { addFixedDays } from '../../shared/time';
import { ApiError } from '../../utils/ApiError';
import { escapeRegex } from '../../utils/regex';
import { recordAudit, snapshot } from '../audit/audit.service';
import { getBranch } from '../branches/branches.service';
import { Course } from '../courses/course.model';
import { Student } from '../students/student.model';
import { ExamCandidate, type ExamResult } from './exam-candidate.model';
import { ExamSession, type ExamSessionDoc, type IExamSession } from './exam-session.model';
import type { CandidateResultInput, CreateExamInput, ListExamsQuery, UpdateExamInput } from './exams.validation';

type Actor = Express.AuthUser;
type Scope = Express.BranchScope | undefined;
type Stats = Record<'candidates' | ExamResult, number>;

const emptyStats = (): Stats => ({ candidates: 0, passed: 0, failed: 0, absent: 0, pending: 0 });

async function statsFor(sessionIds: Types.ObjectId[]): Promise<Map<string, Stats>> {
  const rows = await ExamCandidate.aggregate<{ _id: { sessionId: Types.ObjectId; result: ExamResult }; count: number }>([
    { $match: { sessionId: { $in: sessionIds } } },
    { $group: { _id: { sessionId: '$sessionId', result: '$result' }, count: { $sum: 1 } } },
  ]);
  const stats = new Map<string, Stats>();
  for (const row of rows) {
    const key = row._id.sessionId.toString();
    const entry = stats.get(key) ?? emptyStats();
    entry[row._id.result] += row.count;
    entry.candidates += row.count;
    stats.set(key, entry);
  }
  return stats;
}

export async function getExamDoc(scope: Scope, id: string): Promise<ExamSessionDoc> {
  const session = await ExamSession.findOne({ $and: [{ _id: id }, branchFilter(scope)] });
  if (!session) throw ApiError.notFound('Không tìm thấy ca thi');
  return session;
}

export async function getExam(scope: Scope, id: string) {
  const session = await getExamDoc(scope, id);
  const stats = (await statsFor([session._id])).get(session.id) ?? emptyStats();
  return { ...(session.toJSON() as Record<string, unknown>), stats };
}

export async function listExams(scope: Scope, query: ListExamsQuery) {
  const conditions: FilterQuery<IExamSession>[] = [branchFilter(scope)];
  if (query.branchId) {
    assertBranchAccess(scope, query.branchId);
    conditions.push({ branchId: new Types.ObjectId(query.branchId) });
  }
  if (query.type) conditions.push({ type: query.type });
  if (query.status) conditions.push({ status: query.status });
  if (query.courseId) conditions.push({ courseId: new Types.ObjectId(query.courseId) });
  if (query.from || query.to) {
    conditions.push({ date: { ...(query.from ? { $gte: query.from } : {}), ...(query.to ? { $lt: addFixedDays(query.to, 1) } : {}) } });
  }
  if (query.q) conditions.push({ code: new RegExp(escapeRegex(query.q), 'i') });
  const result = await paginate(ExamSession, { $and: conditions }, query, '-date');
  const stats = await statsFor(result.data.map((session) => session._id));
  return {
    data: result.data.map((session) => ({ ...(session.toJSON() as Record<string, unknown>), stats: stats.get(session.id) ?? emptyStats() })),
    meta: result.meta,
  };
}

async function assertCodeFree(code: string, exceptId?: string): Promise<void> {
  const taken = await ExamSession.exists({ code, ...WITH_DELETED, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
  if (taken) throw ApiError.conflict('Mã ca thi đã tồn tại', [{ path: 'body.code', message: 'Đã tồn tại' }]);
}

export async function createExam(actor: Actor, scope: Scope, input: CreateExamInput) {
  assertBranchAccess(scope, input.branchId);
  await getBranch(input.branchId);
  const course = await Course.findById(input.courseId);
  if (!course) throw ApiError.badRequest('Gói học không tồn tại', [{ path: 'body.courseId', message: 'Không tồn tại' }]);
  await assertCodeFree(input.code);
  const session = await ExamSession.create({ ...input, courseCode: course.code });
  await recordAudit({ actorId: actor.id, action: 'exam.create', entity: 'exam', entityId: session.id, after: snapshot(session) });
  return getExam(scope, session.id);
}

export async function updateExam(actor: Actor, scope: Scope, id: string, input: UpdateExamInput) {
  const session = await getExamDoc(scope, id);
  if (input.code && input.code !== session.code) await assertCodeFree(input.code, id);
  const before = snapshot(session);
  session.set(input);
  await session.save();
  await recordAudit({ actorId: actor.id, action: 'exam.update', entity: 'exam', entityId: id, before, after: snapshot(session) });
  return getExam(scope, id);
}

export async function removeExam(actor: Actor, scope: Scope, id: string): Promise<void> {
  const session = await getExamDoc(scope, id);
  if (await ExamCandidate.exists({ sessionId: session._id, result: { $ne: 'pending' } })) {
    throw ApiError.conflict('Ca thi đã có kết quả, không thể xóa (có thể chuyển sang "đã hủy")');
  }
  const before = snapshot(session);
  await ExamCandidate.deleteMany({ sessionId: session._id });
  session.deletedAt = new Date();
  await session.save();
  await recordAudit({ actorId: actor.id, action: 'exam.delete', entity: 'exam', entityId: id, before });
}

export async function addCandidates(actor: Actor, scope: Scope, id: string, studentIds: string[]) {
  const session = await getExamDoc(scope, id);
  if (session.status !== 'scheduled') throw ApiError.conflict('Chỉ thêm thí sinh vào ca thi đang lên lịch');
  const unique = [...new Set(studentIds)];
  const students = await Student.find({
    _id: { $in: unique },
    branchId: session.branchId,
    courseId: session.courseId,
    status: 'studying',
  });
  if (students.length !== unique.length) {
    const okIds = new Set(students.map((student) => student.id));
    throw ApiError.badRequest('Có học viên không hợp lệ cho ca thi này (khác chi nhánh, khác gói học hoặc không còn đang học)', [
      { path: 'body.studentIds', message: unique.filter((studentId) => !okIds.has(studentId)).join(',') },
    ]);
  }
  const existing = await ExamCandidate.find({ sessionId: session._id, studentId: { $in: unique } });
  const skipped = existing.map((candidate) => candidate.studentId.toString());
  const toAdd = unique.filter((studentId) => !skipped.includes(studentId));
  const sameTypeSessions = await ExamSession.find({ type: session.type, _id: { $ne: session._id }, ...WITH_DELETED }).select('_id');
  for (const studentId of toAdd) {
    const previous = await ExamCandidate.countDocuments({ studentId, sessionId: { $in: sameTypeSessions.map((s) => s._id) } });
    await ExamCandidate.create({ sessionId: session._id, studentId, result: 'pending', score: null, attempt: previous + 1 });
  }
  if (toAdd.length) {
    await recordAudit({ actorId: actor.id, action: 'exam.candidates', entity: 'exam', entityId: id, after: { added: toAdd } });
  }
  return { added: toAdd.length, skipped };
}

export async function listCandidates(scope: Scope, id: string) {
  const session = await getExamDoc(scope, id);
  const candidates = await ExamCandidate.find({ sessionId: session._id }).sort({ _id: 1 });
  const students = await Student.find({ _id: { $in: candidates.map((candidate) => candidate.studentId) }, ...WITH_DELETED });
  const byId = new Map(students.map((student) => [student.id, student]));
  return candidates.map((candidate) => {
    const student = byId.get(candidate.studentId.toString());
    return {
      ...(candidate.toJSON() as Record<string, unknown>),
      student: student ? { id: student.id, code: student.code, name: student.name, phone: student.phone } : null,
    };
  });
}

async function getCandidate(sessionId: Types.ObjectId, candidateId: string) {
  const candidate = await ExamCandidate.findOne({ _id: candidateId, sessionId });
  if (!candidate) throw ApiError.notFound('Không tìm thấy thí sinh trong ca thi');
  return candidate;
}

export async function setCandidateResult(actor: Actor, scope: Scope, id: string, candidateId: string, input: CandidateResultInput) {
  const session = await getExamDoc(scope, id);
  if (session.status === 'cancelled') throw ApiError.conflict('Ca thi đã hủy, không nhập kết quả');
  const candidate = await getCandidate(session._id, candidateId);
  const before = snapshot(candidate);
  candidate.set({ result: input.result, ...(input.score !== undefined ? { score: input.score } : {}), ...(input.note ? { note: input.note } : {}) });
  await candidate.save();
  if (session.type === 'official' && input.result === 'passed') {
    await Student.updateOne({ _id: candidate.studentId }, { status: 'completed' });
  }
  await recordAudit({ actorId: actor.id, action: 'exam.result', entity: 'exam_candidate', entityId: candidate.id, before, after: snapshot(candidate) });
  return candidate;
}

export async function removeCandidate(actor: Actor, scope: Scope, id: string, candidateId: string): Promise<void> {
  const session = await getExamDoc(scope, id);
  const candidate = await getCandidate(session._id, candidateId);
  if (candidate.result !== 'pending') throw ApiError.conflict('Thí sinh đã có kết quả, không thể xóa khỏi ca thi');
  await candidate.deleteOne();
  await recordAudit({ actorId: actor.id, action: 'exam.candidate_delete', entity: 'exam', entityId: id, before: snapshot(candidate) });
}
```

`src/modules/exams/exams.public.ts`:
```ts
import type { Request, Response } from 'express';
import type { FilterQuery } from 'mongoose';
import { validated } from '../../middlewares/validate.middleware';
import { startOfVnDay } from '../../shared/time';
import { sendData } from '../../utils/response';
import { Branch } from '../branches/branch.model';
import { Course } from '../courses/course.model';
import { ExamSession, type IExamSession } from './exam-session.model';
import type { PublicExamsQuery } from './exams.validation';

export async function listUpcomingExams(query: PublicExamsQuery) {
  const branches = await Branch.find({ status: 'active', ...(query.branch ? { slug: query.branch } : {}) });
  const filter: FilterQuery<IExamSession> = {
    status: 'scheduled',
    date: { $gte: startOfVnDay() },
    branchId: { $in: branches.map((branch) => branch._id) },
  };
  if (query.course) filter.courseCode = query.course;
  const sessions = await ExamSession.find(filter).sort({ date: 1, _id: 1 }).limit(50);
  const courses = await Course.find({ _id: { $in: sessions.map((session) => session.courseId) } });
  const branchById = new Map(branches.map((branch) => [branch.id, branch]));
  const courseById = new Map(courses.map((course) => [course.id, course]));
  return sessions.flatMap((session) => {
    const branch = branchById.get(session.branchId.toString());
    const course = courseById.get(session.courseId.toString());
    if (!branch || !course) return [];
    return [
      {
        type: session.type,
        course: { code: course.code, name: course.name },
        branch: { name: branch.name, slug: branch.slug },
        date: session.date,
        location: session.location ?? null,
      },
    ];
  });
}

export async function upcoming(req: Request, res: Response): Promise<void> {
  sendData(res, await listUpcomingExams(validated<PublicExamsQuery>(req, 'query')));
}
```

`src/modules/exams/exams.controller.ts`:
```ts
import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendData, sendList } from '../../utils/response';
import * as service from './exams.service';
import type { CandidateResultInput, CreateExamInput, ListExamsQuery, UpdateExamInput } from './exams.validation';

const idOf = (req: Request) => validated<{ id: string }>(req, 'params').id;
const candidateParams = (req: Request) => validated<{ id: string; candidateId: string }>(req, 'params');

export async function list(req: Request, res: Response): Promise<void> {
  sendList(res, await service.listExams(req.scope, validated<ListExamsQuery>(req, 'query')));
}

export async function get(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getExam(req.scope, idOf(req)));
}

export async function create(req: Request, res: Response): Promise<void> {
  sendData(res, await service.createExam(req.user!, req.scope, validated<CreateExamInput>(req, 'body')), 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  sendData(res, await service.updateExam(req.user!, req.scope, idOf(req), validated<UpdateExamInput>(req, 'body')));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.removeExam(req.user!, req.scope, idOf(req));
  res.status(204).end();
}

export async function addCandidates(req: Request, res: Response): Promise<void> {
  const { studentIds } = validated<{ studentIds: string[] }>(req, 'body');
  sendData(res, await service.addCandidates(req.user!, req.scope, idOf(req), studentIds), 201);
}

export async function listCandidates(req: Request, res: Response): Promise<void> {
  sendData(res, await service.listCandidates(req.scope, idOf(req)));
}

export async function setResult(req: Request, res: Response): Promise<void> {
  const { id, candidateId } = candidateParams(req);
  sendData(res, await service.setCandidateResult(req.user!, req.scope, id, candidateId, validated<CandidateResultInput>(req, 'body')));
}

export async function removeCandidate(req: Request, res: Response): Promise<void> {
  const { id, candidateId } = candidateParams(req);
  await service.removeCandidate(req.user!, req.scope, id, candidateId);
  res.status(204).end();
}
```

Lưu ý: test "trùng không thêm lại" mong `201` cho lần thêm lặp (`added: 0`) — giữ 201 cho mọi lần thêm thành công.

`src/modules/exams/exams.routes.ts`:
```ts
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../shared/zod';
import * as controller from './exams.controller';
import {
  addCandidatesSchema,
  candidateParamsSchema,
  candidateResultSchema,
  createExamSchema,
  listExamsQuerySchema,
  updateExamSchema,
} from './exams.validation';

export function createExamsRouter(): Router {
  const router = Router();
  const can = (permission: string) => authorize(permission, { branchScoped: true });
  router.use(authenticate);
  router.get('/', can('exam.read'), validate({ query: listExamsQuerySchema }), controller.list);
  router.post('/', can('exam.create'), validate({ body: createExamSchema }), controller.create);
  router.get('/:id', can('exam.read'), validate({ params: idParamsSchema }), controller.get);
  router.patch('/:id', can('exam.update'), validate({ params: idParamsSchema, body: updateExamSchema }), controller.update);
  router.delete('/:id', can('exam.delete'), validate({ params: idParamsSchema }), controller.remove);
  router.get('/:id/candidates', can('exam.read'), validate({ params: idParamsSchema }), controller.listCandidates);
  router.post('/:id/candidates', can('exam.update'), validate({ params: idParamsSchema, body: addCandidatesSchema }), controller.addCandidates);
  router.patch('/:id/candidates/:candidateId', can('exam.update'), validate({ params: candidateParamsSchema, body: candidateResultSchema }), controller.setResult);
  router.delete('/:id/candidates/:candidateId', can('exam.update'), validate({ params: candidateParamsSchema }), controller.removeCandidate);
  return router;
}
```

Trong `src/routes/index.ts`: `router.use('/exams', createExamsRouter());`. Trong `public.routes.ts`: `router.get('/exams/upcoming', validate({ query: publicExamsQuerySchema }), publicExams.upcoming);`.

- [ ] **Step 4: Chạy test**

Run: `npx vitest run tests/integration/exams.test.ts`
Expected: PASS

- [ ] **Step 5: Kiểm tra toàn bộ**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: tất cả pass.

---

### Task 7: Thống kê giáo viên + Swagger + README

**Files:**
- Modify: `src/modules/instructors/instructors.service.ts`, `instructors.controller.ts`, `instructors.routes.ts`, `src/docs/openapi.ts`, `tests/integration/docs.test.ts`, `README.md`
- Test: `tests/integration/instructor-stats.test.ts`

**Interfaces:**
- Produces: `getInstructorStats(scope, id)` → `{ classes: { total, active }, students, official: { passed, failed, absent, passRate: number | null } }` (passRate = passed/(passed+failed), làm tròn 1 chữ số thập phân theo %, vd `66.7`); route `GET /instructors/:id/stats`.

- [ ] **Step 1: Viết test (failing)** — `tests/integration/instructor-stats.test.ts`

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { ExamCandidate } from '../../src/modules/exams/exam-candidate.model';
import { ExamSession } from '../../src/modules/exams/exam-session.model';
import { authHeader, createBranch, createClass, createCourse, createInstructor, createStudent, createUser } from '../helpers/factories';

describe('GET /instructors/:id/stats', () => {
  it('đếm lớp, học viên, kết quả sát hạch của học viên các lớp giáo viên phụ trách', async () => {
    const a = await createBranch();
    const course = await createCourse({ code: 'B' });
    const { user: manager } = await createUser({ role: 'branch_manager', branchIds: [a.id] });
    const teacher = await createInstructor({ branchId: a.id });
    const ongoing = await createClass({ branchId: a.id, courseId: course.id, instructorId: teacher.id, status: 'ongoing' });
    await createClass({ branchId: a.id, courseId: course.id, instructorId: teacher.id, status: 'finished' });
    await createClass({ branchId: a.id, courseId: course.id });
    const [s1, s2, s3] = await Promise.all([1, 2, 3].map(() => createStudent({ branchId: a.id, courseId: course.id, classId: ongoing.id })));
    await createStudent({ branchId: a.id, courseId: course.id, classId: ongoing.id, status: 'dropped' });
    const official = await ExamSession.create({ code: 'SH-1', type: 'official', courseId: course._id, courseCode: 'B', branchId: a._id, date: new Date() });
    const graduation = await ExamSession.create({ code: 'TN-1', type: 'graduation', courseId: course._id, courseCode: 'B', branchId: a._id, date: new Date() });
    await ExamCandidate.create([
      { sessionId: official._id, studentId: s1!._id, result: 'passed', attempt: 1 },
      { sessionId: official._id, studentId: s2!._id, result: 'passed', attempt: 1 },
      { sessionId: official._id, studentId: s3!._id, result: 'failed', attempt: 1 },
      { sessionId: graduation._id, studentId: s3!._id, result: 'absent', attempt: 1 },
    ]);
    const res = await request(createApp()).get(`/api/v1/instructors/${teacher.id}/stats`).set(authHeader(manager));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      classes: { total: 2, active: 1 },
      students: 3,
      official: { passed: 2, failed: 1, absent: 0, passRate: 66.7 },
    });
  });

  it('chưa có kết quả → passRate null; giáo viên chi nhánh khác → 404', async () => {
    const [a, b] = await Promise.all([createBranch(), createBranch()]);
    const { user: manager } = await createUser({ role: 'branch_manager', branchIds: [a.id] });
    const mine = await createInstructor({ branchId: a.id });
    const other = await createInstructor({ branchId: b.id });
    const app = createApp();
    expect((await request(app).get(`/api/v1/instructors/${mine.id}/stats`).set(authHeader(manager))).body.data.official.passRate).toBeNull();
    expect((await request(app).get(`/api/v1/instructors/${other.id}/stats`).set(authHeader(manager))).status).toBe(404);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/integration/instructor-stats.test.ts`
Expected: FAIL — 404 route.

- [ ] **Step 3: Viết code**

Thêm vào `src/modules/instructors/instructors.service.ts` (import `TrainingClass`, `ACTIVE_CLASS_STATUSES` từ `../classes/class.model`, `Student` từ `../students/student.model`, `ExamCandidate` từ `../exams/exam-candidate.model`, `ExamSession` từ `../exams/exam-session.model`):
```ts
export async function getInstructorStats(scope: Scope, id: string) {
  const instructor = await getInstructor(scope, id);
  const classes = await TrainingClass.find({ instructorId: instructor._id }).select('_id status');
  const classIds = classes.map((cls) => cls._id);
  const students = await Student.find({ classId: { $in: classIds }, status: { $ne: 'dropped' } }).select('_id');
  const officialSessions = await ExamSession.find({ type: 'official' }).select('_id');
  const rows = await ExamCandidate.aggregate<{ _id: string; count: number }>([
    { $match: { studentId: { $in: students.map((s) => s._id) }, sessionId: { $in: officialSessions.map((s) => s._id) } } },
    { $group: { _id: '$result', count: { $sum: 1 } } },
  ]);
  const count = (result: string) => rows.find((row) => row._id === result)?.count ?? 0;
  const passed = count('passed');
  const failed = count('failed');
  return {
    classes: { total: classes.length, active: classes.filter((cls) => ACTIVE_CLASS_STATUSES.includes(cls.status)).length },
    students: students.length,
    official: {
      passed,
      failed,
      absent: count('absent'),
      passRate: passed + failed === 0 ? null : Math.round((passed / (passed + failed)) * 1000) / 10,
    },
  };
}
```
Controller `stats` + route `router.get('/:id/stats', can('instructor.read'), validate({ params: idParamsSchema }), controller.stats);`.

- [ ] **Step 4: Swagger** — thêm vào `paths` trong `src/docs/openapi.ts` (trước các path `/public/...`), dùng helper `op`, `json`, `idParam`, `listParams` có sẵn:

```ts
    '/instructors': {
      get: op('Đào tạo', 'Danh sách giáo viên', { parameters: [...listParams, ...['status', 'branchId'].map((name) => ({ name, in: 'query', schema: { type: 'string' } }))] }),
      post: op('Đào tạo', 'Tạo giáo viên', { requestBody: json({ name: 'Nguyễn Hoàng Đức', phone: '0907226880', specialties: ['B', 'C1'], branchId: '<branchId>' }) }),
    },
    '/instructors/{id}': {
      get: op('Đào tạo', 'Chi tiết giáo viên', { parameters: [idParam] }),
      patch: op('Đào tạo', 'Sửa giáo viên', { parameters: [idParam], requestBody: json({ status: 'on_leave' }) }),
      delete: op('Đào tạo', 'Xóa (mềm) giáo viên', { parameters: [idParam] }),
    },
    '/instructors/{id}/stats': { get: op('Đào tạo', 'Thống kê lớp, học viên, tỷ lệ đậu', { parameters: [idParam] }) },
    '/vehicles': {
      get: op('Đào tạo', 'Danh sách xe tập lái', { parameters: [...listParams, ...['status', 'branchId', 'courseCode'].map((name) => ({ name, in: 'query', schema: { type: 'string' } }))] }),
      post: op('Đào tạo', 'Thêm xe', { requestBody: json({ plate: '64A-123.45', model: 'Toyota Vios', courseCode: 'B', transmission: 'automatic', branchId: '<branchId>' }) }),
    },
    '/vehicles/alerts': { get: op('Đào tạo', 'Xe sắp đến hạn bảo dưỡng/đăng kiểm', { parameters: [{ name: 'days', in: 'query', schema: { type: 'string' } }] }) },
    '/vehicles/{id}': {
      get: op('Đào tạo', 'Chi tiết xe', { parameters: [idParam] }),
      patch: op('Đào tạo', 'Sửa xe', { parameters: [idParam], requestBody: json({ status: 'maintenance' }) }),
      delete: op('Đào tạo', 'Xóa (mềm) xe', { parameters: [idParam] }),
    },
    '/classes': {
      get: op('Đào tạo', 'Danh sách lớp (kèm sĩ số)', { parameters: [...listParams, ...['status', 'branchId', 'courseId', 'instructorId'].map((name) => ({ name, in: 'query', schema: { type: 'string' } }))] }),
      post: op('Đào tạo', 'Mở lớp', { requestBody: json({ code: 'B-TD-2610', courseId: '<courseId>', branchId: '<branchId>', startDate: '2026-10-21', endDate: '2026-11-18', scheduleText: 'T2–T7 · 13:30', capacity: 50 }) }),
    },
    '/classes/{id}': {
      get: op('Đào tạo', 'Chi tiết lớp', { parameters: [idParam] }),
      patch: op('Đào tạo', 'Sửa lớp', { parameters: [idParam], requestBody: json({ status: 'ongoing' }) }),
      delete: op('Đào tạo', 'Xóa (mềm) lớp (409 nếu còn học viên)', { parameters: [idParam] }),
    },
    '/classes/{id}/students': { get: op('Đào tạo', 'Học viên của lớp', { parameters: [idParam] }) },
    '/students': {
      get: op('Đào tạo', 'Danh sách học viên', { parameters: [...listParams, ...['status', 'branchId', 'classId', 'courseId'].map((name) => ({ name, in: 'query', schema: { type: 'string' } }))] }),
      post: op('Đào tạo', 'Tạo học viên', { requestBody: json({ name: 'Nguyễn Minh Anh', phone: '0903412869', courseId: '<courseId>', branchId: '<branchId>' }) }),
    },
    '/students/{id}': {
      get: op('Đào tạo', 'Chi tiết học viên', { parameters: [idParam] }),
      patch: op('Đào tạo', 'Sửa học viên', { parameters: [idParam], requestBody: json({ status: 'paused' }) }),
      delete: op('Đào tạo', 'Xóa (mềm) học viên', { parameters: [idParam] }),
    },
    '/students/{id}/class': { patch: op('Đào tạo', 'Xếp / bỏ lớp', { parameters: [idParam], requestBody: json({ classId: '<classId>' }) }) },
    '/leads/{id}/convert': {
      post: op('CRM', 'Chuyển khách thành học viên', { parameters: [idParam], requestBody: json({ courseId: '<courseId>', classId: '<classId>', idNumber: '086204001234' }) }),
    },
    '/exams': {
      get: op('Đào tạo', 'Danh sách ca thi (kèm thống kê)', { parameters: [...listParams, ...['type', 'status', 'branchId', 'courseId', 'from', 'to'].map((name) => ({ name, in: 'query', schema: { type: 'string' } }))] }),
      post: op('Đào tạo', 'Tạo ca thi', { requestBody: json({ code: 'SH-2610-01', type: 'official', courseId: '<courseId>', branchId: '<branchId>', date: '2026-10-28' }) }),
    },
    '/exams/{id}': {
      get: op('Đào tạo', 'Chi tiết ca thi', { parameters: [idParam] }),
      patch: op('Đào tạo', 'Sửa ca thi', { parameters: [idParam], requestBody: json({ status: 'done' }) }),
      delete: op('Đào tạo', 'Xóa ca thi (409 nếu đã có kết quả)', { parameters: [idParam] }),
    },
    '/exams/{id}/candidates': {
      get: op('Đào tạo', 'Danh sách thí sinh', { parameters: [idParam] }),
      post: op('Đào tạo', 'Thêm thí sinh', { parameters: [idParam], requestBody: json({ studentIds: ['<studentId>'] }) }),
    },
    '/exams/{id}/candidates/{candidateId}': {
      patch: op('Đào tạo', 'Nhập kết quả', {
        parameters: [idParam, { name: 'candidateId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: json({ result: 'passed', score: 24 }),
      }),
      delete: op('Đào tạo', 'Bỏ thí sinh (chưa có kết quả)', { parameters: [idParam, { name: 'candidateId', in: 'path', required: true, schema: { type: 'string' } }] }),
    },
    '/public/classes/upcoming': {
      get: op('Công khai', 'Lịch khai giảng', { parameters: ['branch', 'course'].map((name) => ({ name, in: 'query', schema: { type: 'string' } })) }, false),
    },
    '/public/exams/upcoming': {
      get: op('Công khai', 'Lịch thi sắp tới', { parameters: ['branch', 'course'].map((name) => ({ name, in: 'query', schema: { type: 'string' } })) }, false),
    },
```

Trong `tests/integration/docs.test.ts`, thêm vào `arrayContaining`: `'/instructors'`, `'/vehicles/alerts'`, `'/classes'`, `'/students'`, `'/students/{id}/class'`, `'/leads/{id}/convert'`, `'/exams/{id}/candidates'`, `'/public/classes/upcoming'`, `'/public/exams/upcoming'`; đổi tên test thành `'/api/docs.json liệt kê endpoint đợt 1–4'`.

- [ ] **Step 5: README** — thêm sau mục "Khách hàng (CRM) và lịch hẹn":

```markdown
## Đào tạo

- **Giáo viên** (`/instructors`): có thể gắn với tài khoản vai trò `instructor` cùng chi nhánh (`userId`). Tài khoản giáo viên chỉ thấy lớp mình phụ trách và học viên các lớp đó (không thấy CCCD, địa chỉ, ngày sinh).
- **Lớp học** (`/classes`): trạng thái `enrolling → upcoming → ongoing → finished` do người dùng đặt; sĩ số tính từ học viên, vượt `capacity` bị từ chối. Website lấy lịch khai giảng ở `GET /public/classes/upcoming?branch=&course=`.
- **Học viên** (`/students`): mã `HV-yyMMdd-NN`; xếp lớp qua `PATCH /students/:id/class` (cùng chi nhánh, cùng gói, lớp chưa kết thúc).
- **Chuyển khách thành học viên:** `POST /leads/:id/convert` khi khách ở trạng thái Đặt cọc hoặc Hoàn tất hồ sơ. Sổ học phí sẽ có ở đợt tài chính.
- **Lịch thi** (`/exams`): ca thi tốt nghiệp/sát hạch, thêm thí sinh (học viên đang học, cùng chi nhánh và gói), nhập kết quả; đậu sát hạch → học viên "hoàn thành". Website lấy lịch thi ở `GET /public/exams/upcoming`.
- **Xe tập lái** (`/vehicles`): `GET /vehicles/alerts?days=30` liệt kê xe sắp đến hạn hoặc quá hạn bảo dưỡng/đăng kiểm.
```

- [ ] **Step 6: Kiểm tra toàn bộ + build**

Run: `npm run typecheck && npm run lint && npx vitest run && npm run build`
Expected: tất cả pass, có `dist/server.js`.
