# Front-end đợt C1 — Admin CRM: khách hàng và lịch hẹn

Ngày: 2026-10-04 · Nhánh: `feat/fe-api-integration` · Code: `front-end/` (+ sửa nhỏ `back-end/`)

Đợt trước: A (`2026-10-04-fe-dot-a-nen-tang-dang-nhap-design.md`, đăng nhập/`apiFetch`/TanStack Query/quyền), B (`2026-10-04-fe-dot-b-website-cong-khai-design.md`). Đợt sau: C2 đào tạo (học viên, lớp, lịch thi, giáo viên, xe) — dùng lại phần dùng chung của C1.

## 1. Mục tiêu

Nhân viên quản lý khách hàng (lead) và lịch hẹn trên dữ liệu thật:

- Danh sách khách có tìm kiếm, lọc, phân trang phía server; thêm/sửa/xoá; xuất CSV.
- Chi tiết khách: đổi trạng thái theo đúng luật, phân công, lịch sử chăm sóc + ghi hoạt động, lịch hẹn của khách, chuyển thành học viên.
- Lịch hẹn theo tháng: xem, tạo, sửa, đổi trạng thái, xoá.
- Nút/hành động ẩn theo quyền của vai trò.

Ngoài phạm vi: trang học viên, lớp, lịch thi, giáo viên, xe (C2); dashboard, học phí, bài viết, người dùng, chi nhánh, cài đặt (D). Sau khi chuyển khách thành học viên chỉ báo mã học viên (trang học viên làm ở C2).

## 2. Backend: `GET /users/options`

- Quyền: có **`lead.read` hoặc `appointment.read`** (helper mới `authorizeAny(permissions, { branchScoped: true })` trong `authorize.middleware.ts`). Khai báo trước `router.use(authenticate, authorize('user.manage'))` của users router để không bị chặn.
- Query: `branchId?` (ObjectId; ngoài phạm vi → 403 `branchForbidden`).
- Trả `{ data: { id, name, role, branchIds }[] }`: người dùng `status: 'active'`, `role ∈ {consultant, branch_manager}`, không bị xoá mềm, thuộc ít nhất một chi nhánh trong phạm vi người gọi (super_admin: mọi chi nhánh; có `branchId` → chỉ chi nhánh đó). Sắp theo `name`. Không trả `phone`, `username`.
- Test tích hợp: tư vấn viên gọi được và chỉ thấy người cùng chi nhánh; super_admin thấy mọi chi nhánh; `branchId` ngoài phạm vi → 403; biên tập viên (không có quyền) → 403; không lộ `phone`.
- Cập nhật OpenAPI + `npm run postman`.

## 3. Phần dùng chung (C1 tạo, C2 dùng lại)

- `lib/admin/types.ts`: kiểu `Page<T> = { data: T[]; meta: { page; limit; total } }`, `Lead`, `LeadActivity`, `Appointment`, `CalendarItem`, `StaffOption`, `BranchOption`, `CourseOption` theo đúng shape backend.
- `lib/admin/labels.ts`: nhãn tiếng Việt + tone cho `StatusPill`:
  - Trạng thái khách: new Mới · contacted Đã liên hệ · consulted Đã tư vấn · deposited Đặt cọc · docs_completed Hoàn tất hồ sơ · enrolled Nhập học · lost Không thành công.
  - Nguồn: website Website · facebook Facebook · tiktok TikTok · zalo Zalo · referral Giới thiệu · walk_in Tại văn phòng · other Khác.
  - Hoạt động: created Tạo mới · updated Cập nhật · status_change Đổi trạng thái · assign Phân công · form_resubmit Gửi lại form · appointment Lịch hẹn · call Cuộc gọi · note Ghi chú · sms SMS · meeting Gặp mặt.
  - Lịch hẹn: trạng thái scheduled Đã lên lịch · done Hoàn thành · cancelled Đã hủy · no_show Khách không đến; loại consult Tư vấn · docs Làm hồ sơ · other Khác.
