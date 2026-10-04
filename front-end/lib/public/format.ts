import type { PricingItem, UpcomingClass, UpcomingExam, VehicleType } from "@/lib/public/types"

const vnd = new Intl.NumberFormat("vi-VN")

export function formatVnd(amount: number): string {
  return `${vnd.format(amount)}đ`
}

export function formatPricingItem(item: PricingItem): string {
  const note = item.note ? ` (${item.note})` : ""
  if (item.amount === null) return `${item.label}${note}`
  const amount =
    item.amountMax !== null && item.amountMax !== item.amount
      ? `${vnd.format(item.amount)}–${formatVnd(item.amountMax)}`
      : formatVnd(item.amount)
  const unit = item.unit ? `/${item.unit}` : ""
  return `${item.label}: ${amount}${unit}${note}`
}

// API trả ISO có offset +07:00: cắt yyyy-mm-dd để không lệch ngày theo múi giờ máy chủ
export function formatDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso
}

export function readTimeLabel(minutes: number): string {
  return `${Math.max(1, Math.round(minutes))} phút đọc`
}

export const VEHICLE_LABELS: Record<VehicleType, string> = {
  moto: "Xe máy",
  car: "Ô tô",
  truck: "Ô tô tải",
}

export function transmissionLabel(transmission: UpcomingClass["transmission"]): string | null {
  if (transmission === "manual") return "số sàn"
  if (transmission === "automatic") return "số tự động"
  return null
}

export function classTitle(item: UpcomingClass): string {
  const transmission = transmissionLabel(item.transmission)
  return transmission ? `${item.course.name} (${transmission})` : item.course.name
}

export function classStatus(item: UpcomingClass): { label: string; urgent: boolean } {
  if (item.seatsLeft <= 5) return { label: "Sắp đủ lớp", urgent: true }
  if (item.status === "enrolling") return { label: "Đang nhận hồ sơ", urgent: false }
  return { label: "Sắp khai giảng", urgent: false }
}

export function seatsLabel(seatsLeft: number): string {
  return seatsLeft <= 0 ? "Hết chỗ" : `Còn ${seatsLeft} chỗ`
}

export const EXAM_TYPE_LABELS: Record<UpcomingExam["type"], string> = {
  graduation: "Thi tốt nghiệp",
  official: "Thi sát hạch",
}

export function consultHref(branchSlug: string, courseCode?: string): string {
  const params = new URLSearchParams({ branch: branchSlug })
  if (courseCode) params.set("course", courseCode)
  return `/tu-van?${params.toString()}`
}
