# Đợt M — Media trên GCS, thư viện website, admin bài viết

Ngày: 2026-10-04 · Nhánh: `feat/fe-api-integration` · Code: `back-end/` + `front-end/`

Chen trước đợt C2. Dùng lại phần dùng chung của C1 (`DataTable`, `Pagination`, `FilterBar`/`FilterSelect`, `EntitySheet`, `ConfirmDialog`, `FormField`, `useListParams`, `useCan`, `lib/admin/datetime`, `apiFetch` có FormData).

## 1. Mục tiêu

- Admin upload ảnh và **video** vào kho media (lưu trên **GCS**), sửa mô tả, xoá media không còn dùng.
- Admin quản lý **thư viện website** (ảnh/video, chú thích, thứ tự, ẩn/hiện, ảnh bìa cho video); `/thu-vien` lấy từ API.
- Admin quản lý **bài viết** đầy đủ (danh sách, tạo/sửa với ảnh bìa và ảnh trong nội dung từ kho media, luồng trạng thái, chuyên mục) — bài xuất bản hiện ở `/dien-dan` (đợt B).

Ngoài phạm vi: album/chủ đề thư viện, nén/cắt video, tạo ảnh bìa video tự động, editor diễn đàn `thao-luan`.

## 2. Lưu trữ: GCS bắt buộc

- `STORAGE_DRIVER` mặc định `gcs`. `env.ts`: khi `NODE_ENV !== 'test'` và `STORAGE_DRIVER=local` mà không có `ALLOW_LOCAL_STORAGE=true` → báo lỗi cấu hình ("Media phải lưu trên GCS"). `STORAGE_DRIVER=gcs` bắt buộc `GCS_BUCKET`. Driver local chỉ dùng cho test và chạy thử offline có chủ đích (`ALLOW_LOCAL_STORAGE=true`).
- Interface `StorageDriver` thêm:
  - `createUploadUrl(key, contentType, maxBytes): Promise<{ uploadUrl: string; headers: Record<string,string>; expiresAt: string }>` — GCS: signed URL v4 `action: 'write'`, hết hạn 15 phút, `contentType` cố định, header `x-goog-content-length-range: 0,<maxBytes>`.
  - `stat(key): Promise<{ size: number; contentType: string } | null>`.
  - `move(fromKey, toKey): Promise<{ url: string }>`.
  - Local driver (test/offline): `uploadUrl` trỏ tới route nội bộ `PUT /api/v1/media/direct/:token` (chỉ mount khi driver local), token ký HMAC bằng `JWT_ACCESS_SECRET`, hết hạn 15 phút, kiểm `Content-Type` và kích thước.
- Bucket GCS cần: CORS cho origin admin (`http://localhost:3000`, `https://giathinh.vn`, `https://www.giathinh.vn`), method `PUT`, header `Content-Type`, `x-goog-content-length-range`; lifecycle xoá object prefix `tmp/` sau 1 ngày. README backend ghi file JSON CORS + lệnh `gcloud storage buckets update gs://<bucket> --cors-file=… --lifecycle-file=…`.

## 3. Backend media

- Model `Media` thêm `kind: 'image' | 'video'` (mặc định `image` cho dữ liệu cũ), `duration?: number` (giây, client gửi khi biết), giữ `refs`.
- Ảnh: `POST /media` như cũ (multipart `file`, jpeg/png/webp ≤ 5 MB, sharp → webp ≤ 1920px), `kind: 'image'`.
- Video (upload thẳng):
  1. `POST /media/video-uploads` body `{ filename, contentType: 'video/mp4' | 'video/webm', size (≤ MAX_VIDEO_BYTES = 500 MB, env), alt? }` → tạo key `tmp/<uuid>.<ext>` → trả `{ uploadId (=key mã hoá), uploadUrl, headers, expiresAt }`.
  2. Trình duyệt `PUT uploadUrl` (XHR để có tiến trình) với `headers`.
  3. `POST /media/video-uploads/complete` body `{ uploadId, alt?, width?, height?, duration? }` → `stat` (không có → 400 "Chưa tải xong"; size > giới hạn hoặc contentType khác → xoá object, 400) → `move` sang `<yyyy/MM>/<uuid>.<ext>` → tạo `Media { kind: 'video', mimeType, size, url, … }` → 201.
