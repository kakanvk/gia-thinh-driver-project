import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { EXAM_TYPE_LABELS, formatDate } from "@/lib/public/format"
import type { UpcomingExam } from "@/lib/public/types"

export function ExamSchedule({ exams }: { exams: UpcomingExam[] | null }) {
  if (!exams || exams.length === 0) {
    return (
      <div className="rounded-md border border-border bg-background p-6 sm:p-7">
        <p className="text-sm leading-6 text-muted-foreground">
          Chưa có lịch thi mới. Lịch thi sẽ được báo qua nhóm Zalo của lớp.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-background">
      <div className="hidden grid-cols-[0.9fr_1.2fr_0.8fr] gap-4 bg-navy px-6 py-4 text-xs font-semibold text-white/70 sm:grid">
        <span>Loại thi</span>
        <span>Hạng bằng</span>
        <span>Ngày thi</span>
      </div>
      {exams.slice(0, 8).map((exam, index) => (
        // API công khai không trả id ca thi: thêm index để key không trùng khi hai ca giống hệt nhau
        <div key={`${exam.type}-${exam.course.code}-${exam.branch.slug}-${exam.date}-${index}`}>
          {index > 0 ? <Separator /> : null}
          <div className="grid gap-3 px-5 py-5 sm:grid-cols-[0.9fr_1.2fr_0.8fr] sm:items-center sm:gap-4 sm:px-6">
            <div>
              <Badge variant={exam.type === "official" ? "default" : "secondary"}>{EXAM_TYPE_LABELS[exam.type]}</Badge>
            </div>
            <div>
              <strong className="text-navy">{exam.course.name}</strong>
              <p className="mt-1 text-xs text-muted-foreground">{exam.branch.name}</p>
              {exam.location ? <p className="mt-0.5 text-xs text-muted-foreground">Địa điểm: {exam.location}</p> : null}
            </div>
            <span className="text-sm font-semibold">{formatDate(exam.date)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
