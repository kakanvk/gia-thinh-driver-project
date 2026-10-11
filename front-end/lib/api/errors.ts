export type ErrorDetail = { path: string; message: string }

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: ErrorDetail[] = [],
    public retryAfterSec?: number
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export function networkError(): ApiError {
  return new ApiError(0, "NETWORK_ERROR", "Không kết nối được máy chủ")
}

export function parseRetryAfter(headers: Headers): number | undefined {
  const reset = headers.get("ratelimit")?.match(/reset=(\d+)/)
  if (reset) return Number(reset[1])
  const retryAfter = headers.get("retry-after")
  if (retryAfter && /^\d+$/.test(retryAfter)) return Number(retryAfter)
  return undefined
}

type ErrorBody = {
  error?: { code?: string; message?: string; details?: ErrorDetail[] }
}

export async function toApiError(res: Response): Promise<ApiError> {
  let body: ErrorBody | undefined
  try {
    body = (await res.json()) as ErrorBody
  } catch {
    body = undefined
  }
  const error = body?.error
  return new ApiError(
    res.status,
    error?.code ?? (res.status >= 500 ? "SERVER_ERROR" : "HTTP_ERROR"),
    error?.message ?? `Lỗi ${res.status}`,
    error?.details ?? [],
    res.status === 429 ? parseRetryAfter(res.headers) : undefined
  )
}

export function fieldErrors(
  details: ErrorDetail[] | undefined
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const detail of details ?? []) {
    const key = detail.path.replace(/^(body|query|params)\./, "")
    if (!(key in result)) result[key] = detail.message
  }
  return result
}

export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return "Đã có lỗi xảy ra, vui lòng thử lại"
  if (error.status === 403) return "Bạn không có quyền thực hiện thao tác này"
  if (error.status === 429) {
    const minutes = Math.max(1, Math.ceil((error.retryAfterSec ?? 60) / 60))
    return `Thao tác quá nhiều lần, thử lại sau ${minutes} phút`
  }
  if (error.status === 0 || error.status >= 500) {
    return "Không kết nối được máy chủ, vui lòng thử lại"
  }
  return error.message
}
