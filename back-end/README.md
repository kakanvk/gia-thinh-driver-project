# Gia Thịnh — Backend API

API cho website và trang quản trị Trường lái Gia Thịnh. Express 5 + MongoDB + TypeScript.

Thiết kế: `../docs/superpowers/specs/2026-10-03-backend-api-design.md`

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
# Seed gói học/bảng giá/bài viết chỉ nạp lần đầu; muốn nạp lại thì xoá document `__seed_catalog_v1` trong collection settings.
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

## Lưu ảnh trên Google Cloud Storage

1. Tạo bucket, bật *Uniform bucket-level access*, cấp `allUsers` quyền `Storage Object Viewer` để ảnh xem công khai.
2. Tạo service account có quyền `Storage Object Admin` trên bucket, tải file JSON key.
3. Trong `.env`: `STORAGE_DRIVER=gcs`, `GCS_BUCKET=<tên bucket>`, `GOOGLE_APPLICATION_CREDENTIALS=<đường dẫn file JSON>`.
   Nếu đặt CDN/domain riêng: `PUBLIC_MEDIA_BASE_URL=https://cdn.giathinh.vn`.

## Cấu trúc

`src/modules/<tính năng>/` chứa model, service, controller, routes, validation của từng nghiệp vụ.
Middleware dùng chung ở `src/middlewares/`, helper ở `src/shared/` và `src/utils/`.
