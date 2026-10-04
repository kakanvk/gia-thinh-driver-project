# Thiết kế Backend API — Trường lái Gia Thịnh

- Ngày: 2026-10-03
- Trạng thái: Chờ review
- Phạm vi: `back-end/` phục vụ website `front-end/` (Next.js 16) và toàn bộ màn hình admin.

## 1. Mục tiêu & phạm vi

### Mục tiêu
- Thay toàn bộ dữ liệu hard-code trong `front-end/lib/*` và `front-end/app/page.tsx` bằng dữ liệu từ API.
- Admin đăng nhập theo vai trò, mỗi nhân viên chỉ thao tác trong chi nhánh được gán.
- Quản lý khách hàng điền form liên hệ theo luồng trạng thái, làm nền cho CRM mini.
- Bảng giá gói học, bài viết (gồm mẹo học), lịch thi, lịch khai giảng chỉnh động trong admin.
- Có API cho đủ 11 màn admin: Tổng quan, Lịch đăng ký, Lớp học, Lịch thi, Người dùng, Chi nhánh, Giáo viên, Xe tập lái, Học phí, Bài viết, Cài đặt (+ Trợ giúp dùng dữ liệu Cài đặt).

### Ngoài phạm vi
- Diễn đàn thảo luận `/thao-luan` (bỏ khỏi sản phẩm).
- Tài khoản học viên / khách hàng: khách không đăng nhập.
- Nhân viên tự đăng ký tài khoản, gửi email (kể cả quên mật khẩu qua email).
- Gửi SMS/Zalo tự động, thanh toán online.

### Tiêu chí thành công
- Front-end chuyển sang gọi API mà nội dung hiển thị không đổi (nhờ seed từ dữ liệu mẫu hiện có).
- Nhân viên chi nhánh A không đọc/sửa được dữ liệu chi nhánh B (có test chứng minh).
- Form tư vấn trên website tạo được lead thật, admin thấy và xử lý được.
- Đổi giá trong admin → website hiển thị giá mới cho đúng chi nhánh.

## 2. Công nghệ

| Hạng mục | Lựa chọn |
|---|---|
| Runtime | Node.js ≥ 20, TypeScript strict |
| Web | Express 5 |
| DB | MongoDB + Mongoose 8 |
| Validation | zod (body/query/params và biến môi trường) |
| Đăng nhập | SĐT hoặc username + mật khẩu (không dùng email) |
| Auth | JWT access token + refresh token (cookie httpOnly) |
| Log | pino (+ `requestId` mỗi request) |
| Upload | multer + sharp; lưu Google Cloud Storage (prod) / ổ đĩa local (dev) |
| Thời gian | `date-fns` + `date-fns-tz`, múi giờ nghiệp vụ `Asia/Ho_Chi_Minh` |
| Tài liệu API | Swagger/OpenAPI tại `/api/docs` |
| Test | Vitest + Supertest + mongodb-memory-server |

Template `node-express-boilerplate` (JS, Express 4, Mongoose 5) được viết lại sang TypeScript theo cấu trúc feature-based; chỉ tái sử dụng ý tưởng (plugin phân trang/toJSON, token model).

## 3. Cấu trúc thư mục

