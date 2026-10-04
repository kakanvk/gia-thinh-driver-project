# Gia Thịnh — Front-end

Website và trang quản trị Trường lái Gia Thịnh (Next.js 16). Quy ước dự án: `AGENT.md`.

## Chạy ở máy dev

1. Chạy backend (`../back-end`, xem README ở đó) tại `http://localhost:4000`.
2. Cấu hình và chạy front-end:

   ```bash
   cp .env.example .env.local   # NEXT_PUBLIC_API_URL=/api/v1, API_ORIGIN=http://localhost:4000
   npm install
   npm run dev                  # http://localhost:3000
   ```

3. Đăng nhập quản trị: http://localhost:3000/admin/dang-nhap bằng tài khoản `SEED_ADMIN_*` của backend.

## Địa chỉ API

| Môi trường | `NEXT_PUBLIC_API_URL` | `API_ORIGIN` |
|---|---|---|
| Dev | `/api/v1` | `http://localhost:4000` |
| Preview Vercel (`*.vercel.app`) | `/api/v1` | `https://api.giathinh.vn` |
| Production (`giathinh.vn`) | `https://api.giathinh.vn/api/v1` | không cần |

- Đường dẫn tương đối: Next.js chuyển tiếp `/api/v1/*` và `/uploads/*` tới `API_ORIGIN` (bắt buộc cho preview vì `vercel.app` khác site với `api.giathinh.vn`, cookie đăng nhập sẽ không được gửi).
- Đường dẫn tuyệt đối: trình duyệt gọi thẳng; backend phải có `CORS_ORIGINS` chứa domain front-end.
- Cả hai biến được đọc lúc build: đổi giá trị thì build/deploy lại.

## Đăng nhập quản trị

- Access token chỉ giữ trong bộ nhớ; cookie `gt_refresh` (httpOnly) giữ phiên. Mở `/admin` sẽ tự cấp lại token; hết phiên thì về `/admin/dang-nhap`.
- Menu và trang hiện theo quyền của vai trò (`lib/auth/routes.ts`). Backend vẫn kiểm quyền cho mọi API.
- Quên mật khẩu: quản trị viên cấp mật khẩu tạm ở màn Người dùng; nhân viên đổi lại ở `/admin/tai-khoan`.

## Lệnh

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Chạy dev |
| `npm test` | Test (Vitest + Testing Library) |
| `npm run typecheck` / `npm run lint` | Kiểm tra kiểu / lint |
| `npm run build` && `npm start` | Build và chạy bản production |
