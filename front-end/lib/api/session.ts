import { API_URL } from "@/lib/api/config"
import { networkError, toApiError } from "@/lib/api/errors"
import type { SessionUser } from "@/lib/auth/user"

export type RefreshResult = { accessToken: string; user: SessionUser }

// Access token chỉ nằm trong bộ nhớ; refresh token là cookie httpOnly gt_refresh.
let accessToken: string | null = null
let inflight: Promise<RefreshResult | null> | null = null
const expiredListeners = new Set<() => void>()

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function onSessionExpired(listener: () => void): () => void {
  expiredListeners.add(listener)
  return () => {
    expiredListeners.delete(listener)
  }
}

export function expireSession(): void {
  accessToken = null
  for (const listener of expiredListeners) listener()
}

async function requestRefresh(): Promise<RefreshResult | null> {
  let res: Response
  try {
    res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
  } catch {
    throw networkError()
  }
  if (res.status >= 500) throw await toApiError(res)
  if (!res.ok) {
    accessToken = null
    return null
  }
  const body = (await res.json()) as { data: RefreshResult }
  accessToken = body.data.accessToken
  return body.data
}

// Refresh xoay vòng token: một tab chỉ refresh một lần cho mọi request đang chờ,
// và các tab xếp hàng qua Web Locks để không gửi cùng một refresh token.
export function refreshSession(): Promise<RefreshResult | null> {
  if (!inflight) {
    const locks = typeof navigator === "undefined" ? undefined : navigator.locks
    // lib.dom gõ kiểu locks.request là Promise<Promise<T>>; .then làm phẳng về Promise<T>
    const run: Promise<RefreshResult | null> = locks
      ? locks.request("gt-refresh", requestRefresh).then((result) => result)
      : requestRefresh()
    inflight = run.finally(() => {
      inflight = null
    })
  }
  return inflight
}
