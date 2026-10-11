"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"

import { SectionHeading, StatusPill } from "@/components/admin/admin-ui"
import { Button } from "@/components/ui/button"
import { formatDateTime } from "@/lib/admin/datetime"
import { CANDIDATE_RESULT_LABELS, EXAM_TYPE_LABELS } from "@/lib/admin/labels"
import type { StudentExam } from "@/lib/admin/types"
import { apiData } from "@/lib/api/client"

// Thẻ "Các lần thi" — chỉ render khi người xem có exam.read (cha kiểm tra)
export function StudentExams({ studentId }: { studentId: string }) {
  const exams = useQuery({
    queryKey: ["student-exams", studentId],
    queryFn: ({ signal }) =>
      apiData<StudentExam[]>(`/students/${studentId}/exams`, { signal }),
  })

  return (
    <section className="rounded-xl border border-border/80 bg-card p-4">
      <SectionHeading title="Các lần thi" />
      {exams.isPending ? (
        <div className="mt-3 h-16 animate-pulse rounded-lg bg-muted" />
      ) : exams.error ? (
        <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
          Không tải được các lần thi.
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void exams.refetch()}
          >
            Thử lại
          </Button>
        </div>
      ) : exams.data.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Học viên chưa có lần thi nào.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Ca thi</th>
                <th className="py-2 pr-3 font-medium">Loại</th>
                <th className="py-2 pr-3 font-medium">Ngày thi</th>
                <th className="py-2 pr-3 font-medium">Kết quả</th>
                <th className="py-2 pr-3 text-right font-medium">Điểm</th>
                <th className="py-2 text-right font-medium">Lần thi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {exams.data.map((exam) => (
                <tr key={exam.candidateId}>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <Link
                      href={`/admin/lich-thi/${exam.sessionId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {exam.sessionCode}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {EXAM_TYPE_LABELS[exam.type]}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                    {formatDateTime(exam.date)}
                  </td>
                  <td className="py-2 pr-3">
                    <StatusPill status={CANDIDATE_RESULT_LABELS[exam.result]} />
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {exam.score ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {exam.attempt}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
