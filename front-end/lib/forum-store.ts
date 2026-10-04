export type UserThread = {
  slug: string
  board: string
  title: string
  author: string
  time: string
  likes: number
  content: string[]
  images?: string[]
  replies: []
}

const KEY = "gia-thinh-user-threads"

export function loadUserThreads(): UserThread[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as UserThread[]) : []
  } catch {
    return []
  }
}

const EMPTY: UserThread[] = []
let cachedRaw: string | null = null
let cachedThreads: UserThread[] = EMPTY

/** Snapshot ổn định cho useSyncExternalStore: chỉ parse lại khi chuỗi trong localStorage đổi. */
export function getUserThreadsSnapshot(): UserThread[] {
  let raw: string | null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    return EMPTY
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    try {
      cachedThreads = raw ? (JSON.parse(raw) as UserThread[]) : EMPTY
    } catch {
      cachedThreads = EMPTY
    }
  }
  return cachedThreads
}

export function getServerUserThreadsSnapshot(): UserThread[] {
  return EMPTY
}

export function subscribeUserThreads(onChange: () => void) {
  window.addEventListener("storage", onChange)
  return () => window.removeEventListener("storage", onChange)
}

export function saveUserThread(thread: UserThread) {
  const prev = loadUserThreads()
  localStorage.setItem(KEY, JSON.stringify([thread, ...prev]))
}
