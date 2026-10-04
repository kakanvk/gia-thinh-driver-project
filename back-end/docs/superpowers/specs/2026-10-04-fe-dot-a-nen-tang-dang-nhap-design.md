# Front-end đợt A — Nền tảng gọi API và đăng nhập admin

Ngày: 2026-10-04 · Nhánh: `feat/fe-api-integration` · Thư mục code: `front-end/`

## 1. Mục tiêu

Nối front-end Next.js (`front-end/`) với backend Express (`back-end/`, `/api/v1`). Đây là đợt đầu trong bốn đợt:

| Đợt | Nội dung |
|---|---|
| **A (spec này)** | API client, cấu hình địa chỉ API, đăng nhập/giữ phiên/đăng xuất, chặn `/admin`, menu theo quyền, header người dùng thật, trang tài khoản, xử lý lỗi chung |
| B | Website công khai: chi nhánh, bảng giá, form tư vấn, tin tức, lịch khai giảng, lịch thi |
| C | Admin CRM và đào tạo |
| D | Admin tài chính, dashboard, bài viết, người dùng, chi nhánh, cài đặt |

Hết đợt A: nhân viên đăng nhập bằng SĐT/username, ở lại đăng nhập khi tải lại trang và khi access token (15 phút) hết hạn, chỉ thấy menu đúng vai trò, tự sửa hồ sơ và đổi mật khẩu, đăng xuất. Nội dung các trang admin **vẫn là dữ liệu mock** (đợt C, D thay).

Ngoài phạm vi: nối dữ liệu từng module admin, website công khai, diễn đàn `thao-luan` (backend không có module), bắt đổi mật khẩu tạm (backend không có cờ), ẩn nút sửa/xoá theo quyền bên trong trang (làm theo từng module ở C, D).

## 2. Bối cảnh

- Front-end: Next.js 16.3 App Router, React 19, TypeScript strict, Tailwind 4, shadcn (`base-nova`), mặc định Server Component (`front-end/AGENT.md`). Chưa có fetch/API client, chưa có test. Toàn bộ admin đọc mock trong `lib/admin-data.ts`. `/admin` không có đăng nhập; "Đăng xuất" chỉ `router.push("/")`.
- Backend: phản hồi `{ data }` / `{ data, meta }`, lỗi `{ error: { code, message, details? } }`. `POST /auth/login { identifier, password }` → `{ data: { accessToken, user } }` và set cookie `gt_refresh` (httpOnly, `SameSite=Lax`, `path=/api/v1/auth`, Secure ở production). `POST /auth/refresh` xoay vòng refresh token (token cũ bị huỷ). `GET /auth/me` → `{ data: { user, permissions } }`. `POST /auth/change-password` → 204 và **huỷ mọi refresh token của user, kể cả phiên hiện tại**. Đăng nhập giới hạn 5 lần/15 phút/IP, header `RateLimit` chuẩn draft-7.
- Vai trò và quyền: `back-end/src/config/roles.ts` (`super_admin: ['*']`, các vai trò khác dạng `lead.read`, `lead.*`).

## 3. Triển khai và cấu hình địa chỉ API

Dự kiến: front-end trên **Vercel** (tên miền `giathinh.vn`), backend trên **VPS** (`api.giathinh.vn`). Hỗ trợ hai chế độ bằng biến môi trường:

| Biến (front-end) | Ý nghĩa | Dev | Preview Vercel | Production |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | Địa chỉ gốc trình duyệt gọi | `/api/v1` (mặc định) | `/api/v1` | `https://api.giathinh.vn/api/v1` |
| `API_ORIGIN` | Đích rewrite `/api/v1/*`, `/uploads/*` | `http://localhost:4000` | `https://api.giathinh.vn` | `https://api.giathinh.vn` (bắt buộc từ đợt B: server lấy dữ liệu công khai) |

