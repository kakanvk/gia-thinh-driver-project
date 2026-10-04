import type { Metadata } from "next"
import type { LucideIcon } from "lucide-react"
import {
  CalendarCheck,
  CalendarClock,
  ClipboardCheck,
  GraduationCap,
  Info,
  MoreHorizontal,
  Plus,
  Target,
  Users,
} from "lucide-react"

import {
  AdminPageHeader,
  SectionHeading,
  StatusPill,
  TableToolbar,
} from "@/components/admin/admin-ui"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { examSessions } from "@/lib/admin-data"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Lịch thi & sát hạch",
}

type ExamSession = (typeof examSessions)[number]

const numberFormatter = new Intl.NumberFormat("vi-VN")

const examTypeItems = [
  { label: "Tất cả loại", value: "all" },
  { label: "Tốt nghiệp", value: "tot-nghiep" },
  { label: "Sát hạch", value: "sat-hach" },
]

const examTypeIcons: Record<ExamSession["examType"], LucideIcon> = {
  "Tốt nghiệp": GraduationCap,
  "Sát hạch": ClipboardCheck,
}

/**
 * `passed` là null khi ca thi chưa diễn ra, `rate` là null khi không có thí
 * sinh nào thực dự thi nên không đủ mẫu số để tính tỷ lệ đỗ.
 */
function getResult(session: ExamSession) {
  if (session.passed === null) {
    return null
  }

  const attended = session.candidates - session.absent

  return {
    passed: session.passed,
    failed: session.candidates - session.passed - session.absent,
    rate: attended > 0 ? Math.round((session.passed / attended) * 100) : null,
  }
}

