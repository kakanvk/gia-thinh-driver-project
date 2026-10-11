import type { NextConfig } from "next"

// Đích chuyển tiếp /api/v1/* và /uploads/* (dev, preview). Production gọi thẳng NEXT_PUBLIC_API_URL.
const apiOrigin = process.env.API_ORIGIN?.replace(/\/+$/, "")

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
  async rewrites() {
    if (!apiOrigin) return []
    return [
      { source: "/api/v1/:path*", destination: `${apiOrigin}/api/v1/:path*` },
      { source: "/uploads/:path*", destination: `${apiOrigin}/uploads/:path*` },
    ]
  },
}

export default nextConfig