- **Chế độ proxy** (`NEXT_PUBLIC_API_URL` tương đối): `next.config.ts` khai báo `rewrites` từ `/api/v1/:path*` và `/uploads/:path*` sang `${API_ORIGIN}`. Trình duyệt chỉ thấy một origin nên cookie `gt_refresh` là cookie first-party, không cần CORS. Bắt buộc ở preview `*.vercel.app` vì `vercel.app` là public suffix: gọi thẳng `api.giathinh.vn` từ đó là cross-site và cookie `SameSite=Lax` không được gửi. Thiếu `API_ORIGIN` thì không khai báo rewrite (build vẫn chạy).
- **Chế độ gọi thẳng** (`NEXT_PUBLIC_API_URL` tuyệt đối): `giathinh.vn` và `api.giathinh.vn` cùng site nên cookie vẫn được gửi với `credentials: "include"`. Backend cần `CORS_ORIGINS=https://giathinh.vn,https://www.giathinh.vn`.
- `rewrites` dùng `next.config` (không dùng `proxy.ts`): trên Vercel rewrite ra ngoài xử lý ở edge, không tốn lượt chạy middleware; Vercel build lại mỗi lần deploy nên giá trị cố định lúc build không là vấn đề.
- Giới hạn đã biết: ở chế độ proxy backend thấy IP của Vercel/Next, nên giới hạn đăng nhập tính chung. Chấp nhận cho dev và preview (chỉ đội dự án dùng). Production gọi thẳng nên backend thấy IP thật (nginx trên VPS gắn `X-Forwarded-For`, backend `TRUST_PROXY=1`).

Thay đổi backend kèm theo (nhỏ): `cors({ ..., maxAge: 600 })` để trình duyệt cache preflight 10 phút; ghi chú cấu hình `CORS_ORIGINS`/`TRUST_PROXY` cho production trong `back-end/README.md`.

`front-end/.env.example` (mới, chỉ giá trị mẫu) ghi hai biến trên kèm giải thích.

## 4. Phiên đăng nhập

Chạy hoàn toàn ở client.

- **Access token chỉ ở bộ nhớ** (biến module trong `lib/api/session.ts`), không ghi `localStorage`/`sessionStorage`/cookie đọc được. Mọi request gửi `credentials: "include"` để trình duyệt kèm `gt_refresh`.
- **Khởi tạo**: khi vào bất kỳ trang trong khung admin, `AuthProvider` gọi `POST /auth/refresh`. Thành công → lưu token, gọi `GET /auth/me` lấy `user` và `permissions`, trạng thái `authenticated`. Thất bại (401) → trạng thái `anonymous` → chuyển `/admin/dang-nhap?next=<đường dẫn hiện tại + query>`. Trong lúc chờ: hiện skeleton của khung admin, không render nội dung trang.
- **Refresh khi 401**: `apiFetch` gặp 401 với request đã có token → gọi refresh **một lần** (single-flight: mọi request đang chờ dùng chung một Promise refresh, vì refresh xoay vòng token, hai lần song song sẽ làm lần sau dùng token đã huỷ) → thành công thì gửi lại request gốc **một lần**; vẫn 401 hoặc refresh thất bại → xoá phiên, chuyển trang đăng nhập. Không refresh cho chính các request `/auth/login`, `/auth/refresh`, `/auth/logout`.
- **Nhiều tab**: các tab dùng chung cookie `gt_refresh`. Hai tab refresh song song sẽ gửi cùng một refresh token; backend coi lần gửi lại sau thời gian ân hạn là dùng lại token và huỷ cả họ token (đăng xuất mọi tab). Vì vậy hàm refresh chạy trong `navigator.locks.request("gt-refresh", ...)`: tab sau chờ tab trước xong rồi mới gửi, lúc đó cookie đã là token mới. Trình duyệt không có Web Locks → chạy không khoá (vẫn có single-flight trong một tab).
- **Đăng nhập**: `POST /auth/login` → lưu token và `user`, gọi `/auth/me` lấy quyền → chuyển tới `next` (nếu hợp lệ) hoặc trang đầu tiên được phép (mục 5).
- **Tham số `next`**: chỉ chấp nhận chuỗi bắt đầu bằng `/admin` và không bắt đầu bằng `//` hay `/admin/dang-nhap`; ngược lại bỏ qua. Tránh open redirect.
- **Đăng xuất**: `POST /auth/logout` (lỗi mạng vẫn tiếp tục), xoá token và trạng thái, `queryClient.clear()`, chuyển `/admin/dang-nhap`.
- **Đổi mật khẩu**: backend huỷ mọi refresh token kể cả phiên hiện tại. Sau 204, front-end gọi lại `POST /auth/login` với `identifier = user.username` và mật khẩu mới để có phiên mới, toast "Đã đổi mật khẩu". Nếu đăng nhập lại thất bại → đăng xuất về trang đăng nhập.
- Trang đăng nhập khi đã có phiên hợp lệ (refresh thành công) → chuyển thẳng vào admin.

