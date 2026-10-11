# Front-end đợt C2 — Admin đào tạo: học viên, lớp học, lịch thi, giáo viên, xe tập lái

Ngày: 2026-10-11 · Nhánh: `feat/fe-api-integration` · Code: `front-end/` (+ sửa nhỏ `back-end/`)

Dùng lại phần dùng chung của C1 (`DataTable`, `Pagination`, `FilterBar`/`FilterSelect`, `EntitySheet`, `ConfirmDialog`, `FormField`, `useListParams`, `useCan`, `lookups`, `datetime`, `labels`, `StatusPill`) và đợt M (`MediaPicker` không cần ở đợt này). Trang chi tiết khách hàng (C1) đã chuyển khách thành học viên.

## 1. Mục tiêu

Năm màn đào tạo đọc/ghi dữ liệu thật, thay mock `lib/admin-data.ts`:

- **Học viên** (mới) — danh sách, thêm, chi tiết (hồ sơ, trạng thái, xếp lớp, các lần thi, xoá).
- **Lớp học** — danh sách, thêm/sửa, chi tiết (học viên của lớp, xếp/bỏ học viên, xoá).
- **Lịch thi** — danh sách, thêm/sửa, chi tiết (thí sinh, thêm thí sinh, nhập kết quả, xoá thí sinh chờ).
- **Giáo viên** — danh sách, thêm/sửa (chuyên môn, liên kết tài khoản), thống kê, xoá.
- **Xe tập lái** — danh sách, thêm/sửa, băng cảnh báo hạn bảo dưỡng/đăng kiểm, xoá.

Ngoài phạm vi: học phí/thu tiền (đợt D), giờ dạy theo tháng của giáo viên (API không có), lịch học chi tiết theo buổi.

## 2. Backend (sửa nhỏ)

- `GET /users/options`: thêm query `role?: 'consultant' | 'branch_manager' | 'instructor'`. Không có `role` → như cũ (consultant + branch_manager). `role=instructor` cần quyền `instructor.create` hoặc `instructor.update` (ngoài `lead.read`/`appointment.read` của C1: dùng `authorizeAny([...4 quyền])`, rồi trong handler: `role=instructor` mà thiếu cả hai quyền instructor → 403). Trả cùng shape `{ id, name, role, branchIds }`.
- Mới `GET /students/:id/exams` (quyền `exam.read` + phạm vi chi nhánh của học viên, học viên ngoài phạm vi → 404 như `GET /students/:id`; tài khoản giáo viên chỉ xem học viên lớp mình như `GET /students/:id`) → `{ data: { candidateId, sessionId, sessionCode, type, date, location, courseCode, result, score, attempt, note }[] }` sắp `date` giảm dần.
- Test tích hợp cho cả hai; OpenAPI + `npm run postman`.

## 3. Phần dùng chung thêm

- `lib/admin/types.ts`: `Student`, `StudentStatus`, `TrainingClass` (presenter có `filled`, `seatsLeft`, `course`, `instructor`), `ClassStatus`, `ExamSession` (có `stats`), `ExamType`, `ExamStatus`, `ExamCandidate`, `CandidateResult`, `Instructor`, `InstructorStatus`, `InstructorStats`, `Vehicle`, `VehicleStatus`, `VehicleAlert`, `Transmission`, `StudentExam` — đối chiếu đúng presenter backend.
- `lib/admin/labels.ts` thêm: học viên studying Đang học · paused Tạm dừng · completed Hoàn thành · dropped Thôi học; lớp enrolling Đang nhận hồ sơ · upcoming Sắp khai giảng · ongoing Đang học · finished Đã kết thúc; loại thi graduation Tốt nghiệp · official Sát hạch; ca thi scheduled Đã lên lịch · done Đã có kết quả · cancelled Đã hủy; kết quả pending Chờ kết quả · passed Đậu · failed Trượt · absent Vắng; giáo viên active Đang hoạt động · on_leave Tạm nghỉ · inactive Nghỉ việc; xe active Đang chạy · maintenance Bảo dưỡng · paused Tạm dừng; số manual Số sàn · automatic Số tự động. `StatusPill` có tone cho các nhãn mới.
- `lib/admin/lookups.ts` thêm `useInstructorOptions(branchId?)` (`/instructors?status=active&limit=100`), `useClassOptions({ branchId, courseId })` (`/classes?branchId&courseId&limit=100`, lọc bỏ `finished`).
- Menu/route: thêm **Học viên** `/admin/hoc-vien` (`student.read`, icon `GraduationCap` hoặc `UserRoundCheck`) nhóm "Vận hành" sau Khách hàng; chi tiết `/admin/hoc-vien/[id]`, `/admin/lop-hoc/[id]`, `/admin/lich-thi/[id]` khớp tiền tố quyền của trang cha.
- Mọi trang: bộ lọc/trang trên URL, `limit=20`, ẩn nút theo quyền (`*.create`, `*.update`, `*.delete`), lỗi trường dưới ô, toast lỗi khác (một lần — `meta.silent` khi tự xử lý), chi nhánh khi tạo theo `useBranchChoice`.

