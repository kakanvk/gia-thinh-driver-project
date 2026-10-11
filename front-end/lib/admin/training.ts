import { TRANSMISSION_LABELS } from "@/lib/admin/labels"
import type { ExamStats, TrainingClass, Transmission } from "@/lib/admin/types"

// Tỷ lệ đậu (%) = đậu / (thí sinh − vắng − chờ), 1 chữ số thập phân;
// null khi mẫu = 0 (chưa có kết quả hoặc toàn vắng) để không chia cho 0
export function passRate(stats: ExamStats): number | null {
  const sample = stats.candidates - stats.absent - stats.pending
  if (sample <= 0) return null
  return Math.round((stats.passed / sample) * 1000) / 10
}

export function formatPassRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return "—"
  return `${String(rate).replace(".", ",")}%`
}

export function transmissionLabel(
  transmission: Transmission | null | undefined
): string {
  return transmission ? TRANSMISSION_LABELS[transmission] : ""
}

// "B1 · Số tự động" — mã gói (ưu tiên gói hiện tại) kèm loại số nếu có
export function classTitle(
  cls: Pick<TrainingClass, "courseCode" | "course" | "transmission">
): string {
  return [
    cls.course?.code ?? cls.courseCode,
    transmissionLabel(cls.transmission),
  ]
    .filter(Boolean)
    .join(" · ")
}
