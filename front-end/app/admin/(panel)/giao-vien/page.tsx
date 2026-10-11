import type { Metadata } from "next"
import { CalendarClock, Gauge, MoreHorizontal, Plus, Users } from "lucide-react"

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
import { instructors } from "@/lib/admin-data"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Giáo viên",
}

const numberFormatter = new Intl.NumberFormat("vi-VN")

/** Vượt ngưỡng này thì giáo viên bị quá tải và cần chia bớt lớp. */
const overloadHours = 130

const statusItems = [
  { label: "Tất cả trạng thái", value: "all" },
  { label: "Đang hoạt động", value: "active" },
  { label: "Tạm nghỉ", value: "paused" },
]

const avatarStyles = [
  "bg-primary/10 text-primary",
  "bg-highlight/25 text-foreground",
  "bg-success/10 text-success",
]

export default function InstructorsPage() {
  const activeInstructors = instructors.filter(
    (item) => item.status === "Đang hoạt động"
  )
  const pausedInstructors = instructors.filter(
    (item) => item.status === "Tạm nghỉ"
  )
  const activeStudents = activeInstructors.reduce(
    (total, item) => total + item.students,
    0
  )
  const pausedStudents = pausedInstructors.reduce(
    (total, item) => total + item.students,
    0
  )
  const passRate = Math.round(
    activeInstructors.reduce(
      (total, item) => total + item.passRate * item.students,
      0
    ) / activeStudents
  )
  const branches = new Set(instructors.map((item) => item.branch)).size
  const overloaded = instructors.filter(
    (item) => item.hoursThisMonth > overloadHours
  ).length

  return (
    <main id="admin-content" className="p-4">
      <AdminPageHeader
        title="Giáo viên"
        action={
          <button
            type="button"
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-primary/85"
          >
            <Plus aria-hidden="true" className="size-4" />
            Thêm giáo viên
          </button>
        }
      />

      <section
        aria-label="Thống kê giáo viên"
        className="mt-4 grid divide-y divide-border/70 rounded-lg border border-border/70 bg-background sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4"
      >
        {[
          [
            "Tổng giáo viên",
            numberFormatter.format(instructors.length),
            `${branches} chi nhánh có giáo viên`,
          ],
          [
            "Đang hoạt động",
            numberFormatter.format(activeInstructors.length),
            `${pausedInstructors.length} giáo viên tạm nghỉ`,
          ],
          [
            "Tổng học viên phụ trách",
            numberFormatter.format(activeStudents),
            `Không gồm ${numberFormatter.format(pausedStudents)} học viên nghỉ`,
          ],
          [
            "Tỷ lệ đỗ bình quân",
            `${passRate}%`,
            "Bình quân gia quyền theo số học viên",
          ],
        ].map(([label, value, note]) => (
          <article key={label} className="flex items-center gap-3 px-4 py-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <Users aria-hidden="true" className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-navy tabular-nums">
                  {value}
                </span>
                <span className="text-[13px] font-semibold">{label}</span>
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {note}
              </span>
            </span>
          </article>
        ))}
      </section>

      <section className="mt-4 overflow-hidden rounded-lg border border-border/70 bg-background">
        <TableToolbar
          searchLabel="Tìm giáo viên"
          searchPlaceholder="Tên, số điện thoại hoặc chuyên môn..."
          summary={`${instructors.length} giáo viên`}
          action={
            <Select items={statusItems} defaultValue="all">
              <SelectTrigger
                aria-label="Lọc theo trạng thái"
                className="min-h-9 rounded-md text-[13px] font-medium"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                alignItemWithTrigger={false}
                className="shadow-none"
              >
                <SelectGroup>
                  {statusItems.map((item) => (
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
          <table className="w-full min-w-260 text-left text-[13px]">
            <thead className="bg-muted/60 text-[11px] tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-5 py-3 font-semibold">Giáo viên</th>
                <th className="px-3 py-3 font-semibold">Chuyên môn</th>
                <th className="px-3 py-3 font-semibold">Chi nhánh</th>
                <th className="px-3 py-3 font-semibold">Lớp</th>
                <th className="px-3 py-3 font-semibold">Học viên</th>
                <th className="px-3 py-3 font-semibold">Tỷ lệ đỗ</th>
                <th className="px-3 py-3 font-semibold">Giờ dạy tháng</th>
                <th className="px-3 py-3 font-semibold">Trạng thái</th>
                <th className="w-14 px-3 py-3">
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {instructors.map((item, index) => (
                <tr key={item.phone} className="hover:bg-muted/35">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-md text-[11px] font-semibold",
                          avatarStyles[index % avatarStyles.length]
                        )}
                      >
                        {item.initials}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold text-foreground">
                          {item.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {item.phone}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-4 font-semibold">{item.specialty}</td>
                  <td className="px-3 py-4 text-muted-foreground">
                    {item.branch}
                  </td>
                  <td className="px-3 py-4 font-semibold tabular-nums">
                    {numberFormatter.format(item.classes)}
                  </td>
                  <td className="px-3 py-4 tabular-nums">
                    {numberFormatter.format(item.students)}
                  </td>
                  <td className="px-3 py-4">
                    <span className="block font-semibold text-navy tabular-nums">
                      {item.passRate}%
                    </span>
                    <span className="mt-1 block h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${item.passRate}%` }}
                      />
                    </span>
                  </td>
                  <td className="px-3 py-4">
                    <span className="block font-semibold tabular-nums">
                      {numberFormatter.format(item.hoursThisMonth)} giờ
                    </span>
                    {item.hoursThisMonth > overloadHours ? (
                      <span className="mt-1 inline-flex min-h-5 items-center rounded-md bg-highlight/25 px-2 text-[10px] font-semibold text-foreground">
                        Quá tải
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-4">
                    <StatusPill status={item.status} />
                  </td>
                  <td className="px-3 py-4">
                    <button
                      type="button"
                      aria-label={`Tùy chọn cho giáo viên ${item.name}`}
                      className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <MoreHorizontal aria-hidden="true" className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-border/70 px-5 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            Hiển thị {instructors.length} giáo viên · cập nhật lúc 08:30 hôm nay
          </p>
          <p className="flex items-center gap-1.5">
            <CalendarClock aria-hidden="true" className="size-3.5" />
            {overloaded} giáo viên vượt {overloadHours} giờ cần chia bớt lớp
          </p>
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-border/70 bg-background p-4 sm:p-5">
        <SectionHeading
          title="Cách đọc chỉ số giáo viên"
          description="Tỷ lệ đỗ tính trên học viên của chính giáo viên đó, không phải tỷ lệ chung của trung tâm."
          icon={Gauge}
        />
        <p className="mt-3 text-[13px] leading-6 text-muted-foreground">
          Giờ dạy trên {overloadHours} giờ một tháng là quá tải, nên chia bớt
          lớp cho giáo viên cùng chuyên môn để giữ chất lượng thực hành. Giáo
          viên đang tạm nghỉ không tính vào tải chung, vì vậy các chỉ số bình
          quân ở trên chỉ tính giáo viên đang hoạt động.
        </p>
      </section>
    </main>
  )
}