## 4. Học viên `/admin/hoc-vien`

- Danh sách `GET /students` lọc `q, status, branchId, courseId, classId`, sắp `-createdAt`. Cột: Mã · Học viên (tên + SĐT) · Gói · Chi nhánh · Lớp (mã lớp tra từ `useClassOptions` theo chi nhánh hoặc "Chưa xếp lớp") · Trạng thái · Nhập học. Bấm hàng → chi tiết.
- "+ Thêm học viên" (`student.create`): Tên*, SĐT*, Gói*, Chi nhánh*, Email, Ngày sinh (`date`), CCCD (12 số), Địa chỉ, Lớp (tuỳ chọn, theo chi nhánh + gói, chưa kết thúc), Ngày nhập học (mặc định hôm nay), Ghi chú → `POST /students` → toast "Đã thêm học viên `code`" + mở chi tiết. Ghi chú dưới form: "Sổ học phí được tạo tự động."
- Chi tiết `/admin/hoc-vien/[id]`: đầu trang tên, mã, pill trạng thái; nút Sửa (sheet hồ sơ — `PATCH /students/:id`), Đổi trạng thái (menu 4 trạng thái — `PATCH { status }`), Xếp lớp/Đổi lớp (sheet chọn lớp hợp lệ hoặc "Bỏ lớp" — `PATCH /students/:id/class { classId | null }`; 409/400 hiện trong sheet), Xoá (`student.delete`, xác nhận; hiện câu "Khách hàng gốc sẽ trở về trạng thái Hoàn tất hồ sơ" khi có `leadId`). Thẻ hồ sơ (CCCD/ngày sinh/địa chỉ chỉ hiện khi API trả về), link "Khách hàng gốc" → `/admin/khach-hang/<leadId>` (khi có và người xem có `lead.read`), thẻ lớp hiện tại (link tới chi tiết lớp khi có `class.read`), thẻ **Các lần thi** (`GET /students/:id/exams`, chỉ khi có `exam.read`; mỗi dòng loại thi, ngày, mã ca → link chi tiết ca thi, kết quả, điểm, lần thi).
- Trang chi tiết khách hàng (C1): khi khách có `studentId` và người xem có `student.read` → link "Xem học viên"; toast sau chuyển đổi có nút "Mở học viên".

## 5. Lớp học `/admin/lop-hoc`

