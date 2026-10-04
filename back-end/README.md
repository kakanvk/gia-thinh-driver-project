# Gia Thịnh — Backend API

API cho website và trang quản trị Trường lái Gia Thịnh. Express 5 + MongoDB + TypeScript.

Thiết kế: `docs/superpowers/specs/2026-10-03-backend-api-design.md`

## Chạy ở máy dev

### 1. Chuẩn bị MongoDB Atlas (một lần)

1. Tạo cluster trên [MongoDB Atlas](https://cloud.mongodb.com) (gói M0 miễn phí đủ cho dev).
2. **Database Access → Add New Database User**: tạo user/mật khẩu cho backend, quyền *Read and write*. Đây là tài khoản backend dùng để kết nối, khác tài khoản đăng nhập Atlas.
3. **Network Access → Add IP Address**: thêm IP máy dev (và IP server khi deploy).
4. **Database → Connect → Drivers**: copy connection string `mongodb+srv://...`.

Nên tách database theo môi trường: `gia-thinh-dev` cho dev, `gia-thinh` cho production (cùng cluster hoặc khác cluster đều được).

### 2. Cấu hình và chạy

```bash
cp .env.example .env
# điền MONGODB_URL (chuỗi Atlas, thêm tên database sau ".net/"),
# JWT_ACCESS_SECRET, SEED_ADMIN_USERNAME, SEED_ADMIN_PHONE, SEED_ADMIN_PASSWORD
npm install
npm run seed                  # chi nhánh, cài đặt, tài khoản super_admin
npm run dev                   # http://localhost:4000/api/v1
```

- Tài liệu API: http://localhost:4000/api/docs
- Kiểm tra: `curl http://localhost:4000/api/v1/health`
- Ký tự đặc biệt trong mật khẩu database phải mã hoá URL trong `MONGODB_URL` (vd. `@` → `%40`).
- `npm test` không dùng Atlas — test chạy MongoDB trong RAM.

### Tuỳ chọn: MongoDB local bằng Docker

Nếu không muốn dùng Atlas khi dev:

```bash
docker compose up -d          # MongoDB ở localhost:27017
# trong .env: MONGODB_URL=mongodb://127.0.0.1:27017/gia-thinh-dev
```

## Lệnh

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Chạy dev, tự reload |
| `npm test` | Toàn bộ test (MongoDB trong RAM) |
| `npm run typecheck` / `npm run lint` | Kiểm tra kiểu / lint |
| `npm run build` && `npm start` | Build và chạy bản production |
| `npm run seed` / `npm run seed:prod` | Seed dữ liệu (dev / sau khi build) |
| `npm run seed:reset` | **Xoá sạch database dev** rồi seed lại (xem bên dưới) |
| `npm run postman` | Sinh lại Postman collection từ tài liệu API (xem bên dưới) |

## Postman

File trong `docs/postman/`, sinh từ `src/docs/openapi.ts` (sửa API thì sửa `openapi.ts` rồi chạy `npm run postman`):

- `gia-thinh-api.postman_collection.json` — 126 request, chia thư mục theo nghiệp vụ.
- `gia-thinh-local.postman_environment.json` — biến `baseUrl` (mặc định `http://localhost:4000/api/v1`), `identifier`, `password`.

Cách dùng:

1. Postman/Bruno → **Import** file collection. Mở tab biến của collection (*Variables* ở Postman, *Vars* ở Bruno), điền `password` (= `SEED_ADMIN_PASSWORD`); `baseUrl` mặc định `http://localhost:4000/api/v1`, `identifier` mặc định `admin`. File environment là tuỳ chọn: import khi cần đổi `baseUrl` theo môi trường (biến environment ghi đè biến collection).
2. Chạy **Auth → Đăng nhập** trước: access token tự lưu vào biến `accessToken`, các request khác tự gắn `Authorization: Bearer`. Token hết hạn sau 15 phút → chạy **Cấp lại access token** (Postman tự gửi cookie `gt_refresh`) hoặc đăng nhập lại.
3. Request có `:id` lấy id từ biến collection (`branchId`, `courseId`, `leadId`, …). Biến được điền tự động khi gọi request **danh sách** (lấy bản ghi đầu tiên nếu biến còn trống) hoặc **tạo mới** (lấy bản ghi vừa tạo). Muốn đổi bản ghi: sửa biến ở tab *Variables* của collection.

Lưu ý: nên gọi từng request. Không bấm *Run collection* trên database đang dùng, vì collection có cả **Đổi mật khẩu**, **Xóa** và **Khóa tài khoản**, chạy hết sẽ đổi mật khẩu admin và xóa dữ liệu mẫu.

## Seed lại dữ liệu

`npm run seed` chỉ **thêm phần còn thiếu**, không ghi đè: chi nhánh, cài đặt, admin đã có thì bỏ qua; gói học, bảng giá, bài viết mẫu chỉ nạp ở lần đầu (đánh dấu bằng document `__seed_catalog_v1` trong collection `settings`). Chạy lại nhiều lần đều an toàn.

**Nạp lại gói học / bảng giá / bài viết mẫu** (giữ nguyên khách hàng, học viên, học phí, tài khoản):

```bash
# mongosh hoặc Atlas → Browse Collections → settings
db.settings.deleteOne({ key: '__seed_catalog_v1' })
npm run seed
```

Chỉ tạo lại mục đã bị xoá; mục đang có (kể cả đã sửa) giữ nguyên. Muốn về đúng dữ liệu mẫu thì xoá mục đó trên admin trước.

**Xoá sạch và seed từ đầu** (chỉ database dev):

```bash
npm run seed:reset            # hỏi gõ lại tên database để xác nhận
npm run seed:reset -- --yes   # bỏ qua bước xác nhận (script tự động)
```

- Xoá **toàn bộ** database trong `MONGODB_URL`: khách hàng, học viên, phiếu thu, tài khoản nhân viên… rồi tạo lại index và chạy seed (admin lấy từ `SEED_ADMIN_*` trong `.env`).
- Tự từ chối khi `NODE_ENV=production` hoặc tên database không chứa `dev` / `test` / `local` (vd. `gia-thinh` production).
- Ảnh đã upload (thư mục `uploads/` hoặc bucket GCS) **không** bị xoá; dọn tay nếu cần.

## Tài khoản nhân viên

- Không có đăng ký và không gửi email. Admin tạo tài khoản ở màn Người dùng (`POST /api/v1/users`) và gửi thông tin đăng nhập trực tiếp cho nhân viên.
- Nhân viên đăng nhập bằng **số điện thoại hoặc username** + mật khẩu.
- Quên mật khẩu: liên hệ admin để được cấp mật khẩu tạm (`POST /api/v1/users/:id/reset-password`).

## Bảng giá theo chi nhánh

- **Giá mặc định** nằm ở gói học (`/courses`, chỉ super_admin sửa). Mọi chi nhánh dùng giá này.
- **Giá riêng** của một chi nhánh: `PUT /pricing/branches/:branchId/courses/:courseId` (quản lý chi nhánh đó hoặc super_admin). `DELETE` cùng đường dẫn để về giá mặc định.
- **Phụ phí / ưu đãi** (`/pricing/items`, `kind: fee | discount`): mục `branchId: null` áp dụng mọi chi nhánh (chỉ super_admin). Chi nhánh tạo mục cùng `key` để thay mục chung, hoặc `hidden: true` để ẩn mục chung ở chi nhánh mình.
- Website đọc giá cuối cùng ở `GET /public/pricing?branch=<slug>`; chi nhánh luôn hiện đủ mọi gói đang bán.

## Bài viết

- Trạng thái: `draft → (pending) → published → draft`; `archived` khôi phục về `draft` qua `POST /posts/:id/restore`. Người có quyền bài viết được xuất bản trực tiếp; `publishedAt` ở tương lai = hẹn giờ.
- Nội dung là Plate JSON; link/ảnh chỉ nhận `http(s)://`, đường dẫn `/...`, `#`, `mailto:`, `tel:`.

## Khách hàng (CRM) và lịch hẹn

- Form tư vấn trên website gửi `POST /api/v1/public/leads` với `branch` (slug từ `/public/branches`), `courseCode` (mã từ `/public/pricing`, bỏ trống nếu chưa chọn), `consent: true`. Trường ẩn `website` phải để trống (chống spam). Giới hạn 10 lần/giờ/IP và 3 lần/24 giờ/SĐT.
- Cùng SĐT gửi lại khi khách còn đang chăm sóc → không tạo khách mới, ghi "gửi lại form" vào lịch sử.
- Trạng thái: `new → contacted → consulted → deposited → docs_completed` (đi tiến, có thể nhảy bước); `lost` cần lý do, mở lại bằng `contacted`. "Nhập học" sẽ có ở đợt học viên.
- Nhân viên chỉ thấy khách và lịch hẹn của chi nhánh mình. Xuất CSV (`/leads/export`) và xóa khách chỉ dành cho quản lý chi nhánh / quản trị viên.

## Đào tạo

- **Giáo viên** (`/instructors`): có thể gắn với tài khoản vai trò `instructor` cùng chi nhánh (`userId`). Tài khoản giáo viên chỉ thấy lớp mình phụ trách và học viên các lớp đó (không thấy CCCD, địa chỉ, ngày sinh).
- **Lớp học** (`/classes`): trạng thái `enrolling → upcoming → ongoing → finished` do người dùng đặt; sĩ số tính từ học viên, vượt `capacity` bị từ chối. Website lấy lịch khai giảng ở `GET /public/classes/upcoming?branch=&course=`.
- **Học viên** (`/students`): mã `HV-yyMMdd-NN`; xếp lớp qua `PATCH /students/:id/class` (cùng chi nhánh, cùng gói, lớp chưa kết thúc).
- **Chuyển khách thành học viên:** `POST /leads/:id/convert` khi khách ở trạng thái Đặt cọc hoặc Hoàn tất hồ sơ. Chuyển khách cũng tạo luôn sổ học phí (xem "Học phí và báo cáo").
- **Lịch thi** (`/exams`): ca thi tốt nghiệp/sát hạch, thêm thí sinh (học viên đang học, cùng chi nhánh và gói), nhập kết quả; đậu sát hạch → học viên "hoàn thành". Website lấy lịch thi ở `GET /public/exams/upcoming`.
- **Xe tập lái** (`/vehicles`): `GET /vehicles/alerts?days=30` liệt kê xe sắp đến hạn hoặc quá hạn bảo dưỡng/đăng kiểm.

## Học phí và báo cáo

- **Sổ học phí** tự tạo khi tạo học viên (giá theo chi nhánh, 1 đợt hạn sau 14 ngày). Học viên tạo trước đó: `POST /api/v1/tuition { studentId }`. Sửa giảm trừ / chia đợt: `PATCH /tuition/:id` (tổng các đợt phải bằng tổng học phí).
- **Thu tiền:** `POST /tuition/:id/payments` (quản lý chi nhánh), số phiếu `PT-yyMMdd-NN`, không thu vượt số còn lại. **Hủy phiếu** chỉ super_admin: `DELETE /tuition/:id/payments/:paymentId { reason }` (hủy mềm, giữ để đối soát).
- **Quá hạn:** server tự chạy job mỗi 60 phút (và lúc khởi động); đợt có hạn hôm nay chỉ thành quá hạn từ 00:00 hôm sau (giờ VN).
- **Tổng quan** (`/dashboard/*`): số liệu theo chi nhánh của người xem; doanh thu là **thực thu** theo ngày thu tiền; tỷ lệ đậu là sát hạch lần đầu. Chưa có chỉ tiêu doanh thu.

## Chạy cùng front-end

Front-end (`front-end/`) gọi API theo `NEXT_PUBLIC_API_URL`:

- **Dev / preview Vercel** (`NEXT_PUBLIC_API_URL=/api/v1`): Next.js chuyển tiếp `/api/v1/*` và `/uploads/*` tới `API_ORIGIN` (dev: `http://localhost:4000`). Không cần CORS; backend thấy IP của máy chạy Next nên giới hạn đăng nhập tính chung.
- **Production** (`NEXT_PUBLIC_API_URL=https://api.giathinh.vn/api/v1`): trình duyệt gọi thẳng backend. Cấu hình backend:
  - `CORS_ORIGINS=https://giathinh.vn,https://www.giathinh.vn`
  - `TRUST_PROXY=1` khi chạy sau nginx (nginx gắn `X-Forwarded-For`), để giới hạn đăng nhập tính theo IP người dùng.
  - `COOKIE_DOMAIN` để trống (cookie `gt_refresh` thuộc `api.giathinh.vn`; `giathinh.vn` và `api.giathinh.vn` cùng site nên trình duyệt vẫn gửi).
- Preflight CORS được trình duyệt cache 10 phút (`Access-Control-Max-Age: 600`).

## Lưu ảnh trên Google Cloud Storage

1. Tạo bucket, bật *Uniform bucket-level access*, cấp `allUsers` quyền `Storage Object Viewer` để ảnh xem công khai.
2. Tạo service account có quyền `Storage Object Admin` trên bucket, tải file JSON key, đặt vào `secret/` (đã được gitignore và dockerignore, không bao giờ commit).
3. Trong `.env`: `STORAGE_DRIVER=gcs`, `GCS_BUCKET=<tên bucket>`, `GOOGLE_APPLICATION_CREDENTIALS=./secret/<tên-file>.json`.
   Nếu đặt CDN/domain riêng: `PUBLIC_MEDIA_BASE_URL=https://cdn.giathinh.vn`.

## Cấu trúc

`src/modules/<tính năng>/` chứa model, service, controller, routes, validation của từng nghiệp vụ.
Middleware dùng chung ở `src/middlewares/`, helper ở `src/shared/` và `src/utils/`.
