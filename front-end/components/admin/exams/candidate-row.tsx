"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"

import { StatusPill } from "@/components/admin/admin-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CANDIDATE_RESULT_LABELS, CANDIDATE_RESULTS } from "@/lib/admin/labels"
import type { CandidateResult, ExamCandidate } from "@/lib/admin/types"
import { apiData } from "@/lib/api/client"
import { ApiError, errorMessage, fieldErrors } from "@/lib/api/errors"

const resultItems = CANDIDATE_RESULTS.map((value) => ({
  value,
  label: CANDIDATE_RESULT_LABELS[value],
}))

const empty = <span className="text-muted-foreground">—</span>

type ResultBody = {
  result: CandidateResult
  score: number | null
  note?: string
}

// Kết quả, điểm, lần thi làm "Các lần thi" của học viên và thống kê ca đổi;
// Đậu sát hạch còn chuyển học viên sang Hoàn thành
export function invalidateExamResults(
  queryClient: ReturnType<typeof useQueryClient>,
  examId: string
) {
  void queryClient.invalidateQueries({ queryKey: ["exam-candidates", examId] })
  void queryClient.invalidateQueries({ queryKey: ["exam", examId] })
  void queryClient.invalidateQueries({ queryKey: ["exams"] })
  void queryClient.invalidateQueries({ queryKey: ["student-exams"] })
  void queryClient.invalidateQueries({ queryKey: ["students"] })
  void queryClient.invalidateQueries({ queryKey: ["student"] })
}

// Một dòng thí sinh: canEdit → Select kết quả + ô điểm/ghi chú + Lưu;
// canRemove → nút xoá khi thí sinh còn Chờ kết quả
export function CandidateRow({
  examId,
  candidate,
  canEdit,
  canRemove,
  onRemove,
}: {
  examId: string
  candidate: ExamCandidate
  canEdit: boolean
  canRemove: boolean
  onRemove: (candidate: ExamCandidate) => void
}) {
  const queryClient = useQueryClient()
  const name = candidate.student?.name ?? "Học viên đã xoá"
  const [result, setResult] = useState<CandidateResult>(candidate.result)
  const [score, setScore] = useState(
    candidate.score === null ? "" : String(candidate.score)
  )
  const [note, setNote] = useState(candidate.note ?? "")
  const [scoreError, setScoreError] = useState("")

  const save = useMutation({
    mutationFn: (body: ResultBody) =>
      apiData<ExamCandidate>(`/exams/${examId}/candidates/${candidate.id}`, {
        method: "PATCH",
        body,
      }),
    meta: { silent: true },
    onSuccess: () => {
      invalidateExamResults(queryClient, examId)
      toast.success(`Đã lưu kết quả ${name}`)
    },
    onError: (error) => {
      const fields = error instanceof ApiError ? fieldErrors(error.details) : {}
      if (fields.score) setScoreError(fields.score)
      else toast.error(errorMessage(error))
    },
  })

  function onSave() {
    const text = score.trim()
    const value = text === "" ? null : Number(text)
    if (
      value !== null &&
      (!Number.isFinite(value) || value < 0 || value > 1000)
    ) {
      setScoreError("Điểm từ 0 đến 1000")
      return
    }
    setScoreError("")
    const body: ResultBody = { result, score: value }
    // Backend chỉ ghi ghi chú khi có nội dung
    if (note.trim()) body.note = note.trim()
    save.mutate(body)
  }

  const scoreId = `candidate-${candidate.id}-score`
  const scoreErrorId = `${scoreId}-error`

  return (
    <tr className="align-top">
      <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
        {candidate.student?.code ?? "—"}
      </td>
      <td className="py-2 pr-3">
        {candidate.student ? (
          <Link
            href={`/admin/hoc-vien/${candidate.student.id}`}
            className="font-medium text-primary hover:underline"
          >
            {candidate.student.name}
          </Link>
        ) : (
          <span className="text-muted-foreground">{name}</span>
        )}
      </td>
      <td className="py-2 pr-3 whitespace-nowrap">
        {candidate.student?.phone ?? empty}
      </td>
      <td className="py-2 pr-3 text-right tabular-nums">{candidate.attempt}</td>
      <td className="py-2 pr-3">
        {canEdit ? (
          <Select
            items={resultItems}
            value={result}
            onValueChange={(value) =>
              setResult((value as CandidateResult | null) ?? "pending")
            }
          >
            <SelectTrigger
              aria-label={`Kết quả: ${name}`}
              className="w-36"
              size="sm"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {resultItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <StatusPill status={CANDIDATE_RESULT_LABELS[candidate.result]} />
        )}
      </td>
      <td className="py-2 pr-3">
        {canEdit ? (
          <div className="flex w-24 flex-col gap-1">
            <Input
              id={scoreId}
              type="number"
              inputMode="decimal"
              min={0}
              max={1000}
              aria-label={`Điểm: ${name}`}
              aria-invalid={scoreError ? true : undefined}
              aria-describedby={scoreError ? scoreErrorId : undefined}
              value={score}
              onChange={(event) => setScore(event.target.value)}
              className="h-8"
            />
            {scoreError ? (
              <p id={scoreErrorId} className="text-xs text-destructive">
                {scoreError}
              </p>
            ) : null}
          </div>
        ) : (
          <span className="tabular-nums">{candidate.score ?? empty}</span>
        )}
      </td>
      <td className="py-2 pr-3">
        {canEdit ? (
          <Input
            aria-label={`Ghi chú: ${name}`}
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="h-8 min-w-36"
          />
        ) : (
          <span className="text-muted-foreground">{candidate.note ?? "—"}</span>
        )}
      </td>
      {canEdit || canRemove ? (
        <td className="py-2 text-right whitespace-nowrap">
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label={`Lưu kết quả: ${name}`}
              disabled={save.isPending}
              onClick={onSave}
            >
              Lưu
            </Button>
          ) : null}
          {canRemove && candidate.result === "pending" ? (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={`Xoá thí sinh: ${name}`}
              onClick={() => onRemove(candidate)}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          ) : null}
        </td>
      ) : null}
    </tr>
  )
}