- Danh sách `GET /classes` lọc `q (mã), status, branchId, courseId, instructorId`, sắp `-startDate`. Bỏ bốn ô số liệu viết cứng cũ; thay bằng một dòng tóm tắt "N lớp" từ `meta.total` theo bộ lọc hiện tại. Cột: Mã lớp · Gói (+ số sàn/tự động) · Chi nhánh · Khai giảng–Kết thúc · Lịch học · Giáo viên · Sĩ số (thanh `filled/capacity`) · Trạng thái. Bấm hàng → chi tiết.
- "+ Mở lớp" (`class.create`): Mã* (A-Z0-9-, tự in hoa), Gói*, Chi nhánh*, Ngày khai giảng*, Ngày kết thúc*, Lịch học*, Sức chứa* (1–200), Số (Số sàn/Số tự động/không), Giáo viên (theo chi nhánh), Trạng thái (mặc định Đang nhận hồ sơ), Ghi chú → `POST /classes`.
- Chi tiết `/admin/lop-hoc/[id]`: thông tin lớp + Sửa (sheet như trên; sức chứa không nhỏ hơn sĩ số — lỗi backend hiện dưới ô) + Xoá (409 còn học viên → thông báo). Bảng học viên (`GET /classes/:id/students`): mã, tên, SĐT, trạng thái, nút "Bỏ khỏi lớp" (`PATCH /students/:sid/class { classId: null }`, xác nhận). "Xếp học viên" (`student.update`): sheet tìm học viên cùng chi nhánh + gói, trạng thái Đang học, chưa có lớp (`GET /students?branchId&courseId&status=studying&q&limit=20`, lọc `classId` rỗng ở client) → chọn nhiều → gọi `PATCH /students/:id/class` lần lượt, báo số thành công và lỗi từng học viên (vd. lớp đầy). Tài khoản giáo viên chỉ xem.

## 6. Lịch thi `/admin/lich-thi`

- Danh sách `GET /exams` lọc `q (mã), type, status, branchId, courseId, from, to`, sắp `-date`. Cột: Mã ca · Loại · Gói · Chi nhánh · Ngày thi · Địa điểm · Thí sinh (`stats.candidates`) · Đậu/Trượt/Vắng · Tỷ lệ đậu (`passed / (candidates − absent − pending)`, "—" khi mẫu = 0) · Trạng thái. Bỏ số liệu cứng cũ. Bấm hàng → chi tiết.
- "+ Xếp ca thi" (`exam.create`): Mã*, Loại*, Gói*, Chi nhánh*, Ngày thi* (`type="date"` → `yyyy-MM-dd`; backend `createExamSchema`/`updateExamSchema` dùng `zDateOnly`, ca thi chỉ lưu ngày, giờ ghi ở Ghi chú nếu cần), Địa điểm, Trạng thái, Ghi chú → `POST /exams`.
- Chi tiết `/admin/lich-thi/[id]`: thông tin ca + Sửa (mã, ngày giờ, địa điểm, trạng thái, ghi chú) + Xoá (409 đã có kết quả → thông báo). Bảng thí sinh (`GET /exams/:id/candidates`): mã + tên học viên (link chi tiết học viên), SĐT (nếu có), lần thi, kết quả (Select: Chờ kết quả/Đậu/Trượt/Vắng), điểm (ô số 0–1000), ghi chú, nút Lưu từng dòng → `PATCH /exams/:id/candidates/:cid { result, score, note }`; xoá thí sinh chờ (`DELETE`). "Thêm thí sinh" (`exam.update`, chỉ khi ca `scheduled`): sheet tìm học viên cùng chi nhánh + gói, Đang học (`GET /students?...status=studying`), bỏ người đã có trong ca → chọn nhiều → `POST /exams/:id/candidates { studentIds }` → toast "Đã thêm N thí sinh" + liệt kê `skipped` (lý do). Tài khoản giáo viên chỉ xem (không có `exam.update`).

## 7. Giáo viên `/admin/giao-vien`

