// Kênh TikTok của trung tâm.
//
// Cách thêm video (không cần API hay OAuth):
// 1. Mở app TikTok → video cần đăng → Chia sẻ → Sao chép liên kết.
// 2. Dán link vào mảng TIKTOK_VIDEOS bên dưới (tối đa 3 video đẹp nhất).
// 3. Trang web tự render trình phát embed chính thức của TikTok.
//
// Ví dụ link: https://www.tiktok.com/@ttdtlxgiathinhvinhlong/video/7123456789012345678
// → id là dãy số cuối: "7123456789012345678"

export const TIKTOK_PROFILE_URL =
  "https://www.tiktok.com/@ttdtlxgiathinhvinhlong"

export const TIKTOK_HANDLE = "@ttdtlxgiathinhvinhlong"

export type TikTokVideo = {
  id: string
  url: string
}

export const TIKTOK_VIDEOS: TikTokVideo[] = [
  // { id: "7123456789012345678", url: "https://www.tiktok.com/@ttdtlxgiathinhvinhlong/video/7123456789012345678" },
]
