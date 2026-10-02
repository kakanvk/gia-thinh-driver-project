# Context dự án Gia Thịnh

## Tổng quan

Đây là website tiếng Việt của Trường lái Gia Thịnh, phục vụ các nhu cầu:

- Giới thiệu trung tâm, khóa học và học phí.
- Cung cấp thông tin tuyển sinh, tin tức và tư vấn.
- Hiển thị thư viện hình ảnh/video và thông tin sân tập.
- Cung cấp diễn đàn học viên và trình soạn bài viết phía client.

Đối tượng chính là người đang tìm hiểu hoặc đăng ký học bằng lái xe máy và ô tô tại Vĩnh Long. Nội dung liên quan đến học phí, lịch học, địa chỉ, số điện thoại và quy định thi phải được xem là dữ liệu nghiệp vụ cần độ chính xác cao.

## Phạm vi làm việc

- Thư mục ứng dụng: `front-end/`.
- Mã nguồn chính nằm trong `app/`, `components/`, `lib/` và `public/`.
- Không sửa trực tiếp các thư mục/file sinh tự động hoặc artifact: `.next/`, `node_modules/`, `cpanel-deploy/`, `cpanel-deploy.tar.gz`, `*.tsbuildinfo` và `next-env.d.ts`.
- `AGENTS.md` chứa block quy tắc do Next.js tự sinh. Không xóa block đó; `next dev` có thể tạo lại nội dung.

## Công nghệ

- Next.js 16 App Router.
- React 19 và TypeScript ở chế độ `strict`.
- Tailwind CSS 4, PostCSS và CSS variables trong `app/globals.css`.
- shadcn/ui theo style `base-nova`; primitive từ Base UI và Radix UI.
- Plate.js cho trình soạn thảo nội dung.
- Motion cho animation, Lucide cho icon và Three.js cho trải nghiệm sân tập.
- Node.js tối thiểu `20.9.0`; package manager hiện tại là npm.

Next.js 16 có các API khác với phiên bản cũ. Trước khi dùng hoặc thay đổi API framework, đọc tài liệu tương ứng trong `node_modules/next/dist/docs/` và tuân thủ cảnh báo deprecation. Ví dụ hiện tại: `params` của dynamic route được xử lý dưới dạng `Promise`.

## Cấu trúc chính

- `app/layout.tsx`: root layout, metadata, font và provider toàn cục.
- `app/page.tsx`: trang chủ, khóa học, học phí và thông tin tuyển sinh.
- `app/dien-dan/`: danh sách và chi tiết tin tức (URL `/dien-dan`).
- `app/thao-luan/`: danh sách, chi tiết và trang đăng bài diễn đàn (URL `/thao-luan`).
- `app/tu-van/`: trang tư vấn.
- `app/thu-vien/`: thư viện truyền thông.
- `app/san-tap/`: trải nghiệm sân tập; có hành vi layout riêng trong `globals.css`.
- `components/ui/`: component nền tảng từ shadcn và Plate; ưu tiên tái sử dụng thay vì tạo bản sao.
- `components/editor/`: cấu hình/plugin của Plate editor.
- `components/san-tap/`: component riêng của trải nghiệm sân tập.
- `lib/contact.ts`: dữ liệu liên hệ và chi nhánh.
- `lib/news.ts`: dữ liệu và hàm truy xuất tin tức.
- `lib/forum.ts`: dữ liệu diễn đàn mẫu.
- `lib/forum-store.ts`: lưu bài viết người dùng bằng `localStorage`.
- `lib/suggestion.ts`, `lib/tiktok.ts`: dữ liệu nội dung tương ứng.
- `lib/utils.ts`: utility dùng chung, gồm hàm ghép class `cn`.
- `public/`: ảnh, video và tài nguyên tĩnh.
- `scripts/build-cpanel.mjs`: đóng gói bản standalone để triển khai cPanel bằng Docker.

## Quy ước kiến trúc

- Mặc định dùng Server Component. Chỉ thêm `"use client"` khi component cần state, effect, event handler hoặc browser API.
- Cô lập truy cập `window`, `document`, `localStorage` và API trình duyệt trong Client Component hoặc guard bằng kiểm tra môi trường.
- Đặt route theo App Router trong `app/`; dùng `generateMetadata` cho trang cần metadata động.
- Với dynamic route dựa trên dữ liệu tĩnh, duy trì `generateStaticParams` khi phù hợp.
- Dữ liệu nội dung dùng chung đặt trong `lib/`, không sao chép cùng dữ liệu vào nhiều page/component.
- Dùng alias `@/` cho import nội bộ.
- Dùng `next/link`, `next/image` và `next/font` thay cho giải pháp HTML/CSS thủ công khi phù hợp.
- Giữ thay đổi nhỏ, đúng phạm vi; không refactor file không liên quan.

