# Front-end đợt C2 — Admin đào tạo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Học viên (mới), lớp học, lịch thi, giáo viên, xe tập lái đọc/ghi dữ liệu thật qua API, thay mock.

**Architecture:** Client component + TanStack Query trên phần dùng chung C1; mỗi khu vực một thư mục `components/admin/<khu-vực>/`; danh sách dùng `useListParams` + `DataTable` + `Pagination`; thêm/sửa trong `EntitySheet`; chi tiết học viên/lớp/ca thi là trang riêng. Backend thêm `role` cho `/users/options` và `GET /students/:id/exams`.

**Tech Stack:** Next.js 16.3, React 19, TS strict, Tailwind 4, shadcn `base-nova`, TanStack Query 5, Vitest 4 + Testing Library; backend Express 5 + Mongoose + zod 4.

**Spec:** `back-end/docs/superpowers/specs/2026-10-11-fe-dot-c2-dao-tao-design.md` — mỗi task triển khai đúng mục spec được nêu; nhãn, cột, bộ lọc, trường form, quyền lấy **nguyên văn** từ spec.

## Global Constraints

- Theo `front-end/AGENT.md` + `AGENTS.md` (component UI đã cài trước; Next 16 đọc `node_modules/next/dist/docs/`; params trang động là `Promise`).
- Dùng lại phần dùng chung C1 (`components/admin/{data-table,pagination,filter-bar,entity-sheet,confirm-dialog,form-field}.tsx`, `lib/admin/{use-list-params,lookups,use-can,datetime,labels,types}.ts`) — không viết lại; mở rộng khi cần, giữ tương thích test C1/M.
- Mẫu tham chiếu cho danh sách/form/chi tiết: `components/admin/leads/*` (C1). Mẫu test: `components/admin/leads/*.test.tsx`.
- Gọi API chỉ qua `apiFetch`/`apiData`; query key bắt đầu bằng tên tài nguyên (`["students", params]`, `["student", id]`, `["student-exams", id]`, `["classes", …]`, `["class", id]`, `["class-students", id]`, `["exams", …]`, `["exam", id]`, `["exam-candidates", id]`, `["instructors", …]`, `["instructor-stats", id]`, `["vehicles", …]`, `["vehicle-alerts"]`); mutation thành công invalidate đúng tiền tố liên quan.
- Ngày (`date`) gửi `yyyy-MM-dd`; ngày giờ gửi `toVnIso`. Hiển thị qua `formatDate`/`formatDateTime`.
- Mutation tự xử lý lỗi dùng `meta: { silent: true }` (một toast lỗi duy nhất).
- Không commit `.env*`/secret; không đọc `back-end/secret/`, `.env`, `.env.local`; không `git stash`; không dừng/đụng server cổng 3000/4000; thư mục tạm mới dưới `/private/tmp`, xoá khi xong. Commit tiếng Việt kết thúc `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Mỗi task kết thúc: front-end `npm test && npm run typecheck && npm run lint` (lint 0 lỗi/0 cảnh báo) + `npm run build` khi sửa `app/`/component; backend `npm test && npm run typecheck && npm run lint` khi sửa backend.

## Review Focus

1. Tài khoản giáo viên (`class.read`, `student.read`, `exam.read`) xem được lớp/học viên/ca thi của mình nhưng không thấy bất kỳ nút thêm/sửa/xoá/xếp lớp/nhập kết quả nào (test ở Task 4, 5, 6).
2. Xếp nhiều học viên vào lớp khi lớp đầy giữa chừng → các học viên còn lại báo lỗi riêng, những người đã xếp vẫn thành công; danh sách lớp/học viên làm mới (test Task 5).
3. Tỷ lệ đậu khi chưa có kết quả hoặc toàn vắng → "—", không chia cho 0 (test Task 2/6).
4. Thêm thí sinh khi có học viên bị bỏ qua (`skipped`) → hiện tên + lý do, không báo thành công giả (test Task 6).
5. Chuyển giáo viên sang Nghỉ việc khi còn lớp đang dạy → lỗi hiện dưới ô Trạng thái, sheet không đóng (test Task 7).

---

### Task 1: Backend — `/users/options?role=instructor` và `GET /students/:id/exams` (spec §2)

**Files:** Modify `back-end/src/modules/users/{users.options,users.routes}.ts`, `back-end/src/modules/students/{students.routes,students.controller,students.service}.ts` (hoặc file mới `students.exams.ts`), `back-end/src/docs/openapi.ts`; regenerate Postman; Tests `back-end/tests/integration/users-options.test.ts` (mở rộng), `back-end/tests/integration/student-exams.test.ts` (mới).

- [ ] **Step 1: Tests** — users-options: branch_manager gọi `?role=instructor` → chỉ user role instructor active trong chi nhánh mình; tư vấn viên (có lead.read, không có instructor.*) gọi `?role=instructor` → 403, gọi không role → như cũ; role không hợp lệ → 400. student-exams: học viên có 2 lần thi ở 2 ca (tạo qua model/factory hoặc API) → `GET /api/v1/students/:id/exams` trả 2 dòng đúng shape spec, sắp `date` giảm dần; học viên chi nhánh khác với manager chi nhánh A → 404; tư vấn viên (không exam.read) → 403; tài khoản giáo viên với học viên không thuộc lớp mình → 404 (dùng cùng hàm lấy học viên theo phạm vi của `GET /students/:id`).
- [ ] **Step 2–4:** FAIL → implement (tái dùng hàm tìm học viên theo scope có sẵn trong students.service; candidate model + session lookup) → PASS + full backend checks.
- [ ] **Step 5: Commit** `feat(be): chọn tài khoản giáo viên qua /users/options và xem các lần thi của học viên`.

### Task 2: Front-end — kiểu, nhãn, tra cứu, menu học viên (spec §3)

**Files:** Modify `front-end/lib/admin/{types,labels,lookups}.ts`, `front-end/components/admin/admin-ui.tsx` (`StatusPill`), `front-end/lib/auth/routes.ts`, `front-end/components/admin/admin-shell.tsx`, `front-end/lib/auth/auth.test.ts`; Create `front-end/lib/admin/training.ts` (helper thuần: `passRate(stats): number | null`, `formatPassRate(rate): string` → `"85,5%"`/`"—"`, `transmissionLabel`, `classTitle(cls)` = `"<course.code> · Số tự động"`); Test `front-end/lib/admin/training.test.ts`.

**Produces:** các kiểu và nhãn đúng tên ở spec §3; `useInstructorOptions(branchId?)`, `useClassOptions({ branchId?, courseId? })`; route `{ href: "/admin/hoc-vien", permission: "student.read" }` ngay sau `/admin/khach-hang`.

- [ ] **Step 1: Tests** — `passRate({ candidates: 10, passed: 6, failed: 2, absent: 1, pending: 1 })` = 6/(10−1−1)·100 = 75; mẫu 0 (toàn vắng/chờ) → `null`; `formatPassRate(75)` = `"75%"`, `formatPassRate(85.5)` = `"85,5%"`, `formatPassRate(null)` = `"—"`; nhãn mẫu đúng chữ (vd. `STUDENT_STATUS_LABELS.dropped === "Thôi học"`, `CANDIDATE_RESULT_LABELS.absent === "Vắng"`); `routeFor("/admin/hoc-vien/abc")?.permission === "student.read"`; `canAccess("/admin/hoc-vien", ["class.read","student.read","exam.read"])` true; editor không thấy Học viên.
- [ ] **Step 2–4:** FAIL → implement → PASS + build.
- [ ] **Step 5: Commit** `feat(fe): kiểu, nhãn và tra cứu cho màn đào tạo; menu Học viên`.

### Task 3: Danh sách học viên + thêm học viên + link từ khách hàng (spec §4 phần danh sách, thêm, link C1)

**Files:** Create `front-end/components/admin/students/{student-list,student-form-sheet}.tsx`, `front-end/app/admin/(panel)/hoc-vien/page.tsx`; Modify `front-end/components/admin/leads/lead-detail.tsx` (+ `lead-convert-sheet.tsx` toast); Tests `front-end/components/admin/students/student-list.test.tsx`, cập nhật `lead-detail.test.tsx`.

**Produces:** `StudentFormSheet({ open, onOpenChange, student?: Student, onSaved? })` (thêm khi không có `student`; sửa chỉ gửi trường đổi, trường xoá trống → `null`) — Task 4 dùng cho Sửa.

- [ ] **Step 1: Tests** — URL `?status=studying&page=2` → `GET /students` đúng query (`limit=20&sort=-createdAt`); cột theo spec (tên chi nhánh tra lookup, "Chưa xếp lớp"); tư vấn viên (`student.read/create/update`) thấy "Thêm học viên"; giáo viên không thấy; form thêm gửi `{ name, phone, courseId, branchId, dob: "2000-01-02", idNumber: "012345678901", enrolledAt: <hôm nay> }` (bỏ trường rỗng) → toast có mã + push `/admin/hoc-vien/<id>`; CCCD 11 số → lỗi tại ô không gọi API; lỗi 400 `body.phone` dưới ô. Lead detail: khách có `studentId` + người xem có `student.read` → link "Xem học viên" href `/admin/hoc-vien/<studentId>`; thiếu quyền → không có.
- [ ] **Step 2–4:** FAIL → implement → PASS + build.
- [ ] **Step 5: Commit** `feat(fe): danh sách và thêm học viên, link học viên từ khách hàng`.

### Task 4: Chi tiết học viên (spec §4 phần chi tiết)

**Files:** Create `front-end/components/admin/students/{student-detail,student-class-sheet,student-exams}.tsx`, `front-end/app/admin/(panel)/hoc-vien/[id]/page.tsx`; Test `front-end/components/admin/students/student-detail.test.tsx`.

**Produces:** `StudentDetail({ id })`; `StudentClassSheet({ open, onOpenChange, student })` (Task 5 không dùng; lớp dùng luồng riêng).

- [ ] **Step 1: Tests** — 404 → "Không tìm thấy học viên" + link danh sách; hiện CCCD/ngày sinh/địa chỉ khi có, ẩn khi API không trả (tài khoản giáo viên); link khách hàng gốc khi `leadId` + `lead.read`; Đổi trạng thái "Tạm dừng" → `PATCH /students/s1 { status: "paused" }`; Xếp lớp: sheet gọi `GET /classes?branchId=b1&courseId=c1&limit=100`, ẩn lớp `finished` và lớp `seatsLeft === 0` (hiện "Hết chỗ" và vô hiệu), chọn → `PATCH /students/s1/class { classId }`; "Bỏ lớp" → `{ classId: null }`; 400 từ backend hiện trong sheet; Các lần thi gọi `GET /students/s1/exams` khi có `exam.read`, không gọi khi thiếu; dòng có link `/admin/lich-thi/<sessionId>`, nhãn kết quả; Xoá (có `student.delete`) có câu cảnh báo về khách hàng gốc khi `leadId` → `DELETE` → push danh sách; giáo viên không thấy Sửa/Đổi trạng thái/Xếp lớp/Xoá.
- [ ] **Step 2–4:** FAIL → implement → PASS + build.
- [ ] **Step 5: Commit** `feat(fe): chi tiết học viên — hồ sơ, trạng thái, xếp lớp, các lần thi`.

### Task 5: Lớp học — danh sách, thêm/sửa, chi tiết (spec §5)

**Files:** Create `front-end/components/admin/classes/{class-list,class-form-sheet,class-detail,class-assign-sheet}.tsx`, `front-end/app/admin/(panel)/lop-hoc/[id]/page.tsx`; Rewrite `front-end/app/admin/(panel)/lop-hoc/page.tsx`; Remove `trainingClasses` khỏi `lib/admin-data.ts` nếu không còn dùng; Tests `front-end/components/admin/classes/classes.test.tsx`.

- [ ] **Step 1: Tests** — danh sách query đúng (`sort=-startDate`, lọc instructorId), thanh sĩ số `filled/capacity`, dòng "N lớp"; form mở lớp: mã "b-2610" gửi `"B-2610"`, ngày `yyyy-MM-dd`, sức chứa 0 → lỗi tại ô; chi tiết: bảng học viên từ `GET /classes/k1/students`; "Bỏ khỏi lớp" xác nhận → `PATCH /students/s1/class { classId: null }`; "Xếp học viên": tìm → `GET /students?branchId=b1&courseId=c1&status=studying&q=an&limit=20`, ẩn học viên đã có lớp; chọn 3 → 3 lời gọi `PATCH`, lời gọi thứ 3 trả 409 "Lớp đã đủ sĩ số" → toast/khối kết quả "Đã xếp 2 học viên" + dòng lỗi có tên học viên thứ 3; sau đó invalidate `["class-students"]`, `["class"]`, `["students"]`; Xoá lớp 409 → thông báo; giáo viên không thấy Mở lớp/Sửa/Xoá/Xếp/Bỏ.
- [ ] **Step 2–4:** FAIL → implement → PASS + build.
- [ ] **Step 5: Commit** `feat(fe): lớp học — danh sách, mở lớp, chi tiết và xếp học viên`.

### Task 6: Lịch thi — danh sách, thêm/sửa, chi tiết thí sinh (spec §6)

**Files:** Create `front-end/components/admin/exams/{exam-list,exam-form-sheet,exam-detail,candidate-row,candidate-add-sheet}.tsx`, `front-end/app/admin/(panel)/lich-thi/[id]/page.tsx`; Rewrite `front-end/app/admin/(panel)/lich-thi/page.tsx`; Remove `examSessions` khỏi `lib/admin-data.ts` nếu không còn dùng; Test `front-end/components/admin/exams/exams.test.tsx`.

- [ ] **Step 1: Tests** — danh sách query đúng (`sort=-date`, `from`/`to` từ ô ngày), cột Đậu/Trượt/Vắng và Tỷ lệ đậu dùng `passRate` ("—" khi mẫu 0); form xếp ca: ngày giờ `2026-11-02T07:30` → `date: "2026-11-02T07:30:00+07:00"`; chi tiết: đổi kết quả dòng s1 sang "Đậu", điểm 92 → bấm Lưu → `PATCH /exams/e1/candidates/c1 { result: "passed", score: 92 }` (note chỉ gửi khi có); điểm 1200 → lỗi tại ô; "Thêm thí sinh" chỉ hiện khi ca `scheduled` và có `exam.update`; thêm 2 học viên → `POST /exams/e1/candidates { studentIds: [s2, s3] }` trả `{ added: 1, skipped: [{ studentId: "s3", reason: "…" }] }` (đối chiếu shape thật của backend) → hiện "Đã thêm 1 thí sinh" + tên s3 kèm lý do; xoá thí sinh chờ → `DELETE`; nút xoá ẩn với thí sinh đã có kết quả; xoá ca 409 → thông báo; giáo viên chỉ xem.
- [ ] **Step 2–4:** FAIL → implement → PASS + build.
- [ ] **Step 5: Commit** `feat(fe): lịch thi — danh sách, xếp ca, thí sinh và nhập kết quả`.

### Task 7: Giáo viên (spec §7)

**Files:** Create `front-end/components/admin/instructors/{instructor-list,instructor-sheet}.tsx`; Rewrite `front-end/app/admin/(panel)/giao-vien/page.tsx`; Remove `instructors` mock nếu không còn dùng; Test `front-end/components/admin/instructors/instructors.test.tsx`.

- [ ] **Step 1: Tests** — danh sách query (`sort=name`), badge chuyên môn, tên tài khoản liên kết; sheet: `GET /instructors/i1/stats` hiện "Lớp 3/1", tỷ lệ đậu `passRate` null → "—"; chuyên môn nhập "b", "c1" → gửi `["B","C1"]`; ô Tài khoản gọi `GET /users/options?role=instructor&branchId=b1`, chọn "Không liên kết" → `userId: null`; chuyển "Nghỉ việc" → backend 409/400 có message còn lớp → lỗi dưới ô Trạng thái, sheet vẫn mở; thêm mới → `POST /instructors`; xoá (`instructor.delete`) → `DELETE`; tư vấn viên (không có `instructor.*`) — trang bị chặn bởi route (`instructor.read`) — kiểm `canAccess` false.
- [ ] **Step 2–4:** FAIL → implement → PASS + build.
- [ ] **Step 5: Commit** `feat(fe): giáo viên — danh sách, thống kê, liên kết tài khoản`.

### Task 8: Xe tập lái (spec §8)

**Files:** Create `front-end/components/admin/vehicles/{vehicle-list,vehicle-sheet,vehicle-alerts}.tsx`; Rewrite `front-end/app/admin/(panel)/xe-tap-lai/page.tsx`; Remove `vehicles` mock nếu không còn dùng; Test `front-end/components/admin/vehicles/vehicles.test.tsx`.

- [ ] **Step 1: Tests** — băng cảnh báo từ `GET /vehicles/alerts?days=30`: dòng quá hạn đỏ "quá hạn 3 ngày", dòng còn hạn "còn 10 ngày (dd/MM/yyyy)"; rỗng → không render băng; bấm dòng → mở sheet xe đó; danh sách query (`sort=plate`, `courseCode`), badge đăng kiểm theo alerts; form: biển số sai định dạng → lỗi tại ô (regex giống backend — đọc `vehicles.validation.ts`), ngày `yyyy-MM-dd`, số km số nguyên ≥ 0; `POST`/`PATCH`/`DELETE` đúng; giáo viên không truy cập (route `vehicle.read`).
- [ ] **Step 2–4:** FAIL → implement → PASS + build.
- [ ] **Step 5: Commit** `feat(fe): xe tập lái — danh sách, cảnh báo hạn, thêm/sửa`.

### Task 9: Tài liệu và chạy thật (spec §9)

**Files:** Modify `front-end/README.md` (mục quản trị: học viên, lớp, lịch thi, giáo viên, xe — 5–8 dòng), `back-end/README.md` (mục Đào tạo: `/students/:id/exams`, `/users/options?role=instructor`).

- [ ] **Step 1: Tài liệu.**
- [ ] **Step 2: Chạy thật** — thư mục tạm **mới**, `process.chdir` vào đó trước khi import backend; env tường minh (`NODE_ENV=development`, `STORAGE_DRIVER=local`, `ALLOW_LOCAL_STORAGE=true`, `UPLOAD_DIR`, MongoDB trong RAM, `JWT_ACCESS_SECRET` ≥ 32 ký tự, `CORS_ORIGINS=http://localhost:3100`, `PORT=4100`), seed admin `admin`/`0901234567`/`Matkhau123`; front-end `next build && next start -p 3100` với `API_ORIGIN=http://localhost:4100`. Script Node kiểm và ghi kết quả từng bước của spec §9 (luồng: giáo viên + tài khoản giáo viên liên kết → lớp → khách đặt cọc → chuyển học viên vào lớp → ca thi sát hạch → thêm thí sinh → nhập Đậu → học viên `completed` → `/students/:id/exams` có ca; xe hạn đăng kiểm +10 ngày ở `/vehicles/alerts`; đăng nhập tài khoản giáo viên: `/classes` chỉ lớp mình, `POST /classes` 403; `GET /admin/hoc-vien`, `/admin/lop-hoc`, `/admin/lich-thi`, `/admin/giao-vien`, `/admin/xe-tap-lai` 200). Dừng server tạm, xoá thư mục tạm.
- [ ] **Step 3: Kiểm tra cuối** — front-end `npm test && npm run typecheck && npm run lint && npm run build`; backend `npm test && npm run typecheck && npm run lint`.
- [ ] **Step 4: Commit** `docs: hướng dẫn màn đào tạo`.
