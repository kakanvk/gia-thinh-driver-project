# Front-end đợt B — Website công khai lấy dữ liệu thật

Ngày: 2026-10-04 · Nhánh: `feat/fe-api-integration` · Thư mục code: `front-end/` (+ sửa nhỏ `back-end/`)

Đợt trước: `2026-10-04-fe-dot-a-nen-tang-dang-nhap-design.md` (API client, đăng nhập admin).

## 1. Mục tiêu

Website công khai (trang chủ, `/tu-van`, `/dien-dan`, `/dien-dan/[slug]`, header, footer) bỏ dữ liệu cứng, lấy từ API `/api/v1/public/*`. Hết đợt B:

- Hotline/Zalo và danh sách văn phòng đúng như admin cấu hình.
- Bảng giá theo chi nhánh, lịch khai giảng, lịch thi sắp tới lấy từ dữ liệu thật.
- Form tư vấn tạo khách hàng thật trong CRM.
- Tin tức hiển thị bài đã xuất bản, nội dung soạn bằng Plate.

Ngoài phạm vi (giữ nguyên dữ liệu tĩnh): diễn đàn `thao-luan` (**đã chốt không làm backend**, giữ lưu `localStorage`), TikTok, thư viện `/thu-vien`, sân tập `/san-tap`, các khối giới thiệu/lộ trình/số liệu trên trang chủ, dòng địa chỉ + giờ tư vấn ở thanh trên cùng trang chủ, giờ làm việc ở footer, khối "Lưu ý chung cho hạng A & A1".

## 2. Lấy dữ liệu và cache

- Trang công khai là **Server Component**, gọi API phía server qua `lib/api/public.ts`: `fetch(`${API_ORIGIN}/api/v1/public${path}`, { next: { revalidate: 300 } })` — **ISR 5 phút**. Admin sửa → website cập nhật trong tối đa 5 phút.
- **`API_ORIGIN` bắt buộc ở mọi môi trường** (server Next cần địa chỉ tuyệt đối, kể cả production). Sửa spec/README đợt A: production `API_ORIGIN=https://api.giathinh.vn`.
- Hai hàm:
  - `publicGet<T>(path, query?)`: trả `data` của `{ data }`; ném `PublicApiError { status }` khi lỗi (status 0 khi không tới được máy chủ hoặc thiếu `API_ORIGIN`).
  - `publicGetOrNull<T>(path, query?)`: như trên nhưng trả `null` khi có bất kỳ lỗi nào (ghi `console.error`).
- Khối dữ liệu trên trang dùng `publicGetOrNull`; `null` → hiện thông báo dự phòng ("Thông tin đang được cập nhật, vui lòng gọi hotline …"), trang vẫn render. Nhờ đó build trên Vercel không phụ thuộc backend.
- Trang chi tiết bài viết dùng `publicGet`: 404 → `notFound()`; lỗi khác → ném lỗi (ISR giữ bản cũ đã cache, không cache trang 404 sai). `generateStaticParams` trả `[]` cùng `revalidate = 300`: không render sẵn lúc build, render khi có người mở rồi cache HTML 5 phút.
  - Giới hạn đã biết: slug **chưa có cache** mà API đang sập → người xem nhận 500 trơn ("Internal Server Error"). Next 16 ném lỗi render ISR thẳng ra ngoài route handler (`app-page-runtime.js` → `base-server.js`), không qua `error.tsx` hay trang lỗi, nên thêm `error.tsx` không giúp được (đã thử bằng `next start`). Muốn có trang thân thiện phải bỏ cơ chế ném lỗi (khi đó bản cache cũ có thể bị thay bằng trang dự phòng lúc API sập): chưa làm, cần chốt lại nếu muốn đổi.
- Gọi từ trình duyệt (form tư vấn, đếm lượt xem) dùng `apiFetch` của đợt A (`NEXT_PUBLIC_API_URL`).
- Ảnh từ API (`cover`, `course.image`, ảnh trong bài): `next/image` với `unoptimized` (backend đã nén webp; không cần `remotePatterns`). Bài không có ảnh bìa → khung nền `bg-mist` với logo Gia Thịnh.

