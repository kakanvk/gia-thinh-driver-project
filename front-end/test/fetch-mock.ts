import { vi } from "vitest"

type Handler = (init: RequestInit) => Response | Promise<Response>

export function jsonResponse(
  status: number,
  body?: unknown,
  headers: Record<string, string> = {}
): Response {
  if (body === undefined) return new Response(null, { status, headers })
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  })
}

export function mockFetch(handlers: Record<string, Handler | Handler[]>) {
  const calls: { key: string; init: RequestInit }[] = []
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), "http://localhost")
    const key = `${init.method ?? "GET"} ${url.pathname.replace(/^\/api\/v1/, "")}`
    calls.push({ key, init })
    const entry = handlers[key]
    const handler = Array.isArray(entry) ? entry.shift() : entry
    if (!handler) throw new Error(`Không có handler cho ${key}`)
    return handler(init)
  })
  vi.stubGlobal("fetch", fn)
  return { fn, calls }
}