```
back-end/
├── src/
│   ├── config/
│   │   ├── env.ts              # Validate env bằng zod, export object typed
│   │   ├── db.ts               # mongoose.connect
│   │   ├── logger.ts           # pino
│   │   └── roles.ts            # vai trò → danh sách quyền
│   ├── modules/
│   │   ├── auth/  users/  settings/  branches/
│   │   ├── courses/  pricing/
│   │   ├── categories/  posts/  media/
│   │   ├── leads/  appointments/
│   │   ├── students/  instructors/  classes/  vehicles/  exams/
│   │   ├── tuition/  dashboard/  audit/
│   │   └── public/             # route công khai, gọi service của các module khác
│   │       (mỗi module: *.model.ts, *.controller.ts, *.service.ts,
│   │        *.routes.ts, *.validation.ts, *.types.ts, *.repository.ts tùy chọn)
│   ├── middlewares/
│   │   ├── auth.middleware.ts       # verify JWT, gắn req.user
│   │   ├── authorize.middleware.ts  # kiểm tra quyền + phạm vi chi nhánh
│   │   ├── validate.middleware.ts   # nhận zod schema
│   │   ├── error.middleware.ts
│   │   ├── rateLimit.middleware.ts
│   │   └── upload.middleware.ts     # multer
│   ├── shared/
│   │   ├── storage/                 # StorageDriver: local.ts, gcs.ts
│   │   ├── mongoose/                # plugin paginate, toJSON, softDelete
│   │   └── time.ts                  # helper múi giờ VN
│   ├── jobs/                        # job định kỳ (quá hạn học phí, trạng thái lớp/kỳ thi)
│   ├── scripts/seed.ts              # seed từ dữ liệu mẫu front-end
│   ├── utils/  ApiError.ts  asyncHandler.ts  jwt.ts  response.ts
│   ├── types/express.d.ts           # req.user
│   ├── routes/index.ts              # gom routes, prefix /api/v1
│   ├── app.ts
│   └── server.ts                    # connect DB, listen, graceful shutdown
├── tests/  unit/  integration/
├── .env.example  tsconfig.json  eslint.config.js  package.json  Dockerfile
```

## 4. Quy ước chung

### Response
- Thành công: `{ data }` hoặc `{ data: [...], meta: { page, limit, total } }`.
- Lỗi: `{ error: { code, message, details? } }`, `message` tiếng Việt.
- Mã lỗi cố định: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `BRANCH_FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`.

### Danh sách
- Query chung: `page` (mặc định 1), `limit` (mặc định 20, tối đa 100), `sort` (vd `-createdAt`), `q` (tìm kiếm), cộng filter riêng từng resource.

### Dữ liệu
- Mọi collection có `createdAt`, `updatedAt`. Bản ghi nghiệp vụ quan trọng xóa mềm bằng `deletedAt`.
- Tiền: số nguyên, đơn vị đồng.
- ID: ObjectId; resource công khai dùng thêm `slug`.

### Thời gian (UTC+7)
- Múi giờ nghiệp vụ: `APP_TIMEZONE=Asia/Ho_Chi_Minh`.
- MongoDB lưu `Date` (nội bộ là UTC — không đổi được); mọi chỗ còn lại theo giờ VN:
  - API trả ISO 8601 có offset: `2026-10-05T08:00:00+07:00`.
  - Input datetime không có offset được hiểu là giờ VN.
  - Trường chỉ có ngày (ngày thi, khai giảng, hạn đóng) nhận `YYYY-MM-DD`, hiểu là 00:00 giờ VN.
  - Aggregation theo ngày/tháng dùng `timezone: "Asia/Ho_Chi_Minh"`.
  - Job định kỳ chạy theo giờ VN.

## 5. Phân quyền

### Vai trò (cố định)
| Vai trò | Phạm vi | Mô tả |
|---|---|---|
| `super_admin` | Mọi chi nhánh | Toàn quyền, sửa giá mặc định, cài đặt, quản lý user |
| `branch_manager` | Chi nhánh được gán | Quản lý mọi nghiệp vụ trong chi nhánh, sửa giá ghi đè, tạo consultant/instructor của chi nhánh |
| `consultant` | Chi nhánh được gán | Leads, lịch hẹn, học viên; đọc sổ học phí |
| `editor` | Toàn hệ thống (nội dung) | Bài viết, chuyên mục, media |
| `instructor` | Lớp được phân công | Đọc lớp, học viên, lịch thi của mình |

- User có `role` và `branchIds[]`; `super_admin` bỏ qua kiểm tra chi nhánh.
- `config/roles.ts` khai báo quyền theo vai trò, vd `consultant: ['lead.read','lead.update','appointment.*','student.read','student.create','tuition.read']`.

