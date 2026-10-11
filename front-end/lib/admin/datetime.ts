const VN_OFFSET_MS = 7 * 60 * 60 * 1000

export function toVnIso(local: string): string {
  return `${local.slice(0, 16)}:00+07:00`
}

// API trả ISO kèm +07:00: cắt chuỗi để không lệch theo múi giờ máy
export function toLocalInput(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 16) : ""
}

export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

export function formatTime(iso: string): string {
  return /T(\d{2}:\d{2})/.exec(iso)?.[1] ?? ""
}

export function formatDateTime(iso: string): string {
  const time = formatTime(iso)
  return time ? `${formatDate(iso)} ${time}` : formatDate(iso)
}

export function todayVn(now: Date = new Date()): string {
  return new Date(now.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10)
}

export function monthOf(day: string): string {
  return day.slice(0, 7)
}

export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number)
  const index = year * 12 + (m - 1) + delta
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`
}

export function isOverdue(iso: string | null, now: Date = new Date()): boolean {
  return iso ? Date.parse(iso) < now.getTime() : false
}
