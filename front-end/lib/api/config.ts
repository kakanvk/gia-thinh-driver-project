export function resolveApiUrl(value: string | undefined): string {
  return (value || "/api/v1").replace(/\/+$/, "")
}

// NEXT_PUBLIC_* được Next.js thay giá trị lúc build
export const API_URL = resolveApiUrl(process.env.NEXT_PUBLIC_API_URL)