### Cơ chế
- `authorize('lead.update', { branchScoped: true })`:
  1. Kiểm tra vai trò có quyền.
  2. Với `branchScoped`, gắn `req.scope = { branchIds }`; repository tự thêm điều kiện `branchId ∈ branchIds` khi đọc.
  3. Khi tạo/sửa, `branchId` trong body phải thuộc `branchIds`, nếu không trả `BRANCH_FORBIDDEN`.
- Phạm vi `instructor` lọc theo `instructorId` của chính họ thay vì theo chi nhánh.

## 6. Data model

### Hệ thống & tổ chức
- **users**: `name, username (unique, chữ thường), phone (unique, dạng 0xxxxxxxxx), email?, passwordHash, role, branchIds[], avatarMediaId?, status (active|suspended), lastLoginAt`
- **tokens**: `userId, tokenHash, type (refresh), family, expiresAt, revokedAt?`
- **branches**: `name, slug (unique), officeName, address, mapUrl?, phone?, managerId?→users, openingHours, order, status (active|inactive)`
- **settings**: key–value, `key (unique), value (Mixed), updatedBy`. Các key: `hotline`, `zaloOa`, `supportEmail`, `socials`, `supportContacts`, `supportPlaybook`, `registerNotes`, `consultationContactTimes`.
- **auditLogs**: `actorId, action, entity, entityId, before, after, at`

### Gói học & giá
- **courses**: `code (unique: A1|A|B_MT|B_AT|C1…), name, vehicleType (moto|car|truck), description, duration, defaultPrice, priceNote, imageMediaId?, order, active`
- **priceOverrides**: `branchId, courseId, price, priceNote?` — unique `(branchId, courseId)`.
- **courseFees** (phụ phí) / **courseDiscounts** (ưu đãi): `key, courseId?, branchId?, label, amount?, note?, order`
  - `branchId = null`: áp dụng mọi chi nhánh.
  - Mục có `branchId` cùng `key` với mục chung → thay thế mục chung cho chi nhánh đó; khác `key` → bổ sung.
- **branchCourseSettings** (mở rộng sau): `branchId, courseId, hidden`.

#### Quy tắc tính giá cuối cùng cho chi nhánh X
- Trả **đủ mọi gói `active`** (trừ gói bị `hidden` ở X).
- `price = priceOverrides(X, course)?.price ?? course.defaultPrice`; tương tự `priceNote`.
- Phụ phí/ưu đãi = mục chung, thay/bổ sung bởi mục của X theo `key`.
- API công khai chỉ trả con số cuối; API admin trả thêm `source: 'default' | 'override'`.

### Nội dung
- **categories**: `name, slug (unique), description, isAnnouncement, order`
- **posts**: `title, slug (unique), excerpt, content (Plate JSON), contentText, coverMediaId?, categoryId, tags[], authorId, branchId?, status (draft|pending|published|archived), publishedAt?, views, seo { title?, description? }`
- **media**: `key, url, mimeType, size, width, height, alt?, uploadedBy, refs[{ entity, entityId }]`

### CRM
- **leads**: `name, phone, email?, courseInterest, branchId, preferredContactTime?, note?, source (website|facebook|tiktok|zalo|referral|walk_in|other), utm{}?, status, lostReason?, assigneeId?, nextFollowUpAt?, studentId?`
  - Luồng `status`: `new → contacted → consulted → deposited → docs_completed → enrolled`; từ bất kỳ bước nào trước `enrolled` có thể sang `lost` (bắt buộc `lostReason`). Cho phép mở lại `lost → contacted`.
  - Sang `enrolled` chỉ qua `POST /leads/:id/convert`.