## Quy ước code

- Viết TypeScript rõ kiểu; tránh `any`, ép kiểu không cần thiết và bỏ qua lỗi type.
- Component React dùng PascalCase; hàm, biến và file utility dùng camelCase/kebab-case theo pattern hiện có.
- Prettier là nguồn chuẩn định dạng: 2 spaces, không semicolon, double quotes, trailing comma ES5, độ rộng 80 ký tự.
- Dùng `cn()` để ghép class có điều kiện và để plugin Prettier sắp xếp class Tailwind.
- Ưu tiên composition và variant hiện có (`buttonVariants`, `Badge`, v.v.) thay vì lặp lại style.
- Không thêm dependency nếu API nền tảng hoặc dependency hiện có đã giải quyết được vấn đề.
- Comment chỉ giải thích quyết định hoặc ràng buộc khó thấy; không mô tả lại code.

## UI và nội dung

- Ngôn ngữ giao diện mặc định là tiếng Việt; dùng câu chữ ngắn gọn, tự nhiên và nhất quán.
- Tôn trọng design token trong `app/globals.css`: `background`, `foreground`, `primary`, `navy`, `mist`, `signal`, `success`, v.v. Không rải màu hex mới trong component nếu không có lý do rõ ràng.
- Font chính là Be Vietnam Pro; font mono là Geist Mono; font viết tay là Oooh Baby.
- Theme hiện bị khóa ở light mode trong `app/layout.tsx`; không giả định dark mode đang được bật chỉ vì token `.dark` tồn tại.
- Thiết kế mobile-first và kiểm tra ít nhất các mốc mobile, tablet và desktop.
- Duy trì layout container hiện có: thường là `max-w-7xl`, `px-5`, `sm:px-8`.
- Icon trang trí phải có `aria-hidden="true"`; ảnh nội dung phải có `alt` mô tả đúng ngữ cảnh.
- Form phải có label, trạng thái lỗi rõ ràng và vùng bấm đủ lớn.
- Không làm mất focus ring, keyboard navigation hoặc hỗ trợ `prefers-reduced-motion`.
- Không thay đổi học phí, lịch khai giảng, hotline, địa chỉ hoặc thông tin pháp lý nếu chưa có nguồn xác nhận từ người dùng.

## Dữ liệu và giới hạn hiện tại

- Dự án chưa có backend/CMS trong mã nguồn hiện tại; phần lớn nội dung là dữ liệu tĩnh trong `lib/` hoặc page.
- Bài viết diễn đàn do người dùng tạo được lưu trong `localStorage` với key `gia-thinh-user-threads`; dữ liệu không đồng bộ giữa thiết bị và có thể bị xóa bởi trình duyệt.
- Khi thay đổi schema dữ liệu lưu local, phải cân nhắc tương thích dữ liệu cũ hoặc thêm migration/fallback.
- Chưa có test runner trong `package.json`; không tuyên bố test đã chạy nếu chỉ chạy lint/typecheck/build.

## Lệnh phát triển và kiểm tra

Chạy các lệnh từ thư mục `front-end/`:

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run build
npm run format
```

Thứ tự kiểm tra tối thiểu sau khi sửa code:

1. Chạy `npm run lint`.
2. Chạy `npm run typecheck`.
3. Chạy `npm run build` nếu thay đổi route, cấu hình Next.js, dependency hoặc logic render.
4. Kiểm tra thủ công luồng UI liên quan ở kích thước mobile và desktop khi có thay đổi giao diện.

`npm run format` ghi lại toàn bộ file `*.ts` và `*.tsx`; chỉ chạy khi chấp nhận các thay đổi định dạng phát sinh. Không dùng format để che lỗi lint/type.

## Triển khai

- `next.config.ts` dùng `output: "standalone"`.
- `npm run build:cpanel` cần Docker và `tar`; lệnh sẽ xóa rồi tạo lại `cpanel-deploy/` và `cpanel-deploy.tar.gz`.
- Không commit artifact build hoặc file môi trường/chứa secret.
- Khi thêm ảnh remote cho `next/image`, cập nhật `images.remotePatterns` một cách giới hạn; không mở wildcard hostname không cần thiết.

## Checklist hoàn thành

- Thay đổi giải quyết đúng yêu cầu và không làm hỏng route khác.
- TypeScript không có lỗi mới; lint không có lỗi mới.
- Không đưa secret, dữ liệu cá nhân hoặc artifact build vào repository.
- Nội dung nghiệp vụ quan trọng đã được xác nhận.
- UI có semantic HTML, keyboard/focus state, alt text và reduced-motion phù hợp.
- Các trạng thái loading, empty, error và disabled được xử lý nếu tính năng có các trạng thái đó.
- Báo cáo rõ lệnh đã chạy và mọi giới hạn chưa thể kiểm tra.