## 5. Menu và chặn trang theo quyền

`lib/auth/permissions.ts`: `hasPermission(permissions, required)` cùng luật với backend: quyền `*`, trùng khớp, hoặc `<tài nguyên>.*`. Bảng route dùng chung cho menu và chặn trang:

| Route | Quyền | Route | Quyền |
|---|---|---|---|
| `/admin` (Tổng quan) | `dashboard.read` | `/admin/nguoi-dung` | `user.manage` |
| `/admin/lich-dang-ky` | `lead.read` | `/admin/giao-vien` | `instructor.read` |
| `/admin/lop-hoc` | `class.read` | `/admin/xe-tap-lai` | `vehicle.read` |
| `/admin/lich-thi` | `exam.read` | `/admin/hoc-phi` | `tuition.read` |
| `/admin/bai-viet` (và trang con) | `post.manage` | `/admin/chi-nhanh`, `/admin/cai-dat`, `/admin/tro-giup`, `/admin/tai-khoan` | mọi nhân viên đã đăng nhập |

- Menu ẩn mục không có quyền; nhóm menu không còn mục nào thì ẩn luôn tiêu đề nhóm.
- Khung admin so đường dẫn hiện tại với bảng (khớp tiền tố dài nhất); thiếu quyền → màn "Không có quyền truy cập" (nút về trang đầu tiên được phép), không render trang.
- `/admin` khi không có `dashboard.read` (biên tập viên, giáo viên) → `router.replace` tới mục đầu tiên được phép theo thứ tự menu, **ưu tiên mục cần quyền riêng** (biên tập viên → Bài viết, giáo viên → Lớp học); không có mục nào như vậy thì về mục chung đầu tiên (Chi nhánh).
- Đây là lớp hiển thị; backend vẫn là nơi kiểm quyền thật.

## 6. Giao diện

- **Route group** (URL không đổi):
  - `app/admin/layout.tsx`: giữ metadata noindex, bọc `QueryProvider` + `AuthProvider` + `Toaster`.
  - `app/admin/(panel)/layout.tsx`: `AdminShell` + chặn đăng nhập/quyền. Mọi trang admin hiện có chuyển vào `(panel)/`.
  - `app/admin/dang-nhap/page.tsx`: ngoài khung admin.
- **Trang đăng nhập**: logo + tên trường; ô "Số điện thoại hoặc tên đăng nhập", ô mật khẩu có nút hiện/ẩn; nút "Đăng nhập" (trạng thái đang gửi); dòng "Quên mật khẩu? Liên hệ quản trị viên để được cấp mật khẩu tạm." Lỗi sai tài khoản hiện ngay trên form. Dùng component sẵn có trong `components/ui` (`input`, `button`, `label`, `field`, `card`).
- **Header**: tên và chữ cái đầu (avatar) của người đang đăng nhập, vai trò tiếng Việt: `super_admin` Quản trị viên, `branch_manager` Quản lý chi nhánh, `consultant` Tư vấn viên, `editor` Biên tập viên, `instructor` Giáo viên. Menu thả xuống: "Tài khoản" (`/admin/tai-khoan`), "Đăng xuất".
- **Trang `/admin/tai-khoan`**:
  - Hồ sơ: tên, SĐT (`PATCH /auth/me`); username hiển thị chỉ đọc. Lưu xong cập nhật `user` trong `AuthProvider` và toast.
  - Đổi mật khẩu: mật khẩu hiện tại, mật khẩu mới, nhập lại (khớp nhau, kiểm ở client); xử lý phiên như mục 4.
  - Lỗi trường từ backend hiện dưới ô tương ứng.