- `PATCH /media/:id` `{ alt }` (quyền `media.upload`).
- `DELETE /media/:id` (quyền `media.upload`): nếu `refs` không rỗng → 409 `MEDIA_IN_USE` kèm `details` liệt kê nơi dùng (`{ entity: 'post'|'gallery', entityId, label }`); không → xoá object (`storage.delete`) + xoá bản ghi → 204.
- `GET /media` thêm lọc `kind`; trả thêm `kind`, `refsCount`.
- **Refs**: hàm `syncMediaRefs(entity, entityId, mediaIds[])` (bỏ entityId khỏi media cũ, thêm vào media mới). Gọi khi tạo/sửa/xoá bài viết (ảnh bìa `cover.mediaId` + mọi node có `mediaId` trong `content`), khi tạo/sửa/xoá mục thư viện (`mediaId`, `posterMediaId`). Xoá mềm bài viết vẫn giữ refs (khôi phục được); xoá hẳn không có.
- Plate (`plate.ts`): node ảnh `{ type: 'img', url, mediaId?, caption?, width?, align? }` — `mediaId` (nếu có) phải là ObjectId của media `kind: 'image'` tồn tại (kiểm ở service khi lưu bài; sai → 400 chỉ rõ). Vẫn từ chối `data:`.
- Quyền: `media.read` (mọi nhân viên), `media.upload` (branch_manager, editor, super_admin). Thêm quyền `gallery.manage` cho branch_manager, editor (super_admin có `*`).

## 4. Backend thư viện (gallery)

- Collection `GalleryItem`: `mediaId` (bắt buộc), `posterMediaId?` (ảnh, chỉ cho mục video), `caption?` (≤ 300), `order` (số), `visible` (mặc định true), `createdBy`, timestamps.
- Admin `/gallery` (quyền `gallery.manage`): `GET /` (lọc `kind`, `visible`; sắp `order` rồi `createdAt`; kèm `media {id,url,kind,alt,width,height}` và `poster {url,alt}`), `POST /` `{ mediaId, posterMediaId?, caption?, visible? }` (thêm cuối danh sách), `PATCH /:id`, `DELETE /:id` (chỉ xoá mục, không xoá media), `PATCH /reorder` `{ ids[] }`.
- Công khai `GET /public/gallery?kind=` → `{ data: { id, kind, url, alt, caption, width, height, posterUrl }[] }` chỉ mục `visible`, theo thứ tự, tối đa 500.
- Cập nhật OpenAPI + Postman.

## 5. Admin — hộp chọn media (dùng chung)

- `MediaPicker({ open, onOpenChange, kind?: 'image'|'video'|'all', onSelect(media) })` trong Sheet rộng:
  - Tab **Kho media**: lưới ô vuông (ảnh: thumbnail; video: khung có icon + tên/thời lượng), tìm theo mô tả, lọc loại, phân trang 24/trang; chọn → `onSelect`.
  - Tab **Tải lên**: kéo-thả hoặc chọn file; ảnh → `POST /media` (FormData); video → luồng signed URL với **thanh tiến trình** (`XMLHttpRequest.upload.onprogress`), huỷ được; trước khi gửi đọc `duration`, `width`, `height` từ thẻ `video` ẩn (metadata) nếu được; ô mô tả (alt). Kiểm loại/kích thước ở client (ảnh ≤ 5 MB, video ≤ 500 MB) trước khi gửi. Xong → chọn luôn media vừa tải.
  - Thiếu quyền `media.upload` → ẩn tab Tải lên.
- Hàm `uploadVideo(file, { alt, onProgress, signal })` trong `lib/admin/media-upload.ts` (init → PUT → complete); `uploadImage(file, alt)`.

## 6. Admin — trang Thư viện `/admin/thu-vien`

- Menu mới **Thư viện** (nhóm Nội dung, quyền `gallery.manage`).
- Tab **Thư viện website**: danh sách mục theo thứ tự (thumbnail, loại, chú thích, ẩn/hiện); "Thêm vào thư viện" → `MediaPicker` (all) → tạo mục; mỗi mục: sửa chú thích, chọn ảnh bìa (chỉ video, `MediaPicker` image), ẩn/hiện, lên/xuống (gửi `reorder` toàn bộ thứ tự), xoá mục (xác nhận).
- Tab **Kho media**: lưới media có lọc loại/tìm kiếm, mỗi media: xem lớn, sửa mô tả, xoá (409 → hộp thông báo liệt kê nơi đang dùng, có link tới bài viết), số nơi dùng (`refsCount`); nút "Tải lên".

## 7. Admin — bài viết