- `lib/admin/lead-status.ts`: `canTransition(from, to)` giống hệt backend (`back-end/src/modules/leads/lead.status.ts`), `nextStatuses(from)` theo thứ tự pipeline rồi `lost`.
- `lib/admin/datetime.ts`: `toVnIso(localValue "yyyy-MM-ddTHH:mm") → "yyyy-MM-ddTHH:mm:00+07:00"`, `toLocalInput(iso) → "yyyy-MM-ddTHH:mm"` (cắt chuỗi, không phụ thuộc múi giờ máy), `formatDateTime(iso) → "dd/MM/yyyy HH:mm"`, `todayVn() → "yyyy-MM-dd"` theo giờ VN, `monthOf(date) → "yyyy-MM"`, `shiftMonth("yyyy-MM", ±1)`.
- `lib/admin/use-list-params.ts`: hook đọc/ghi bộ lọc + `page` trên URL (`useSearchParams` + `router.replace`, không thêm lịch sử); đổi bộ lọc → về trang 1; giá trị rỗng bị bỏ khỏi URL. Trang dùng hook này bọc trong `Suspense`.
- `lib/admin/lookups.ts`: hook TanStack Query cache 10 phút: `useBranches()` (`/branches?limit=100`), `useCourses()` (`/courses?limit=100`), `useStaffOptions(branchId?)` (`/users/options`), kèm helper tra tên theo id. `useDefaultBranch()`: super_admin → chưa chọn (bắt chọn); nhân viên → `user.branchIds[0]`; ô chọn chi nhánh chỉ hiện khi super_admin hoặc nhân viên có >1 chi nhánh.
- `lib/admin/use-can.ts`: `useCan(permission)` từ `useAuth().permissions` + `hasPermission`.
- Component (`components/admin/`):
  - `DataTable` (bảng HTML theo style bảng admin hiện có; cột khai báo; trạng thái loading skeleton / trống / lỗi có nút "Thử lại"; hàng có thể bấm).
  - `Pagination` (Trước/Sau + "Trang x/y · N bản ghi").
  - `FilterBar` (ô tìm kiếm có debounce 300 ms + các `Select` lọc; thay `TableToolbar` trang trí).
  - `EntitySheet` (Sheet bên phải có tiêu đề, nội dung cuộn, chân với nút Huỷ/Lưu; khoá khi đang gửi).
  - `ConfirmDialog` (alert-dialog).
  - `FormField` helper hiện lỗi dưới ô (từ `fieldErrors`).
  - `StatusPill` thêm màu cho các nhãn mới.
- Lỗi mutation: lỗi trường (400 `details`) hiện dưới ô; còn lại toast `errorMessage` (cơ chế đợt A). Thành công: toast + invalidate query liên quan.

## 4. Menu và quyền

- Thêm mục **Khách hàng** `/admin/khach-hang` (`lead.read`) ngay sau Tổng quan; route chi tiết `/admin/khach-hang/[id]` cùng quyền (khớp tiền tố).
- Mục "Lịch đăng ký" đổi nhãn thành **Lịch hẹn**, giữ URL `/admin/lich-dang-ky`, quyền đổi `lead.read` → `appointment.read`.
- Hành động ẩn theo quyền: thêm/sửa khách `lead.create`/`lead.update`; xoá `lead.delete`; xuất CSV `lead.export`; chuyển học viên `student.create`; lịch hẹn `appointment.create`/`update`/`delete`.

## 5. Trang Khách hàng `/admin/khach-hang`

- `GET /leads` với `q, status, branchId, assigneeId (id | "none"), source, followUpDue=true, page, limit=20, sort=-createdAt`.
- Bộ lọc: tìm (tên/SĐT/mã); Trạng thái (Tất cả + 7); Chi nhánh (khi được xem >1); Phụ trách (Tất cả · Của tôi = id người dùng · Chưa phân công = `none` · từng người từ `/users/options`); Nguồn; công tắc "Cần gọi lại".
- Cột: Mã · Khách (tên + SĐT) · Gói (`courseCode` hoặc "—") · Chi nhánh (tên tra từ lookup) · Nguồn · Trạng thái (pill) · Phụ trách (tên hoặc "Chưa phân công") · Hẹn gọi lại (`dd/MM HH:mm`, quá hạn → chữ đỏ) · Ngày tạo. Bấm hàng → trang chi tiết.
- "+ Thêm khách" → `EntitySheet` form: Tên*, SĐT*, Chi nhánh* (theo `useDefaultBranch`), Gói (khoá học), Email, Giờ liên hệ, Nguồn (mặc định Tại văn phòng), Phụ trách (người cùng chi nhánh đã chọn), Hẹn gọi lại (`datetime-local`), Ghi chú → `POST /leads`. Thành công → toast "Đã thêm khách `code`" + mở trang chi tiết.
- "Xuất CSV": `fetch` có Bearer (helper `apiDownload(path, query, filename)` trong `lib/api/client.ts`, cùng cơ chế refresh khi 401) tới `/leads/export` với bộ lọc hiện tại (không phân trang) → tải file `khach-hang-yyyyMMdd.csv`.

## 6. Trang chi tiết khách `/admin/khach-hang/[id]`

- `GET /leads/:id`; 404 → màn "Không tìm thấy khách hàng" + link về danh sách.
- Đầu trang: tên, mã, pill trạng thái; nút:
  - **Đổi trạng thái** (menu `nextStatuses`; ẩn khi `enrolled`): chọn "Không thành công" → dialog bắt nhập lý do 3–300 ký tự; trạng thái khác → dialog xác nhận có ô ghi chú tuỳ chọn → `PATCH /leads/:id/status`.
  - **Phân công** (Select người cùng chi nhánh + "Bỏ phân công") → `PATCH /leads/:id/assign`.
  - **Sửa** (sheet như form thêm, điền sẵn) → `PATCH /leads/:id`.
  - **Chuyển thành học viên** (chỉ khi `deposited`/`docs_completed` và có `student.create`): sheet gồm Gói (mặc định gói của khách), Lớp (từ `/classes?branchId=&courseId=` loại `finished`, tuỳ chọn), Email, Ngày sinh (`date`), CCCD (12 số), Địa chỉ, Ngày nhập học (`date`, mặc định hôm nay), Ghi chú → `POST /leads/:id/convert` → toast "Đã tạo học viên `student.code`", tải lại khách.
  - **Xoá** (`lead.delete`, ConfirmDialog) → `DELETE /leads/:id` → về danh sách.