- **leadActivities**: `leadId, type (status_change|call|note|sms|meeting), fromStatus?, toStatus?, content?, byUserId, at`
- **appointments**: `leadId?, studentId?, branchId, startAt, type (consult|docs|other), assigneeId?, status (scheduled|done|cancelled|no_show), note?`

### Đào tạo
- **students**: `code (unique), name, phone, email?, dob?, idNumber?, address?, courseId, branchId, classId?, leadId?, status (studying|paused|completed|dropped), enrolledAt`
- **instructors**: `userId?→users, name, phone, specialties[] (course code), branchId, status (active|on_leave|inactive)`
- **classes**: `code (unique), courseId, branchId, instructorId?, startDate, endDate, scheduleText, capacity, status (enrolling|upcoming|ongoing|finished)`; sĩ số = đếm `students` theo `classId`.
- **vehicles**: `plate (unique), model, courseCode, branchId, odometer, datKm, lastServiceAt?, nextServiceAt?, registrationExpiresAt?, status (active|maintenance|paused)`
- **examSessions**: `code (unique), type (graduation|official), courseId, branchId, date, location?, status (scheduled|upcoming|done)`
- **examCandidates**: `sessionId, studentId, result (pending|passed|failed|absent), score?` — unique `(sessionId, studentId)`.

### Tài chính
- **tuitionAccounts**: `studentId (unique), courseId, branchId, listPrice, discounts[{ label, amount }], total, plan (one_time|installments), installments[{ dueDate, amount }], status (paid|partial|overdue)`
- **payments**: `tuitionAccountId, amount, method (cash|transfer), paidAt, receivedBy, receiptNo, note?`
- `paid` = tổng `payments`; `status` tính lại khi thêm/xóa payment và bởi job hằng ngày (đến hạn mà chưa đủ → `overdue`).

### Quan hệ
`lead —convert→ student + tuitionAccount`; `student → class → instructor`; `student → examCandidate → examSession`; mọi bản ghi nghiệp vụ có `branchId`.

## 7. Endpoint (`/api/v1`)

Ký hiệu: **(CN)** = tự lọc theo chi nhánh người gọi. CRUD chuẩn = `GET /x`, `POST /x`, `GET /x/:id`, `PATCH /x/:id`, `DELETE /x/:id`.

### Công khai (không đăng nhập)
| Method | Path | Mô tả |
|---|---|---|
| GET | `/public/branches` | Văn phòng (form liên hệ, footer) |
| GET | `/public/pricing?branch=slug` | Bảng giá cuối theo chi nhánh; không truyền → tất cả chi nhánh |
| GET | `/public/classes/upcoming` | Lịch khai giảng |
| GET | `/public/exams/upcoming` | Lịch thi sắp tới |
| GET | `/public/categories` | Chuyên mục |
| GET | `/public/posts?category&q&page` | Tin đã xuất bản |
| GET | `/public/posts/:slug` | Chi tiết tin (+1 lượt xem) |
| GET | `/public/settings` | Hotline, Zalo, mạng xã hội, lưu ý đăng ký |
| POST | `/public/leads` | Gửi form tư vấn (rate limit theo IP + SĐT, honeypot) |

### Auth
| Method | Path | Mô tả |
|---|---|---|
| POST | `/auth/login` | Body `{ identifier, password }` — `identifier` là SĐT hoặc username. Trả access token; refresh token trong cookie httpOnly |
| POST | `/auth/refresh` | Xoay vòng refresh token, cấp access token mới |
| POST | `/auth/logout` | Thu hồi refresh token |
| GET | `/auth/me` | User + quyền + chi nhánh |
| PATCH | `/auth/me` | Sửa hồ sơ |
| POST | `/auth/change-password` | Đổi mật khẩu |