- Danh sách `GET /instructors` lọc `q, status, branchId`, sắp `name`. Cột: Giáo viên (chữ viết tắt + tên + SĐT) · Chuyên môn (badge từng hạng) · Chi nhánh · Tài khoản (tên từ `useStaffOptions`/`users/options?role=instructor` hoặc "—") · Trạng thái. Bỏ cột giờ dạy và số liệu cứng cũ. Bấm hàng → sheet chi tiết.
- Sheet chi tiết: thống kê `GET /instructors/:id/stats` (Lớp: tổng/đang dạy · Học viên · Sát hạch: đậu/trượt/vắng · Tỷ lệ đậu `passRate`% hoặc "—"); form sửa (`instructor.update`) Tên*, SĐT*, Chi nhánh* (khi tạo), Chuyên môn (chip nhập hạng, tự in hoa, ≤ 10), Tài khoản liên kết (Select từ `/users/options?role=instructor&branchId=` + "Không liên kết"), Trạng thái, Ghi chú → `PATCH /instructors/:id` (lỗi "còn lớp đang dạy" khi chuyển Nghỉ việc → hiện dưới ô Trạng thái); Xoá (`instructor.delete`, xác nhận).
- "+ Thêm giáo viên" (`instructor.create`) → cùng form → `POST /instructors`.

## 8. Xe tập lái `/admin/xe-tap-lai`

- Băng cảnh báo đầu trang: `GET /vehicles/alerts?days=30` → nếu có, danh sách gọn "Biển số — Bảo dưỡng/Đăng kiểm: quá hạn N ngày | còn N ngày (dd/MM/yyyy)", quá hạn màu đỏ; bấm → mở sheet xe. Không có → ẩn.
- Danh sách `GET /vehicles` lọc `q (biển/dòng xe), status, branchId, courseCode`, sắp `plate`. Cột: Biển số · Dòng xe · Hạng (+ số) · Chi nhánh · Số km · Km DAT ("—" nếu 0/không có) · BD gần nhất · BD kế tiếp · Đăng kiểm (badge "Sắp đến hạn"/"Quá hạn" theo alerts) · Trạng thái. Bấm hàng → sheet sửa.
- Form (`vehicle.create`/`update`): Biển số* (định dạng `64A-123.45`, gợi ý dưới ô), Dòng xe*, Hạng* (Select mã gói từ `useCourses`), Chi nhánh*, Số, Số km, Km DAT, BD gần nhất (`date`), BD kế tiếp (`date`), Hạn đăng kiểm (`date`), Trạng thái, Ghi chú → `POST`/`PATCH /vehicles`; Xoá (`vehicle.delete`).

## 9. Kiểm thử

- Backend: `/users/options?role=instructor` (quyền instructor.create được, thiếu → 403; chỉ trả user role instructor trong phạm vi); `/students/:id/exams` (đúng shape/thứ tự, ngoài phạm vi → 404, thiếu exam.read → 403, giáo viên chỉ học viên lớp mình).
- Front-end (component test với `fetch` giả, theo cách C1): mỗi danh sách gửi đúng query khi lọc/phân trang và ẩn nút theo quyền; form thêm gửi đúng body (ngày `yyyy-MM-dd`, ngày giờ +07:00, mã lớp in hoa, chuyên môn in hoa); chi tiết học viên: xếp lớp/bỏ lớp, đổi trạng thái, các lần thi chỉ khi có `exam.read`; chi tiết lớp: xếp nhiều học viên báo lỗi từng người, xoá 409; chi tiết ca thi: lưu kết quả từng dòng, thêm thí sinh hiện `skipped`, nút thêm ẩn khi ca không `scheduled`; giáo viên: thống kê, liên kết tài khoản, lỗi còn lớp; xe: băng cảnh báo quá hạn/sắp đến hạn, form biển số; nhãn và tỷ lệ đậu (mẫu 0 → "—").
- Chạy thật (MongoDB trong RAM, thư mục tạm mới, `ALLOW_LOCAL_STORAGE=true`, cổng 4100/3100): tạo giáo viên + tài khoản giáo viên liên kết, lớp, khách → chuyển học viên vào lớp, ca thi sát hạch, thêm thí sinh, nhập Đậu → học viên Hoàn thành; `GET /students/:id/exams` có ca đó; xe có hạn đăng kiểm 10 ngày tới xuất hiện ở alerts; tài khoản giáo viên chỉ thấy lớp mình; các trang admin trả 200.
- Bắt buộc qua: front-end `npm test`, `typecheck`, `lint`, `build`; backend `npm test`, `typecheck`, `lint`.