- Thẻ thông tin: SĐT (link `tel:`), email, chi nhánh, gói, nguồn + UTM (nếu có), giờ liên hệ, ghi chú, phụ trách, hẹn gọi lại, lý do không thành công (nếu `lost`), ngày tạo, hoạt động gần nhất.
- **Lịch sử chăm sóc**: `GET /leads/:id/activities?page=&limit=20` hiển thị dạng dòng thời gian (nhãn loại, `fromStatus → toStatus` khi đổi trạng thái, nội dung, người làm — tên tra từ staff options, thiếu thì "Nhân viên", thời gian); "Xem thêm" tải trang kế. Form ghi hoạt động: Loại (Cuộc gọi/Ghi chú/SMS/Gặp mặt), Nội dung*, Hẹn gọi lại (tuỳ chọn) → `POST /leads/:id/activities` → làm mới lịch sử + thông tin khách.
- **Lịch hẹn của khách**: `GET /appointments?leadId=:id&sort=-startAt` (danh sách gọn: thời gian, loại, trạng thái, phụ trách); nút "Đặt lịch hẹn" mở sheet tạo lịch hẹn điền sẵn khách.

## 7. Trang Lịch hẹn `/admin/lich-dang-ky`

- Lịch tháng từ `GET /appointments/calendar?month=yyyy-MM[&branchId][&assigneeId]`; tháng lưu trên URL (`month`), mặc định tháng hiện tại (giờ VN). Nút ‹ › và "Hôm nay"; lọc chi nhánh, phụ trách (Tất cả/Của tôi/từng người). Bỏ chế độ Ngày/Tuần và số liệu cứng.
- Ô ngày: tối đa 3 lịch (`HH:mm · title/tên khách`, màu theo trạng thái), thêm "+N"; ngày hôm nay nổi bật; bấm ngày → chọn ngày.
- Cột bên: danh sách lịch của ngày đang chọn (mặc định hôm nay), mỗi mục: giờ, loại, khách (link chi tiết khách), phụ trách, trạng thái.
- Bấm lịch hẹn → sheet chi tiết: thông tin; đổi trạng thái (Hoàn thành/Đã hủy/Khách không đến/Đã lên lịch, kèm ghi chú) → `PATCH /appointments/:id/status`; Sửa (giờ bắt đầu, thời lượng, loại, tiêu đề, phụ trách, ghi chú) → `PATCH /appointments/:id`; Xoá → `DELETE`.
- "Tạo lịch hẹn" → sheet: Khách (ô tìm theo tên/SĐT/mã gọi `/leads?q=&limit=8`, chọn từ danh sách kết quả; hoặc bỏ trống và chọn Chi nhánh), Ngày giờ*, Thời lượng (15–480, mặc định 30), Loại, Tiêu đề, Phụ trách, Ghi chú → `POST /appointments`. 409 (trùng lịch người phụ trách) → lỗi hiện trên form.
- Mọi thay đổi → invalidate lịch tháng, danh sách ngày, lịch hẹn của khách.

## 8. Kiểm thử

- Unit: nhãn, `canTransition`/`nextStatuses` (đối chiếu từng cặp với luật backend), `datetime` (VN offset, không lệch múi giờ), `use-list-params` (ghi URL, về trang 1, bỏ giá trị rỗng), lookups helper tra tên, `apiDownload` (Bearer, refresh 401, tên file).
- Component: danh sách khách (bộ lọc → query đúng, phân trang, trạng thái lỗi/thử lại, ẩn "Xuất CSV"/"Thêm" theo quyền), form thêm khách (body đúng, `nextFollowUpAt` +07:00, lỗi trường), chi tiết (đổi trạng thái lost bắt lý do; nút chuyển học viên chỉ hiện đúng trạng thái + quyền; ghi hoạt động), lịch tháng (đổi tháng gọi đúng `month`, chọn ngày, tạo lịch hẹn 409 hiện lỗi).
- Backend: `/users/options` (mục 2).
- Chạy thật (MongoDB trong RAM + seed, cổng riêng, không đụng server/DB của người dùng): gửi form tư vấn website → khách hiện ở `/admin/khach-hang`; đăng nhập tư vấn viên: phân công cho mình, ghi cuộc gọi, đặt lịch hẹn, đổi trạng thái tới Đặt cọc; đăng nhập quản lý: chuyển thành học viên; xuất CSV; tư vấn viên không thấy Xoá/Xuất CSV.
- Bắt buộc qua: front-end `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`; backend `npm test`, `npm run typecheck`, `npm run lint`.

## 9. Rủi ro

- Lookup chi nhánh/gói/nhân viên cache 10 phút: đổi tên chi nhánh/nhân viên hiện trễ — chấp nhận.
- Danh sách khách lọc "Của tôi" dựa trên id người dùng hiện tại; quản trị viên không thuộc chi nhánh nào vẫn thấy tất cả qua "Tất cả".
