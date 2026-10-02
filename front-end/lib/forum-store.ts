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

export function saveUserThread(thread: UserThread) {
  const prev = loadUserThreads()
  localStorage.setItem(KEY, JSON.stringify([thread, ...prev]))
}