## 7. API client và xử lý lỗi

- `lib/api/client.ts`: `apiFetch<T>(path, { method, body, query, signal })`:
  - Ghép `NEXT_PUBLIC_API_URL` + `path`; `query` bỏ giá trị rỗng/undefined.
  - `body` là object → JSON (`Content-Type: application/json`); là `FormData` → gửi nguyên.
  - Gắn `Authorization: Bearer <token>` khi có token.
  - 204 → `undefined`; 2xx → trả nguyên JSON (`{ data }` hoặc `{ data, meta }`), helper `apiData<T>()` lấy `data`.
  - Lỗi → ném `ApiError { status, code, message, details, retryAfterSec? }` (đọc từ `{ error }`; `retryAfterSec` lấy từ header `RateLimit` (`reset=`) hoặc `Retry-After` khi 429). Lỗi mạng/không đọc được JSON → `ApiError { status: 0, code: "NETWORK_ERROR" }`.
- `lib/api/errors.ts`:
  - `fieldErrors(details)`: `[{ path: "body.phone", message }]` → `{ phone: message }` (bỏ tiền tố `body.`/`query.`; đường dẫn lồng giữ dạng `a.b`).
  - `errorMessage(error)` cho toast: 403 "Bạn không có quyền thực hiện thao tác này"; 429 "Thao tác quá nhiều lần, thử lại sau N phút"; 0 hoặc 5xx "Không kết nối được máy chủ, vui lòng thử lại"; còn lại dùng `message` từ backend.
- `components/providers/query-provider.tsx`: một `QueryClient` cho mỗi phiên trình duyệt; mặc định `retry` chỉ cho lỗi mạng/5xx (tối đa 1 lần), không retry 4xx; `refetchOnWindowFocus: false`. Toast lỗi cho mutation đặt ở `MutationCache.onError` (trừ khi mutation tự xử lý qua `meta.silent`).
- Thông báo dạng toast: `sonner` (theo hướng dẫn shadcn), `Toaster` đặt ở layout admin.

## 8. Phụ thuộc mới (front-end)

- `@tanstack/react-query`, `sonner`.
- Dev: `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `@vitejs/plugin-react`. Script `test`.

## 9. Kiểm thử

- Unit: `apiFetch` (gắn token; 401 → refresh một lần rồi gửi lại; ba request 401 đồng thời → đúng một lần refresh; refresh thất bại → xoá phiên; không refresh cho `/auth/*`; đọc `ApiError`, 204, lỗi mạng, `retryAfterSec`), `hasPermission`, bảng route (khớp tiền tố dài nhất, trang đầu tiên được phép), kiểm tra `next`, `fieldErrors`, `errorMessage`.
- Component (Testing Library, `fetch` giả): form đăng nhập (thành công → chuyển `next`; sai mật khẩu → lỗi trên form; 429 → thông báo thời gian chờ); chặn trang (refresh 401 → chuyển trang đăng nhập; thiếu quyền → màn không có quyền; menu ẩn mục); đổi mật khẩu → gọi login lại.
- Chạy thật với backend local (cuối đợt): đăng nhập bằng username và SĐT, tải lại trang vẫn đăng nhập, token hết hạn tự refresh (giảm `JWT_ACCESS_EXPIRES_MIN=1` để thử), hai tab cùng mở, đăng xuất, đổi mật khẩu, vai trò `editor` chỉ thấy menu bài viết.
- Bắt buộc qua: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` ở `front-end/`; backend `npm test` sau khi sửa CORS.

## 10. Rủi ro

- Lần đầu vào admin chậm thêm một vòng refresh (~100–300 ms): chấp nhận, hiện skeleton.
- Người dùng chặn cookie bên thứ ba không ảnh hưởng: cả hai chế độ đều là cookie same-site.
- Chế độ proxy ở preview dùng chung giới hạn đăng nhập theo IP Vercel: chấp nhận (mục 3).