- Nhãn trạng thái: draft Nháp · pending Chờ duyệt · published Đã xuất bản (publishedAt tương lai → "Hẹn giờ") · archived Lưu trữ.
- **Danh sách** `/admin/bai-viet`: `GET /posts` lọc `q`, `status`, `categoryId`, phân trang 20, sắp `-updatedAt`. Cột: ảnh bìa nhỏ, tiêu đề (+ slug), chuyên mục, trạng thái, tác giả, lượt xem, cập nhật. Bấm hàng → trang sửa. Menu hàng theo trạng thái: Sửa · Xuất bản (draft/pending) · Gỡ xuất bản (published) · Lưu trữ (draft/pending/published) · Khôi phục (archived) · Nhân bản · Xem trên web (published, mở `/dien-dan/<slug>` tab mới) · Xoá (xác nhận). Nút "Viết bài" → `/admin/bai-viet/tao-moi`; nút "Chuyên mục" → sheet quản lý chuyên mục (quyền `category.manage`).
- **Tạo/sửa** `/admin/bai-viet/tao-moi`, `/admin/bai-viet/[id]` (dùng chung `PostEditorForm`):
  - Trường: Tiêu đề* (5–200), Slug (tự gợi ý từ tiêu đề bỏ dấu khi tạo; sửa được), Tóm tắt (≤ 500, để trống → tự tạo), Chuyên mục* (`GET /categories`), Tag (chip, ≤ 20), Ảnh bìa (`MediaPicker` image; xem trước; bỏ chọn), Tác giả (mặc định tên người đăng nhập), SEO tiêu đề (≤ 70) / mô tả (≤ 160), Nội dung* (Plate).
  - Editor: plugin hiện có + chèn ảnh qua `MediaPicker` (image) → node `{ type: 'img', url, mediaId, caption: [] }`; bỏ hoàn toàn chèn base64. Editor phát `onChange(value)`; form giữ giá trị.
  - Nút: **Lưu nháp** (tạo → `POST /posts` rồi chuyển `/admin/bai-viet/<id>`; sửa → `PATCH`), **Xuất bản** (lưu trước rồi `POST /:id/publish`, ô "Hẹn giờ" tuỳ chọn → `publishedAt` +07:00), khi đã xuất bản: **Cập nhật**, **Gỡ xuất bản**, **Xem trên web**. Rời trang khi có thay đổi chưa lưu → hỏi xác nhận (`beforeunload`).
  - Lỗi trường từ backend hiện dưới ô; 409 (sai trạng thái) → toast.
- **Chuyên mục** (sheet): danh sách theo thứ tự (tên, slug, số bài, "Thông báo"), thêm/sửa (tên*, slug, mô tả, Thông báo), xoá (409 còn bài → thông báo), lên/xuống → `PATCH /categories/reorder`.

## 8. Website `/thu-vien`

- Server Component lấy `GET /public/gallery` qua `publicGetOrNull` (ISR 300 s, đợt B). `MediaItem` thêm `alt`, `caption`, `poster?`, `width?`, `height?`. Ảnh `next/image` `unoptimized`; video `<video src preload="metadata" poster>`; lightbox hiện chú thích. Lỗi API → khối "Thư viện đang được cập nhật". Bỏ đọc `public/media`.

## 9. Kiểm thử

- Backend: upload ảnh như cũ; video init (giới hạn size/loại), complete (chưa tải → 400, sai loại/size → 400 và object bị xoá, hợp lệ → 201 `kind: video` và object đã move khỏi `tmp/`); local driver direct PUT (token sai/hết hạn → 403/401); `DELETE /media/:id` khi đang dùng bởi bài viết/thư viện → 409 có details, không dùng → 204 và `storage.delete` được gọi; refs cập nhật khi tạo/sửa bài (đổi ảnh bìa, thêm/bớt ảnh nội dung), mục thư viện; `mediaId` sai trong nội dung → 400; gallery CRUD + reorder + quyền; `/public/gallery` chỉ mục visible theo thứ tự; env: local khi không phải test mà thiếu `ALLOW_LOCAL_STORAGE` → lỗi. Driver GCS test bằng bucket giả (`BucketLike` mở rộng `getSignedUrl`, `getMetadata`, `move`).
- Front-end: `uploadVideo` (init → PUT tiến trình → complete; huỷ), `MediaPicker` (chọn từ kho, upload ảnh, ẩn tab khi thiếu quyền, chặn file quá lớn), trang Thư viện (thêm mục, ẩn/hiện, reorder gửi đúng thứ tự, xoá media 409 hiện nơi dùng), danh sách bài (lọc, menu theo trạng thái), form bài (tạo → lưu nháp → URL sửa; chèn ảnh tạo node có `mediaId`; xuất bản hẹn giờ +07:00; lỗi trường), chuyên mục (thêm, xoá 409), `/thu-vien` (ảnh/video/poster/chú thích, API lỗi).
- Chạy thật: backend MongoDB trong RAM với **`STORAGE_DRIVER=local` + `ALLOW_LOCAL_STORAGE=true`** trong thư mục tạm mới (không dùng GCS/credentials thật của người dùng): upload ảnh, video qua luồng direct (route nội bộ), thêm vào thư viện, `/thu-vien` hiện; viết bài có ảnh bìa + ảnh nội dung, xuất bản, `/dien-dan/<slug>` hiện ảnh; xoá media đang dùng → 409.
- Bắt buộc qua: front-end `npm test`, `typecheck`, `lint`, `build`; backend `npm test`, `typecheck`, `lint`.

## 10. Rủi ro

- Signed URL cần bucket CORS đúng origin; thiếu → trình duyệt báo lỗi CORS khi upload video. README hướng dẫn cấu hình; lỗi upload hiện thông báo "Không tải được lên kho lưu trữ (kiểm tra cấu hình CORS của bucket)".
- Object `tmp/` của lượt upload bỏ dở được lifecycle GCS dọn sau 1 ngày.
- Video không nén: người xem 4G tải chậm với file lớn — chấp nhận (đã chốt).