### Admin
| Resource | Quyền | Endpoint ngoài CRUD |
|---|---|---|
| `users` | super_admin; branch_manager tạo/sửa consultant, instructor trong CN | `PATCH /users/:id/status`, `POST /users/:id/reset-password` (cấp mật khẩu tạm, admin gửi trực tiếp cho nhân viên) |
| `branches` | đọc: mọi nhân viên; ghi: super_admin | — |
| `courses` | đọc: mọi nhân viên; ghi: super_admin | `PATCH /courses/reorder` |
| `pricing` | super_admin (mặc định); branch_manager (CN) | `GET /pricing/branches/:branchId`; `PUT /pricing/branches/:branchId/courses/:courseId`; `DELETE /pricing/branches/:branchId/courses/:courseId`; CRUD `/pricing/fees`, `/pricing/discounts` |
| `categories` | editor, branch_manager, super_admin | `PATCH /categories/reorder` |
| `posts` | editor, branch_manager, super_admin | `POST /posts/:id/submit`, `/publish`, `/unpublish`, `/archive`, `/duplicate` |
| `media` | upload: editor+; đọc: mọi nhân viên | `POST /media` (multipart), `GET /media?type` |
| `leads` (CN) | consultant, branch_manager | `PATCH /leads/:id/status`, `PATCH /leads/:id/assign`, `GET/POST /leads/:id/activities`, `POST /leads/:id/convert`, `GET /leads/export` (CSV) |
| `appointments` (CN) | consultant, branch_manager | `GET /appointments/calendar?month=YYYY-MM` |
| `students` (CN) | consultant, branch_manager; instructor đọc học viên lớp mình | `PATCH /students/:id/class` |
| `classes` (CN) | branch_manager; instructor đọc lớp mình | `GET /classes/:id/students` |
| `instructors` (CN) | branch_manager | `GET /instructors/:id/stats` |
| `vehicles` (CN) | branch_manager | `GET /vehicles/alerts` |
| `exams` (CN) | branch_manager; instructor đọc | `POST /exams/:id/candidates` (hàng loạt), `PATCH /exams/:id/candidates/:candidateId` |
| `tuition` (CN) | branch_manager; consultant đọc | `GET /tuition?status=overdue`, `POST /tuition/:id/payments`, `DELETE /tuition/:id/payments/:paymentId` (super_admin) |
| `settings` | super_admin | `GET /settings`, `PATCH /settings` |
| `audit` | super_admin | `GET /audit?entity&actor&from&to` |

### Dashboard (CN)
| GET | Mô tả |
|---|---|
| `/dashboard/summary` | Hồ sơ trong tháng, học viên đang học, lịch tuần này, tỷ lệ hoàn tất (kèm % so kỳ trước) |
| `/dashboard/registrations?range=7d` | Lead mới theo ngày |
| `/dashboard/funnel?month=YYYY-MM` | Phễu theo trạng thái lead |
| `/dashboard/sources?month=YYYY-MM` | Nguồn khách |
| `/dashboard/revenue?months=12` | Thực thu theo tháng (từ `payments`) + cơ cấu theo hạng |
| `/dashboard/pass-rate` | Tỷ lệ đỗ lần đầu theo hạng |

### Khác
- `GET /health`
- `GET /api/docs` (Swagger)

## 8. Upload & lưu trữ
- Interface `StorageDriver { put(key, buffer, mime): Promise<{ url }>; delete(key) }`; chọn bằng `STORAGE_DRIVER=local|gcs`.
- `gcs`: bucket `GCS_BUCKET`, credential qua `GOOGLE_APPLICATION_CREDENTIALS`, URL công khai (có thể đặt Cloud CDN sau).
- `local`: lưu `uploads/`, phục vụ tĩnh tại `/uploads/*` (dev).
- Chỉ nhận `image/jpeg|png|webp`, ≤ 5MB; `sharp` resize (cạnh dài ≤ 1920px) và chuyển webp; key ngẫu nhiên `yyyy/mm/<uuid>.webp`.