## 3. Liên hệ và chi nhánh

- `GET /public/settings` → `SiteContact`:
  - `hotline` (mặc định `0779 666 664` khi chưa cấu hình), `telHref` = `tel:` + chữ số, `zaloHref` = `https://zalo.me/` + chữ số hotline (`zaloOa` là tên OA, không phải đường dẫn).
  - `contactTimes` từ `consultationContactTimes` (mặc định 4 khung giờ hiện có trong form), `registerNotes` từ `registerNotes` (mặc định 4 dòng hiện có).
- `GET /public/branches` → danh sách văn phòng (`name`, `officeName`, `address`, `mapUrl`, `slug`).
- Header (`StickyHeader`, client) nhận `contact` qua props. Thêm Server Component `SiteHeader` lấy settings rồi render `StickyHeader`; mọi trang thay `<StickyHeader />` bằng `<SiteHeader />`.
- Footer (`SiteFooter`, server) tự lấy settings + branches, chia văn phòng thành 2 cột đều (nửa đầu / nửa sau), không chọn theo chỉ số cứng. Dòng "Thông tin trên trang là dữ liệu mẫu." bỏ đi.
- Trang chủ: khối "Hệ thống văn phòng" liệt kê mọi chi nhánh từ API ở cột phải (link `mapUrl`, không có thì không phải link); iframe bản đồ bên trái giữ nguyên. Khối liên hệ cuối trang dùng `SiteContact`.
- `/tu-van`: thẻ "Hotline & Zalo" và nút Zalo dùng `SiteContact`; "Cơ sở" hiện "`N` điểm tư vấn tại Vĩnh Long" theo số chi nhánh.
- Sidebar `/dien-dan/[slug]`: nút gọi dùng `SiteContact`.
- Xoá `lib/contact.ts` sau khi không còn chỗ dùng.

## 4. Form tư vấn (`/tu-van`)

- Trang `/tu-van` lấy branches, pricing (danh sách gói), settings và đọc `searchParams` (`branch`, `course`) để điền sẵn.
- Trường gửi `POST /public/leads`:

| Ô | Gửi | Ghi chú |
|---|---|---|
| Họ và tên | `name` | bắt buộc |
| Số điện thoại | `phone` | bắt buộc, giữ pattern hiện tại |
| Hạng bằng quan tâm | `courseCode` | danh sách gói duy nhất theo `code` từ pricing (nhãn = `name`) + "Chưa xác định, cần tư vấn" (không gửi trường) |
| Cơ sở thuận tiện | `branch` (slug) | nhãn = `officeName`; mặc định = `?branch=` nếu hợp lệ, không thì chi nhánh đầu |
| Thời gian liên hệ | `preferredContactTime` | từ `SiteContact.contactTimes` |
| Nội dung | `note` | tuỳ chọn |
| Đồng ý | `consent: true` | bắt buộc |
| (ẩn) `website` | `website` | honeypot, ô ẩn khỏi người dùng và trình đọc màn hình, `tabIndex=-1`, `autoComplete="off"` |
| — | `utm` | đọc `utm_source/medium/campaign/term/content` từ URL lúc gửi; không có thì không gửi |

- Thành công (201) → màn "Đã nhận thông tin" ("Tư vấn viên Gia Thịnh sẽ gọi lại cho bạn trong giờ làm việc") + nút gọi hotline/Zalo + "Gửi yêu cầu khác".
- 400 có `details` → lỗi dưới ô tương ứng (`name`, `phone`, `note`, `branch`, `courseCode`); 429 → thông báo "Bạn đã gửi quá nhiều yêu cầu… gọi hotline `…`" kèm hotline; lỗi khác → `errorMessage()` + hotline.
- Nút gửi khoá khi đang gửi; không gửi hai lần.
- Không còn chia sẻ qua `navigator.share`/clipboard.