export default function ExamSchedulePage() {
  const passRates = examSessions
    .map((item) => getResult(item)?.rate)
    .filter((rate): rate is number => rate != null)
  const totalCandidates = examSessions.reduce(
    (total, item) => total + item.candidates,
    0
  )
  const totalAbsent = examSessions.reduce(
    (total, item) => total + item.absent,
    0
  )
  const upcoming = examSessions.filter((item) => item.passed === null).length
  const averagePassRate =
    passRates.length > 0
      ? Math.round(
          passRates.reduce((total, rate) => total + rate, 0) / passRates.length
        )
      : 0

  return (
    <main id="admin-content" className="p-4">
      <AdminPageHeader
        title="Lịch thi & sát hạch"
        action={
          <button
            type="button"
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-primary/85"
          >
            <Plus aria-hidden="true" className="size-4" />
            Xếp ca thi
          </button>
        }
      />

      <section
        aria-label="Thống kê lịch thi"
        className="mt-4 grid divide-y divide-border/70 rounded-lg border border-border/70 bg-background sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4"
      >
        {[
          {
            label: "Số ca thi",
            value: numberFormatter.format(examSessions.length),
            note: "Gồm cả ca chưa diễn ra",
            icon: CalendarCheck,
          },
          {
            label: "Tổng thí sinh",
            value: numberFormatter.format(totalCandidates),
            note: `Vắng ${numberFormatter.format(totalAbsent)} lượt`,
            icon: Users,
          },
          {
            label: "Tỷ lệ đỗ bình quân",
            value: `${numberFormatter.format(averagePassRate)}%`,
            note: `Trên ${passRates.length} ca đã có kết quả`,
            icon: Target,
          },
          {
            label: "Số ca sắp diễn ra",
            value: numberFormatter.format(upcoming),
            note: "Đã lên lịch, chờ ngày thi",
            icon: CalendarClock,
          },
        ].map((stat) => {
          const StatIcon = stat.icon

          return (
            <article
              key={stat.label}
              className="flex items-center gap-3 px-4 py-3"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                <StatIcon aria-hidden="true" className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-navy tabular-nums">
                    {stat.value}
                  </span>
                  <span className="text-[13px] font-semibold">
                    {stat.label}
                  </span>
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {stat.note}
                </span>
              </span>
            </article>
          )
        })}
      </section>

      <section className="mt-4 overflow-hidden rounded-lg border border-border/70 bg-background">
        <TableToolbar
          searchLabel="Tìm ca thi"
          searchPlaceholder="Mã ca, hạng bằng hoặc chi nhánh..."
          summary={`${examSessions.length} ca thi đã xếp lịch`}
          action={
            <Select items={examTypeItems} defaultValue="all">
              <SelectTrigger
                aria-label="Lọc theo loại ca thi"
                className="min-h-9 rounded-md text-[13px] font-medium"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                alignItemWithTrigger={false}
                className="shadow-none"
              >
                <SelectGroup>
                  {examTypeItems.map((item) => (
                    <SelectItem
                      key={item.value}
                      value={item.value}
                      className="font-medium"
                    >
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          }
        />

        <div className="overflow-x-auto">
          <table className="w-full min-w-280 text-left text-[13px]">
            <thead className="bg-muted/60 text-[11px] tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-5 py-3 font-semibold">Mã ca</th>
                <th className="px-3 py-3 font-semibold">Loại</th>
                <th className="px-3 py-3 font-semibold">Hạng</th>
                <th className="px-3 py-3 font-semibold">Chi nhánh</th>
                <th className="px-3 py-3 font-semibold">Ngày thi</th>
                <th className="px-3 py-3 font-semibold">Thí sinh</th>
                <th className="px-3 py-3 font-semibold">Đỗ</th>
                <th className="px-3 py-3 font-semibold">Vắng</th>
                <th className="px-3 py-3 font-semibold">Tỷ lệ đỗ</th>
                <th className="px-3 py-3 font-semibold">Trạng thái</th>
                <th className="w-14 px-3 py-3">
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {examSessions.map((item) => {
                const result = getResult(item)
                const ExamTypeIcon = examTypeIcons[item.examType]

                return (
                  <tr key={item.code} className="hover:bg-muted/35">
                    <td className="px-5 py-4 font-semibold text-foreground">
                      {item.code}
                    </td>
                    <td className="px-3 py-4">
                      <span className="inline-flex items-center gap-2 whitespace-nowrap">
                        <ExamTypeIcon
                          aria-hidden="true"
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                        <span className="font-medium">{item.examType}</span>
                      </span>
                    </td>
                    <td className="px-3 py-4 font-semibold">
                      {item.licenseClass}
                    </td>
                    <td className="px-3 py-4 text-muted-foreground">
                      {item.branch}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">{item.date}</td>
                    <td className="px-3 py-4 font-semibold text-navy tabular-nums">
                      {numberFormatter.format(item.candidates)}
                    </td>
                    <td className="px-3 py-4">
                      {result ? (
                        <span className="whitespace-nowrap">
                          <span className="font-semibold text-navy tabular-nums">
                            {numberFormatter.format(result.passed)}
                          </span>
                          <span className="text-muted-foreground"> đỗ · </span>
                          <span
                            className={cn(
                              "tabular-nums",
                              result.failed > 0
                                ? "font-semibold text-foreground"
                                : "text-muted-foreground"
                            )}
                          >
                            {numberFormatter.format(result.failed)}
                          </span>
                          <span className="text-muted-foreground"> trượt</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-4">
                      {item.absent > 0 ? (
                        <span className="inline-flex min-h-6 items-center rounded-full bg-highlight/25 px-2.5 text-[11px] font-semibold text-foreground tabular-nums">
                          {numberFormatter.format(item.absent)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground tabular-nums">
                          {numberFormatter.format(item.absent)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-4">
                      {result?.rate != null ? (
                        <>
                          <span className="block font-semibold text-navy tabular-nums">
                            {result.rate}%
                          </span>
                          <span className="mt-1 block h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                            <span
                              className="block h-full rounded-full bg-primary"
                              style={{ width: `${result.rate}%` }}
                            />
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-4">
                      <StatusPill status={item.status} />
                    </td>
                    <td className="px-3 py-4">
                      <button
                        type="button"
                        aria-label={`Tùy chọn cho ca thi ${item.code}`}
                        className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <MoreHorizontal aria-hidden="true" className="size-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-border/70 px-5 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            Hiển thị {examSessions.length} ca thi · {passRates.length} ca đã có
            kết quả
          </p>
          <p className="flex items-center gap-1.5">
            <CalendarClock aria-hidden="true" className="size-3.5" />
            Ca chưa diễn ra không được tính vào tỷ lệ đỗ
          </p>
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-border/70 bg-background p-4 sm:p-5">
        <SectionHeading
          title="Cách đọc chỉ số sát hạch"
          description="Ca chưa diễn ra không được tính vào tỷ lệ đỗ để chỉ số không bị pha loãng."
          icon={Info}
        />
        <p className="mt-3 text-[13px] leading-6 text-muted-foreground">
          Cột Đỗ và Tỷ lệ đỗ chỉ hiển thị khi ca thi đã có kết quả, các ca sắp
          diễn ra hoặc đã lên lịch sẽ được cập nhật ngay khi có kết quả sát
          hạch. Tỷ lệ đỗ của một ca bằng số thí sinh đỗ chia cho số thực dự thi,
          tức đã trừ thí sinh vắng, nên vắng mặt không bị tính là trượt. Tỷ lệ
          đỗ bình quân ở dải thẻ phía trên là bình quân tỷ lệ của từng ca đã có
          kết quả. Ca có tỷ lệ đỗ dưới 90% cần rà lại lịch kèm của giảng viên và
          bố trí thêm buổi thực hành sa hình trước ngày thi.
        </p>
      </section>
    </main>
  )
}
