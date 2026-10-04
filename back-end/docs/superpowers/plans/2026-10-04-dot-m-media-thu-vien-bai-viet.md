# Đợt M — Media trên GCS, thư viện website, admin bài viết — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kho media (ảnh qua backend, video upload thẳng GCS bằng signed URL), thư viện website do admin quản lý và hiện ở `/thu-vien`, màn admin bài viết đầy đủ với ảnh từ kho media.

**Architecture:** Backend mở rộng `StorageDriver` (signed upload URL, stat, move), media có `kind` + `refs` được đồng bộ từ bài viết và mục thư viện, collection `GalleryItem` + route công khai. Front-end: `MediaPicker` dùng chung (kho + tải lên có tiến trình), trang `/admin/thu-vien`, danh sách/editor bài viết dùng phần dùng chung của C1, `/thu-vien` đọc API (ISR đợt B).

**Tech Stack:** Express 5, Mongoose 8, zod 4, sharp, `@google-cloud/storage` 8, multer; Next.js 16.3, React 19, TanStack Query 5, Plate 53, Base UI/shadcn, Vitest 4 + Testing Library.

**Spec:** `back-end/docs/superpowers/specs/2026-10-04-dot-m-media-thu-vien-bai-viet-design.md`

## Global Constraints

- Backend trong `back-end/`, front-end trong `front-end/`. Front-end theo `AGENT.md`/`AGENTS.md` (component UI đã cài trước; thiếu thì `npx shadcn@latest add`; đọc `node_modules/next/dist/docs/` cho API Next 16; Plate 53: kiểm tên export trong `node_modules`).
- **GCS bắt buộc** ngoài môi trường test: `STORAGE_DRIVER=local` chỉ hợp lệ khi `NODE_ENV=test` hoặc `ALLOW_LOCAL_STORAGE=true`.
- Giới hạn: ảnh 5 MB (jpeg/png/webp → webp ≤ 1920px); video `video/mp4`, `video/webm`, `MAX_VIDEO_BYTES` mặc định `524288000` (500 MB); signed URL hết hạn 15 phút; key tạm `tmp/<uuid>.<ext>`, key chính `<yyyy/MM>/<uuid>.<ext>` (dùng `vnYearMonthPath`).
- Quyền: `media.read` (mọi nhân viên), `media.upload` (upload/sửa/xoá media), `gallery.manage` mới (branch_manager, editor; super_admin `*`), `post.manage`, `category.manage`.
- Nhãn bài viết: Nháp · Chờ duyệt · Đã xuất bản · Hẹn giờ (published + `publishedAt` tương lai) · Lưu trữ.
- Ngày giờ gửi lên `yyyy-MM-ddTHH:mm:00+07:00` (`toVnIso`).
- **Không dùng GCS/credentials thật của người dùng** trong test hay chạy thử: test dùng bucket giả hoặc local driver; chạy thật dùng `STORAGE_DRIVER=local` + `ALLOW_LOCAL_STORAGE=true` trong thư mục tạm mới. Không đọc/sao chép `back-end/secret/`, `.env`, `.env.local`.
- Style front-end: không chấm phẩy, nháy kép, 2 space; backend theo style hiện có (chấm phẩy, nháy đơn). Không prettier cả project, không `git stash`, không đụng server cổng 3000/4000. Commit tiếng Việt kết thúc `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Mỗi task kết thúc: backend `npm test && npm run typecheck && npm run lint` (nếu sửa backend); front-end `npm test && npm run typecheck && npm run lint` (+ `npm run build` khi sửa `app/`/component).

## Review Focus

1. Upload video bỏ dở hoặc gọi complete khi chưa PUT xong → 400 rõ ràng, không tạo media rỗng; object sai loại/kích thước bị xoá (test Task 2).
2. Xoá media đang là ảnh bìa hoặc ảnh trong nội dung bài viết, hoặc đang ở thư viện → 409 liệt kê nơi dùng; đổi ảnh bìa/xoá ảnh khỏi nội dung rồi lưu bài → media cũ xoá được (test Task 2, 3).
3. Editor không còn chèn ảnh base64; bài có ảnh lưu thành công và hiện ở `/dien-dan/<slug>` (test Task 7, chạy thật Task 9).
4. Người không có `media.upload` (vd. tư vấn viên) mở `MediaPicker` → chỉ chọn từ kho, không thấy Tải lên; không có `gallery.manage` → không thấy menu Thư viện (test Task 4, 5).
5. Rời trang sửa bài khi chưa lưu → hỏi xác nhận; bấm Xuất bản khi form có lỗi → không gọi publish (test Task 7).

---

### Task 1: Backend — lưu trữ GCS bắt buộc, signed upload URL, stat, move

**Files:** Modify `back-end/src/config/env.ts`, `back-end/src/shared/storage/{types,gcs,local,index}.ts`, `back-end/.env.example`; Create `back-end/src/modules/media/media.direct.ts` (route PUT nội bộ cho local driver); Tests `back-end/tests/unit/storage.test.ts` (mới hoặc mở rộng file test storage hiện có), `back-end/tests/unit/env.test.ts`.

**Interfaces (Produces):**

```ts
export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<{ url: string }>;
  delete(key: string): Promise<void>;
  createUploadUrl(key: string, contentType: string, maxBytes: number): Promise<{ uploadUrl: string; headers: Record<string, string>; expiresAt: string }>;
  stat(key: string): Promise<{ size: number; contentType: string } | null>;
  move(fromKey: string, toKey: string): Promise<{ url: string }>;
}
```

- GCS: `createUploadUrl` = `bucket.file(key).getSignedUrl({ version: 'v4', action: 'write', expires: Date.now() + 15 * 60_000, contentType, extensionHeaders: { 'x-goog-content-length-range': \`0,${maxBytes}\` } })`, trả `headers: { 'Content-Type': contentType, 'x-goog-content-length-range': \`0,${maxBytes}\` }`; `stat` = `file.getMetadata()` (404 → null) lấy `size` (số) và `contentType`; `move` = `file.move(toKey)` rồi đặt `cacheControl: public, max-age=31536000, immutable` (`setMetadata`) và trả URL công khai như `put`. Mở rộng `BucketLike` cho các hàm dùng tới để test được bằng bucket giả.
- Local: `createUploadUrl` trả `uploadUrl = \`${apiBase}/api/v1/media/direct/${token}\`` với token = base64url(JSON `{ key, contentType, maxBytes, exp }`) + `.` + HMAC-SHA256 (khoá `env.JWT_ACCESS_SECRET`); `headers: { 'Content-Type': contentType }`. `stat` dùng `fs.stat` (contentType lưu kèm file `.meta.json` khi direct PUT ghi, hoặc suy từ đuôi file). `move` = `fs.rename` (tạo thư mục đích).
- Route `PUT /api/v1/media/direct/:token` (chỉ mount khi driver là local, đặt trong `media.routes.ts` trước `authenticate` vì trình duyệt không gửi Bearer khi PUT signed URL): xác thực token (sai chữ ký → 403, hết hạn → 401), kiểm `Content-Type` khớp, đọc body bằng `express.raw({ type: () => true, limit: maxBytes })` (quá → 413), ghi file → 200.
- env: `STORAGE_DRIVER` mặc định `gcs`; thêm `ALLOW_LOCAL_STORAGE` (boolean string), `MAX_VIDEO_BYTES` (số, mặc định 524288000); refine: `STORAGE_DRIVER === 'local' && NODE_ENV !== 'test' && !ALLOW_LOCAL_STORAGE` → lỗi "Media phải lưu trên GCS (đặt STORAGE_DRIVER=gcs, hoặc ALLOW_LOCAL_STORAGE=true khi chạy thử offline)". Test hiện có của backend chạy với `NODE_ENV=test` nên không bị ảnh hưởng — kiểm tra `vitest.config.mts` env, nếu đang đặt `STORAGE_DRIVER` thì giữ nguyên.
- `.env.example`: `STORAGE_DRIVER=gcs`, ghi chú `ALLOW_LOCAL_STORAGE`, `MAX_VIDEO_BYTES`.

- [ ] **Step 1: Tests** — `storage.test.ts`: (a) GCS driver với bucket giả: `createUploadUrl` gọi `getSignedUrl` đúng tham số (v4, write, contentType, extensionHeaders), trả headers; `stat` trả size số/null khi 404; `move` gọi `move` + `setMetadata`, trả URL theo `baseUrl`; khoá không an toàn (`../x`) → throw. (b) Local driver trong thư mục tạm: `createUploadUrl` → PUT qua `request(createApp())` tới path của `uploadUrl` với đúng Content-Type → 200, `stat` thấy size; token sửa 1 ký tự → 403; token hết hạn (giả `Date.now`) → 401; sai Content-Type → 400; vượt maxBytes → 413; `move` chuyển file. `env.test.ts`: `NODE_ENV=development` + `STORAGE_DRIVER=local` không có `ALLOW_LOCAL_STORAGE` → lỗi; có `ALLOW_LOCAL_STORAGE=true` → ok; `gcs` thiếu bucket → lỗi.
- [ ] **Step 2:** chạy → FAIL. **Step 3:** implement. **Step 4:** PASS + full backend checks.
- [ ] **Step 5: Commit** `feat(be): lưu trữ GCS bắt buộc, signed URL upload thẳng, stat/move cho driver`.

---

### Task 2: Backend — media: video upload thẳng, sửa/xoá, refs, ảnh trong bài viết

**Files:** Modify `back-end/src/modules/media/{media.model,media.service,media.controller,media.routes}.ts`, `back-end/src/config/roles.ts`, `back-end/src/modules/posts/{posts.service,plate}.ts`; Create `back-end/src/modules/media/media.refs.ts`; Tests `back-end/tests/integration/media.test.ts` (mở rộng), `back-end/tests/integration/media-refs.test.ts` (mới).

**Interfaces (Produces):**
- `Media` thêm `kind: 'image'|'video'` (default `'image'`), `duration?: number`. JSON trả thêm `kind`, `refsCount` (= `refs.length`) — giữ `refs` trong admin GET chi tiết nếu có.
- `POST /media/video-uploads` (quyền `media.upload`) body `{ filename: string ≤ 200, contentType: 'video/mp4'|'video/webm', size: int > 0 ≤ env.MAX_VIDEO_BYTES, alt?: string ≤ 255 }` → 201 `{ data: { uploadId, uploadUrl, headers, expiresAt, maxBytes } }`; `uploadId` = key `tmp/<uuid>.<mp4|webm>`.
- `POST /media/video-uploads/complete` (quyền `media.upload`) body `{ uploadId (khớp /^tmp\/[0-9a-f-]{36}\.(mp4|webm)$/), alt?, width?: int, height?: int, duration?: number ≥ 0 }` → `stat` null → 400 `UPLOAD_INCOMPLETE` "Video chưa tải lên xong"; size > max hoặc contentType không phải video/mp4|webm → `delete` + 400; ok → `move` sang `<yyyy/MM>/<uuid>.<ext>` → `Media.create({ kind: 'video', key, url, mimeType, size, width?, height?, duration?, alt, uploadedBy })` → 201.
- `PATCH /media/:id` `{ alt: string ≤ 255 | null }` (quyền `media.upload`) → 200 media.
- `DELETE /media/:id` (quyền `media.upload`): `refs.length > 0` → 409 `{ error: { code: 'MEDIA_IN_USE', message: 'Media đang được dùng', details: [{ path: 'refs', message: '<entity>:<entityId>:<label>' }] } }` — đọc `ApiError` hiện có để dùng đúng dạng details; label = tiêu đề bài / chú thích mục thư viện (tra khi trả lỗi). Không dùng → `storage.delete(key)` + `deleteOne` → 204.
- `GET /media` thêm query `kind?`.
- `media.refs.ts`: `syncMediaRefs(entity: 'post'|'gallery', entityId: string, mediaIds: string[]): Promise<void>` — `$pull` `{ entity, entityId }` khỏi media không còn trong danh sách, `$addToSet` vào media trong danh sách (bỏ id trùng/không hợp lệ). `collectPostMediaIds(post): string[]` = `cover.mediaId` + mọi node (đệ quy) có `mediaId`.
- Posts service: sau create/update/duplicate gọi `syncMediaRefs('post', id, collectPostMediaIds(post))`; trước lưu kiểm mọi `mediaId` trong content/cover tồn tại và `kind: 'image'` → nếu không: 400 `details: [{ path: 'body.content' | 'body.cover.mediaId', message: 'Ảnh không tồn tại trong kho media' }]`. Xoá mềm bài **giữ** refs.
- roles: thêm `'gallery.manage'` vào `branch_manager` và `editor`.

- [ ] **Step 1: Tests** — dùng `setStorage(fakeDriver)` (driver giả trong bộ nhớ ghi lại lời gọi) như cách test media hiện có làm. Ca: video init (contentType sai → 400; size > max → 400; editor ok → 201 có uploadUrl; tư vấn viên → 403); complete khi stat null → 400 không tạo media; stat size quá → 400 + delete được gọi; hợp lệ → 201 `kind: 'video'`, `move` từ `tmp/` sang khoá tháng; `PATCH` alt; `GET /media?kind=video`. `media-refs.test.ts`: tạo ảnh A, B; tạo bài cover A + content có ảnh B (mediaId) → A, B có ref post; `DELETE A` → 409 có tiêu đề bài trong details; sửa bài đổi cover sang null và bỏ B khỏi content → refs rỗng → `DELETE A` 204, `storage.delete` gọi đúng key; content có mediaId không tồn tại → 400; mediaId trỏ video → 400; nhân bản bài → bài mới cũng có refs; xoá mềm bài giữ refs (DELETE media vẫn 409).
- [ ] **Step 2–4:** FAIL → implement → PASS + full checks.
- [ ] **Step 5: Commit** `feat(be): upload video thẳng lên kho, sửa/xoá media, theo dõi nơi dùng media trong bài viết`.

---

### Task 3: Backend — thư viện (gallery) + tài liệu

**Files:** Create `back-end/src/modules/gallery/{gallery.model,gallery.service,gallery.controller,gallery.routes,gallery.validation}.ts`; Modify `back-end/src/routes/index.ts`, `back-end/src/modules/public/public.routes.ts`, `back-end/src/docs/openapi.ts`, `back-end/README.md`; regenerate Postman; Test `back-end/tests/integration/gallery.test.ts`.

**Interfaces (Produces):**
- Model `GalleryItem { mediaId (ref Media, bắt buộc), posterMediaId? (ref Media), caption? (≤ 300), order: number, visible: boolean = true, createdBy }`, timestamps; index `{ order: 1 }`.
- Presenter admin: `{ id, mediaId, posterMediaId, caption, order, visible, media: { id, url, kind, alt, width, height, duration }, poster: { url, alt } | null, createdAt, updatedAt }`.
- Routes `/gallery` (`authenticate` + `gallery.manage`): `GET /` (query `kind?`, `visible?: 'true'|'false'`; không phân trang, sắp `order, createdAt`); `POST /` `{ mediaId, posterMediaId?, caption?, visible? }` (media phải tồn tại; `posterMediaId` chỉ khi media là video và poster là ảnh → sai 400; `order` = max + 1); `PATCH /:id` `{ posterMediaId?: id|null, caption?: string|null, visible? }`; `DELETE /:id` → 204; `PATCH /reorder` `{ ids: string[] (≥1, ≤ 500, đủ và không trùng các mục hiện có) }` → gán `order` theo vị trí → 200 danh sách mới.
- Mọi thay đổi gọi `syncMediaRefs('gallery', id, [mediaId, posterMediaId].filter(Boolean))`; xoá mục → `syncMediaRefs('gallery', id, [])`.
- `GET /public/gallery?kind=` → `{ data: { id, kind, url, alt, caption, width, height, posterUrl }[] }` (visible, theo thứ tự, ≤ 500).
- OpenAPI: thêm các route `/gallery*`, `/public/gallery`, `/media/video-uploads*`, `PATCH/DELETE /media/{id}`; `npm run postman`.
- README backend, mục "Lưu ảnh trên Google Cloud Storage": GCS bắt buộc (`ALLOW_LOCAL_STORAGE` chỉ để chạy thử), video upload thẳng (tối đa `MAX_VIDEO_BYTES`), file `cors.json`:

```json
[{ "origin": ["http://localhost:3000", "https://giathinh.vn", "https://www.giathinh.vn"],
   "method": ["PUT"], "responseHeader": ["Content-Type", "x-goog-content-length-range"], "maxAgeSeconds": 3600 }]
```

  và `lifecycle.json` `{ "rule": [{ "action": { "type": "Delete" }, "condition": { "age": 1, "matchesPrefix": ["tmp/"] } }] }`, lệnh `gcloud storage buckets update gs://<bucket> --cors-file=cors.json --lifecycle-file=lifecycle.json`; service account cần quyền tạo signed URL (`roles/iam.serviceAccountTokenCreator` hoặc key JSON có `client_email` + `private_key`).

- [ ] **Step 1: Tests** — quyền (editor ok, tư vấn viên 403); thêm ảnh, thêm video kèm poster ảnh; poster cho mục ảnh → 400; poster là video → 400; reorder đổi thứ tự (thiếu id/trùng → 400); ẩn → không còn ở `/public/gallery`; public đúng thứ tự và shape; xoá media đang trong thư viện → 409; xoá mục → refs gỡ, media xoá được.
- [ ] **Step 2–4:** FAIL → implement → PASS + full checks (gồm `tests/unit/postman.test.ts`).
- [ ] **Step 5: Commit** `feat(be): thư viện website — quản lý mục ảnh/video và API công khai`.

---

### Task 4: Front-end — upload media và `MediaPicker`

**Files:** Create `front-end/lib/admin/media.ts` (types + hooks), `front-end/lib/admin/media-upload.ts`, `front-end/components/admin/media/media-picker.tsx`, `front-end/components/admin/media/media-tile.tsx`; Modify `front-end/lib/admin/types.ts`; Tests `front-end/lib/admin/media-upload.test.ts`, `front-end/components/admin/media/media-picker.test.tsx`.

**Interfaces (Produces):**
- Types: `MediaKind = "image" | "video"`, `MediaItem = { id; kind; url; mimeType; size; width?; height?; duration?; alt?; refsCount; createdAt }`.
- `uploadImage(file: File, alt?: string): Promise<MediaItem>` (FormData `file`, `alt` → `apiData("/media", { method: "POST", body })`).
- `uploadVideo(file: File, opts: { alt?: string; onProgress?: (ratio: number) => void; signal?: AbortSignal; meta?: { width?; height?; duration? } }): Promise<MediaItem>` — `apiData("/media/video-uploads", POST { filename, contentType: file.type, size: file.size, alt })` → `XMLHttpRequest` PUT `uploadUrl` với `headers`, `upload.onprogress` → `onProgress(loaded/total)`, `signal` abort → `xhr.abort()` và reject `DOMException("AbortError")`; status ngoài 2xx hoặc lỗi mạng → reject `Error("Không tải được lên kho lưu trữ (kiểm tra cấu hình CORS của bucket)")` → `apiData("/media/video-uploads/complete", POST { uploadId, alt, ...meta })`.
- `readVideoMeta(file: File): Promise<{ width?; height?; duration? }>` (thẻ `video` ẩn + `loadedmetadata`, timeout 5 s → `{}`; luôn `URL.revokeObjectURL`).
- `validateMediaFile(file: File): string | null` — ảnh (`image/jpeg|png|webp`) ≤ 5 MB, video (`video/mp4|webm`) ≤ 500 MB; trả câu lỗi tiếng Việt.
- `useMediaList(params: { q?: string; kind?: MediaKind; page: number })` — `["media", params]`, `GET /media` limit 24.
- `MediaPicker({ open: boolean; onOpenChange: (o: boolean) => void; kind?: MediaKind | "all"; onSelect: (media: MediaItem) => void; title?: string })` — Sheet rộng (`sm:max-w-3xl`), tab **Kho media** / **Tải lên** (Tabs đã cài); tab Tải lên ẩn khi `!useCan("media.upload")`; chọn xong gọi `onSelect` và đóng; upload thành công invalidate `["media"]` rồi chọn luôn media mới.
- `MediaTile({ media, selected?, onClick? })` — ảnh `next/image` `unoptimized` `object-cover` vuông; video khung tối + icon Play + thời lượng `m:ss`.

- [ ] **Step 1: Tests** — `media-upload.test.ts`: (a) `uploadVideo` gọi init đúng body, PUT tới `uploadUrl` với headers (mock `XMLHttpRequest` bằng lớp giả có `upload.onprogress`, `open`, `setRequestHeader`, `send`, `abort`), gọi `onProgress(0.5)` rồi complete với `uploadId` → trả media; (b) PUT trả 403 → reject có chữ "CORS"; (c) abort giữa chừng → reject AbortError, không gọi complete; (d) `validateMediaFile` ảnh 6 MB / pdf / video 600 MB → lỗi, hợp lệ → null. `media-picker.test.tsx`: kho hiện tile từ `GET /media` (đúng `kind`, `limit=24`), chọn → `onSelect` + đóng; tìm "san" → query `q=san`; không có `media.upload` → không có tab "Tải lên"; có quyền: chọn file ảnh → `POST /media` FormData → `onSelect` với media mới; file quá lớn → báo lỗi, không gọi API.
- [ ] **Step 2–4:** FAIL → implement → PASS + checks.
- [ ] **Step 5: Commit** `feat(fe): tải ảnh/video lên kho media (video thẳng lên GCS) và hộp chọn media dùng chung`.

---

### Task 5: Front-end — trang admin Thư viện `/admin/thu-vien`

**Files:** Create `front-end/app/admin/(panel)/thu-vien/page.tsx`, `front-end/components/admin/gallery/{gallery-manager,media-library}.tsx`; Modify `front-end/lib/auth/routes.ts`, `front-end/components/admin/admin-shell.tsx`, `front-end/lib/auth/auth.test.ts`; Test `front-end/components/admin/gallery/gallery.test.tsx`.

**Interfaces:** route `{ href: "/admin/thu-vien", permission: "gallery.manage" }` đặt trước `/admin/bai-viet` trong `ADMIN_ROUTES`; menu "Thư viện" (icon `Images`) nhóm "Nội dung". `GalleryManager()`, `MediaLibrary()`.

- [ ] **Step 1: Tests** — `GalleryManager`: `GET /gallery` hiện mục theo thứ tự (thumbnail, nhãn Ảnh/Video, chú thích, "Đang ẩn"); "Thêm vào thư viện" → MediaPicker (mock module `@/components/admin/media/media-picker` thành nút chọn giả) → `POST /gallery { mediaId }`; nút xuống ở mục 1 → `PATCH /gallery/reorder { ids: [m2, m1, m3] }`; ẩn → `PATCH /gallery/:id { visible: false }`; sửa chú thích (sheet) → `PATCH { caption }`; chọn ảnh bìa (chỉ hiện với video) → `PATCH { posterMediaId }`; xoá mục (xác nhận) → `DELETE`. `MediaLibrary`: lưới từ `GET /media`; sửa mô tả → `PATCH /media/:id { alt }`; xoá → 409 `MEDIA_IN_USE` → hộp thông báo liệt kê nơi dùng; xoá 204 → toast + invalidate. Menu: editor thấy "Thư viện"; tư vấn viên không; `canAccess("/admin/thu-vien", ["post.manage"])` false, `["gallery.manage"]` true.
- [ ] **Step 2–4:** FAIL → implement (Tabs: "Thư viện website" / "Kho media"; page `metadata = { title: "Thư viện" }`) → PASS + build.
- [ ] **Step 5: Commit** `feat(fe): trang admin thư viện — mục hiển thị trên web và kho media`.

---

### Task 6: Front-end — danh sách bài viết + chuyên mục

**Files:** Create `front-end/components/admin/posts/{post-list,post-row-actions,category-sheet}.tsx`, `front-end/lib/admin/posts.ts` (types, labels, hooks); Rewrite `front-end/app/admin/(panel)/bai-viet/page.tsx`; Modify `front-end/components/admin/admin-ui.tsx` (`StatusPill` tone cho Nháp/Chờ duyệt/Đã xuất bản/Hẹn giờ/Lưu trữ); Remove `adminPosts` khỏi `lib/admin-data.ts` nếu không còn dùng; Test `front-end/components/admin/posts/post-list.test.tsx`.

**Interfaces (Produces):** `AdminPost = { id; title; slug; excerpt; cover: { url; alt; mediaId? } | null; categoryId; tags: string[]; authorName; status: "draft"|"pending"|"published"|"archived"; publishedAt: string | null; views; seo: { title?; description? } | null; content?: unknown[]; createdAt; updatedAt }` (đối chiếu backend presenter); `Category = { id; name; slug; description: string | null; isAnnouncement: boolean; order: number; postCount?: number }`; `postStatusLabel(post, now?)` ("Hẹn giờ" khi published + publishedAt > now); `useCategories()` (`["lookup","categories"]`, staleTime 10 phút); `PostRowActions({ post })`; `CategorySheet({ open, onOpenChange })`.

- [ ] **Step 1: Tests** — danh sách gọi `GET /posts?page=1&limit=20&sort=-updatedAt` + lọc `status`, `categoryId`, `q` từ URL; hiện tên chuyên mục, nhãn "Hẹn giờ" khi publishedAt tương lai; bấm hàng → `router.push("/admin/bai-viet/<id>")`; menu hàng: draft có "Xuất bản" (→ `POST /posts/:id/publish` không body), không có "Khôi phục"; published có "Gỡ xuất bản", "Xem trên web" (href `/dien-dan/<slug>`, `target=_blank`); archived có "Khôi phục"; "Nhân bản" → `POST /:id/duplicate` → toast + push tới bài mới; "Xoá" xác nhận → `DELETE`; 409 → toast. `CategorySheet`: danh sách theo `order`; thêm `{ name, slug?, description?, isAnnouncement }` → `POST /categories`; xoá 409 → thông báo "Chuyên mục còn bài viết"; xuống → `PATCH /categories/reorder { ids }`; nút "Chuyên mục" ẩn khi thiếu `category.manage`.
- [ ] **Step 2–4:** FAIL → implement → PASS + build.
- [ ] **Step 5: Commit** `feat(fe): danh sách bài viết với thao tác trạng thái và quản lý chuyên mục`.

---

### Task 7: Front-end — tạo/sửa bài viết với ảnh từ kho media

**Files:** Create `front-end/components/admin/posts/post-editor-form.tsx`, `front-end/app/admin/(panel)/bai-viet/[id]/page.tsx`; Rewrite `front-end/app/admin/(panel)/bai-viet/tao-moi/page.tsx`; Modify `front-end/components/admin/admin-post-editor.tsx` (giá trị có kiểm soát + chèn ảnh qua MediaPicker), `front-end/components/post-image-element.tsx` (alt từ caption, không base64); Delete `front-end/components/admin/post-create-form.tsx`; Test `front-end/components/admin/posts/post-editor.test.tsx`.

**Interfaces:**
- `AdminPostEditor({ value: Value; onChange: (value: Value) => void; invalid?: boolean })` — nút "Chèn ảnh" mở `MediaPicker` (image) → chèn `{ type: KEYS.img, url: media.url, mediaId: media.id, caption: [{ text: "" }], children: [{ text: "" }] }` + đoạn văn trống; không còn `FileReader`/`readAsDataURL`.
- `PostEditorForm({ postId?: string })`; hàm thuần `slugify(text)` (bỏ dấu tiếng Việt, đ → d, ký tự khác → `-`, gộp `-`, cắt 200) trong `lib/admin/posts.ts`; `buildPostBody(state)` (bỏ trường rỗng tuỳ chọn, `cover: { url, alt, mediaId } | null`, `seo` null khi cả hai trống).

- [ ] **Step 1: Tests** — `slugify("Đăng ký học lái xe B2 — 2026!") === "dang-ky-hoc-lai-xe-b2-2026"`; tạo mới: nhập tiêu đề → slug gợi ý tự điền (ngừng tự điền khi người dùng sửa slug); thiếu chuyên mục/tiêu đề < 5 → lỗi tại ô, không gọi API; Lưu nháp → `POST /posts` body có `title, slug, categoryId, content, tags, cover` → `router.replace("/admin/bai-viet/<id>")`; chọn ảnh bìa (MediaPicker mock) → body `cover: { url, alt, mediaId }`; chèn ảnh trong editor (render `AdminPostEditor` với MediaPicker mock, bấm "Chèn ảnh") → `onChange` nhận node `img` có `mediaId`, không có `data:`; sửa bài: `GET /posts/p1` điền form; "Xuất bản" + hẹn giờ `2026-10-21T08:30` → `PATCH /posts/p1` rồi `POST /posts/p1/publish { publishedAt: "2026-10-21T08:30:00+07:00" }`; bài published → nút "Cập nhật", "Gỡ xuất bản", link "Xem trên web"; lỗi 400 `details body.slug` → lỗi dưới ô Slug; có thay đổi chưa lưu → `beforeunload` được chặn (`event.preventDefault` gọi); sau lưu thì không chặn.
- [ ] **Step 2–4:** FAIL → implement → PASS + build. Trang `[id]/page.tsx`: params `Promise<{ id: string }>`; `metadata = { title: "Sửa bài viết" }`; `tao-moi`: `metadata = { title: "Viết bài mới" }`.
- [ ] **Step 5: Commit** `feat(fe): tạo và sửa bài viết với ảnh bìa, ảnh nội dung từ kho media, xuất bản hẹn giờ`.

---

### Task 8: Front-end — `/thu-vien` lấy từ API

**Files:** Modify `front-end/app/thu-vien/page.tsx`, `front-end/components/media-gallery.tsx`, `front-end/lib/api/public.ts` (`getGallery()`), `front-end/lib/public/types.ts` (`PublicGalleryItem`); Test `front-end/components/media-gallery.test.tsx`.

- `getGallery = () => publicGetOrNull<PublicGalleryItem[]>("/gallery")`; trang: `export const revalidate = 300`; map sang `MediaItem = { src, kind, alt, caption?, poster?, width?, height? }`; null → khối "Thư viện đang được cập nhật, vui lòng quay lại sau."; rỗng → "Chưa có ảnh hoặc video."; bỏ `readdirSync`/`node:fs`.
- `MediaGallery`: ảnh `next/image` `unoptimized` dùng `alt`; video `poster`; lightbox hiện `caption`; giữ tab, phím tắt, khoá cuộn.

- [ ] **Step 1: Tests** — đếm tab Ảnh/Video đúng; ảnh có alt; video có `poster`; mở lightbox hiện chú thích; `getGallery` trả null → trang hiện khối dự phòng (test page bằng cách render component trang async: `render(await MediaPage())` với `fetch` giả).
- [ ] **Step 2–4:** FAIL → implement → PASS + build (không có backend vẫn build được).
- [ ] **Step 5: Commit** `feat(fe): trang thư viện lấy ảnh/video từ API`.

---

### Task 9: Tài liệu và chạy thật

**Files:** Modify `front-end/README.md` (mục quản trị: Thư viện, Bài viết, MediaPicker, giới hạn upload, CORS bucket), `back-end/README.md` (đã có ở Task 3, bổ sung nếu thiếu).

- [ ] **Step 1: Tài liệu** — 4–6 dòng mỗi README như mô tả.
- [ ] **Step 2: Chạy thật** — thư mục tạm **mới** dưới `/private/tmp`, `process.chdir` vào đó trước khi import backend; env tường minh: `NODE_ENV=development`, `STORAGE_DRIVER=local`, `ALLOW_LOCAL_STORAGE=true`, `UPLOAD_DIR=<tmp>/uploads`, `PUBLIC_MEDIA_BASE_URL=http://localhost:4100/uploads`, `MONGODB_URL` MongoDB trong RAM, `JWT_ACCESS_SECRET` ≥ 32 ký tự, `CORS_ORIGINS=http://localhost:3100`, `PORT=4100`; seed admin `admin`/`0901234567`/`Matkhau123`. Front-end `next build && next start -p 3100` với `API_ORIGIN=http://localhost:4100` (không đụng 3000/4000). Script Node (fetch, token admin), ghi kết quả:
  1. Upload ảnh (file PNG nhỏ tạo bằng sharp) → media `kind: image`.
  2. Video: tạo file mp4 nhỏ hợp lệ (vd. vài KB lấy từ dữ liệu mẫu nhị phân hoặc bất kỳ bytes với Content-Type `video/mp4` — backend chỉ kiểm Content-Type/size), init → PUT `uploadUrl` → complete → media `kind: video`; complete lần hai cùng uploadId → 400.
  3. `POST /gallery` ảnh + video (poster = ảnh) → `GET http://localhost:3100/thu-vien` HTML có URL ảnh/video (sau build mới hoặc chờ ISR: tạo dữ liệu **trước** khi `next build`).
  4. Tạo bài có `cover.mediaId` = ảnh và content có node `img` mediaId → publish → `GET http://localhost:3100/dien-dan/<slug>` HTML có URL ảnh.
  5. `DELETE /media/<ảnh>` → 409 `MEDIA_IN_USE`.
  6. `GET /admin/thu-vien`, `/admin/bai-viet`, `/admin/bai-viet/tao-moi` → 200.
  Dừng server, xoá thư mục tạm.
- [ ] **Step 3: Kiểm tra cuối** — front-end `npm test && npm run typecheck && npm run lint && npm run build`; backend `npm test && npm run typecheck && npm run lint`.
- [ ] **Step 4: Commit** `docs: hướng dẫn kho media, thư viện và bài viết`.