## 5. Bảng giá, lịch khai giảng, lịch thi (trang chủ)

- **Bảng giá** (`#khoa-hoc`): `GET /public/pricing` (mọi chi nhánh, một lần gọi). Client component `PricingSection`:
  - Thanh tab chọn chi nhánh (`officeName` hoặc `name`), mặc định chi nhánh đầu.
  - Mỗi gói một thẻ (giữ phong cách thẻ hiện tại, nền sáng; `vehicleType` là `car` hoặc `truck` dùng nền `navy`, `moto` nền sáng; nhãn loại xe: `moto` "Xe máy", `car` "Ô tô", `truck` "Ô tô tải"): ảnh (`image` hoặc không có), nhãn loại xe, tên gói, `description`, giá `price` định dạng `1.750.000đ`, `priceNote`, `duration`, danh sách phụ phí (`fees`) và ưu đãi (`discounts`), nút "Tư vấn gói này" → `/tu-van?branch=<slug>&course=<code>`.
  - Định dạng mục phí: `label: amount` / `label: amount–amountMax` + `/unit` nếu có, thêm `(note)`; `amount` null → chỉ `label`.
  - `pricing` null hoặc rỗng → khối dự phòng có hotline.
- **Trước khi đăng ký**: `SiteContact.registerNotes`.
- **Lịch khai giảng** (`#lich-khai-giang`): `GET /public/classes/upcoming` (tối đa 50, hiện 8 lớp đầu). Mỗi dòng: `course.name` + (`transmission`: "số sàn"/"số tự động"), chi nhánh, ngày khai giảng `dd/MM/yyyy`, `scheduleText`, trạng thái: `seatsLeft <= 5` → "Sắp đủ lớp" (badge đỏ), `status === "enrolling"` → "Đang nhận hồ sơ", còn lại "Sắp khai giảng"; dòng phụ "Còn `seatsLeft` chỗ" (0 → "Hết chỗ"). Nút "Giữ chỗ lớp này" → `/tu-van?branch=<slug>&course=<code>`. Rỗng → "Chưa có lớp sắp khai giảng, để lại thông tin để được báo lịch sớm".
- **Lịch thi sắp tới** (mới, ngay sau lịch khai giảng): `GET /public/exams/upcoming`, hiện 8 ca đầu: loại ("Thi tốt nghiệp"/"Thi sát hạch"), `course.name`, chi nhánh, ngày `dd/MM/yyyy`, `location` (nếu có). Rỗng → "Chưa có lịch thi mới".

## 6. Tin tức

- Kiểu hiển thị `NewsPost` (giữ tên, đổi trường): `slug, title, excerpt, category (tên | null), categorySlug (| null), isAnnouncement, date (dd/MM/yyyy), publishedAt (ISO), readTime ("N phút đọc"), image (url | null), imageAlt`. Hàm `toNewsPost(summary)` chuyển từ `PostSummary` của API.
- `NewsCategory = { slug, name, description, isAnnouncement, postCount }` từ `GET /public/categories`.
- `/dien-dan`: server lấy categories + toàn bộ bài (`/public/posts?limit=50&page=1..`, dừng khi đủ `total` hoặc 10 trang = 500 bài) → `NewsExplorer posts categories`. Explorer giữ tìm kiếm không dấu, sắp xếp, lọc; tab chuyên mục lấy từ `categories` (không hiện chuyên mục thông báo trong tab); khối "Thông báo" = bài có `isAnnouncement`. Sắp xếp theo `publishedAt`.
- Trang chủ "Tin tức mới nhất": `/public/posts?limit=4`.
- `/dien-dan/[slug]`: `GET /public/posts/:slug` → tiêu đề, chuyên mục, ngày, thời gian đọc, ảnh bìa, **nội dung Plate** (component `PostContent`), tác giả `authorName`. Bài liên quan: `/public/posts?category=<slug>&limit=5` bỏ bài hiện tại, lấy 4 (không có chuyên mục → 4 bài mới nhất khác). `generateMetadata` dùng cùng dữ liệu (fetch được Next gộp).
- `PostContent` (server): `PlateStatic` với plugin static: đoạn văn, H1–H6, trích dẫn, đường kẻ, đậm/nghiêng/gạch chân/gạch ngang/code/highlight, căn lề (`TextAlign`), danh sách (`List`), liên kết (`Link`), ảnh (`Image` + chú thích `caption`). Node lạ → render con của nó, không làm hỏng trang.
- Xoá dữ liệu mock trong `lib/news.ts` (`newsPosts`, `newsCategories`, `getPost`, `announcementCategorySlug`); giữ các hàm tìm kiếm/tô sáng/sắp xếp/đếm.

