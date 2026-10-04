import { API_URL } from "@/lib/api/config"
import { networkError, toApiError } from "@/lib/api/errors"
import {
  expireSession,
  getAccessToken,
  refreshSession,
} from "@/lib/api/session"

type QueryValue = string | number | boolean | null | undefined

export type ApiRequest = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: unknown
  query?: Record<string, QueryValue>
  signal?: AbortSignal
}

const NO_REFRESH = new Set(["/auth/login", "/auth/refresh", "/auth/logout"])

export function buildUrl(path: string, query?: ApiRequest["query"]): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "")
      params.append(key, String(value))
  }
  const search = params.toString()
  return `${API_URL}${path}${search ? `?${search}` : ""}`
}

async function send(
  path: string,
  request: ApiRequest,
  token: string | null
): Promise<Response> {
  const headers = new Headers()
  let body: BodyInit | undefined
  if (request.body instanceof FormData) {
    body = request.body
  } else if (request.body !== undefined) {
    headers.set("Content-Type", "application/json")
    body = JSON.stringify(request.body)
  }
  if (token) headers.set("Authorization", `Bearer ${token}`)
  try {
    return await fetch(buildUrl(path, request.query), {
      method: request.method ?? "GET",
      headers,
      body,
      credentials: "include",
      signal: request.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error
    throw networkError()
  }
}

export async function apiFetch<T>(
  path: string,
  request: ApiRequest = {}
): Promise<T> {
  const token = getAccessToken()
  let res = await send(path, request, token)

  if (res.status === 401 && token && !NO_REFRESH.has(path)) {
    const current = getAccessToken()
    // Request khác đã refresh trong lúc chờ: dùng luôn token mới
    const nextToken =
      current && current !== token
        ? current
        : (await refreshSession())?.accessToken
    if (!nextToken) {
      expireSession()
      throw await toApiError(res)
    }
    res = await send(path, request, nextToken)
    if (res.status === 401) {
      expireSession()
      throw await toApiError(res)
    }
  }

  if (!res.ok) throw await toApiError(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export async function apiData<T>(
  path: string,
  request?: ApiRequest
): Promise<T> {
  return (await apiFetch<{ data: T }>(path, request)).data
}