## 9. Lỗi & bảo mật
- `ApiError(status, code, message, details?)`; `error.middleware` chuẩn hóa lỗi zod, Mongoose (CastError, ValidationError, duplicate 11000), JWT. Production không trả stack.
- pino log với `requestId`; redact `password`, `token`, `authorization`, `idNumber`, `phone`.
- Access token 15 phút; refresh token cookie `httpOnly, Secure, SameSite=Lax`, xoay vòng, lưu hash, phát hiện tái sử dụng thì thu hồi cả chuỗi.
- bcrypt cho mật khẩu.
- Tài khoản nhân viên chỉ do admin tạo (`POST /users`) và gửi trực tiếp; không có đăng ký, không gửi email. Quên mật khẩu → admin cấp mật khẩu tạm; không bắt đổi mật khẩu ở lần đăng nhập đầu.
- helmet; CORS chỉ cho `CORS_ORIGINS`.
- Rate limit: `/auth/login` 5 lần/15 phút/IP; `/public/leads` theo IP và SĐT.
- Sanitize key `$`/`.`; validate cấu trúc Plate JSON; sanitize khi render HTML.
- Audit log cho: sửa giá/phụ phí/ưu đãi, thêm/xóa payment, đổi vai trò/chi nhánh/trạng thái user, xóa bản ghi.

## 10. Kiểm thử
- Vitest + Supertest + mongodb-memory-server; integration test chạy DB thật trong RAM.
- Bắt buộc có test cho:
  - Phạm vi chi nhánh: consultant CN A bị chặn đọc/sửa dữ liệu CN B; super_admin thấy tất cả.
  - Tính giá cuối: mặc định, ghi đè, phụ phí/ưu đãi thay thế và bổ sung, chi nhánh hiển thị đủ gói.
  - Chuyển trạng thái lead hợp lệ/không hợp lệ và ghi `leadActivities`.
  - Convert lead → student + tuitionAccount.
  - Sổ học phí: tổng đã thu, trạng thái `paid|partial|overdue`.
  - Dashboard nhóm theo ngày giờ VN (bản ghi 06:00 sáng giờ VN không bị tính sang hôm trước).

## 11. Biến môi trường
`NODE_ENV, PORT, TRUST_PROXY, LOG_LEVEL, MONGODB_URL, APP_TIMEZONE, JWT_ACCESS_SECRET, JWT_ACCESS_EXPIRES_MIN, JWT_REFRESH_EXPIRES_DAYS, CORS_ORIGINS, COOKIE_DOMAIN, STORAGE_DRIVER, UPLOAD_DIR, GCS_BUCKET, GOOGLE_APPLICATION_CREDENTIALS, PUBLIC_MEDIA_BASE_URL, SEED_ADMIN_USERNAME, SEED_ADMIN_PHONE, SEED_ADMIN_PASSWORD`

## 12. Thứ tự triển khai
Mỗi đợt có plan riêng và dùng được ngay khi xong.

1. **Nền tảng** — khung TS feature-based, config/logger/error/validate, auth, users, phân quyền chi nhánh, branches, settings, media (local + GCS), audit, seed.
2. **Nội dung & giá** — courses, pricing, categories, posts, API public tương ứng.
3. **CRM** — leads, leadActivities, appointments, `POST /public/leads`.
4. **Đào tạo** — students, instructors, classes, vehicles, exams, lịch công khai.
5. **Tài chính & báo cáo** — tuition, payments, job quá hạn, dashboard.

## 13. Seed dữ liệu
`npm run seed` nạp từ dữ liệu mẫu hiện có: `lib/contact.ts` (văn phòng), `lib/admin-data.ts` (chi nhánh, giáo viên, xe, lớp, kỳ thi, học phí, user, bài viết), `lib/news.ts` (chuyên mục, bài), `app/page.tsx` (gói học, giá theo chi nhánh, phụ phí, ưu đãi, lịch khai giảng) và tạo 1 tài khoản `super_admin` từ biến `SEED_ADMIN_USERNAME`/`SEED_ADMIN_PHONE`/`SEED_ADMIN_PASSWORD`.