### Lượt xem (backend)

- `GET /public/posts/:slug` **không còn tăng `views`** (ISR/metadata gọi nhiều lần sẽ đếm sai).
- Mới: `POST /public/posts/:slug/view` → 204, tăng `views` 1 cho bài đang công khai (404 nếu không có). Giới hạn 30 lần/giờ/IP (`createRateLimiter`). Cập nhật OpenAPI + Postman (`npm run postman`).
- Client component `PostViewTracker` trên trang chi tiết: khi mở, nếu `sessionStorage["gt-viewed:<slug>"]` chưa có → đặt cờ và gọi endpoint (bỏ qua mọi lỗi, không ảnh hưởng giao diện).

## 7. Định dạng

- Tiền: `1750000` → `1.750.000đ` (`Intl.NumberFormat("vi-VN")` + `đ`).
- Ngày: chuỗi ISO có offset `+07:00` từ API → `dd/MM/yyyy` bằng cách cắt `yyyy-mm-dd` (không phụ thuộc múi giờ máy chủ).
- Thời gian đọc: `readTimeMinutes` → `"N phút đọc"` (tối thiểu 1).

## 8. Kiểm thử

- Unit: định dạng (tiền, khoảng phí, ngày, trạng thái lớp, loại thi, số sàn/tự động), `toSiteContact` (mặc định khi thiếu khoá), `toNewsPost`, `publicGet`/`publicGetOrNull` (thành công, 404, 5xx, mạng lỗi, thiếu `API_ORIGIN`), lấy toàn bộ bài theo trang, danh sách gói duy nhất cho form.
- Component: `PricingSection` (đổi tab đổi giá, link tư vấn đúng slug/code), `ConsultationForm` (gửi đúng body gồm slug/courseCode/consent/utm, "Chưa xác định" bỏ `courseCode`, honeypot, lỗi trường, 429, thành công), `PostViewTracker` (gọi một lần mỗi phiên), `NewsExplorer` (lọc chuyên mục động, khối thông báo theo `isAnnouncement`), `PostContent` (đoạn văn, tiêu đề, danh sách, liên kết, ảnh có chú thích, node lạ).
- Backend: test endpoint lượt xem (204, tăng 1, GET không tăng, 404, giới hạn).
- Chạy thật (backend MongoDB trong RAM + seed, `next build && next start` hoặc `next dev`): trang chủ hiện giá/lịch từ seed; đổi giá qua API admin → sau khi hết cache thấy giá mới; gửi form → lead xuất hiện ở `GET /leads`; bài viết tạo qua API admin hiện ở `/dien-dan` và trang chi tiết render nội dung Plate; tắt backend → trang vẫn render khối dự phòng.
- Bắt buộc qua: front-end `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`; backend `npm test`, `npm run typecheck`, `npm run lint`.

## 9. Rủi ro

- Dữ liệu cập nhật trễ tối đa 5 phút do ISR: chấp nhận (đã chốt).
- Hơn 500 bài viết thì `/dien-dan` chỉ hiện 500 bài mới nhất: chấp nhận ở quy mô hiện tại.
- Tìm kiếm tin tức chạy trên trình duyệt với toàn bộ bài: nhẹ ở quy mô hiện tại.
