import type { Metadata } from "next"
import {
  CalendarClock,
  GraduationCap,
  MoreHorizontal,
  Plus,
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
import { trainingClasses } from "@/lib/admin-data"

export const metadata: Metadata = {
  title: "Lớp học",
}

const licenseClassItems = [
  { label: "Tất cả hạng", value: "all" },
  { label: "A1", value: "a1" },
  { label: "A", value: "a" },
  { label: "B số sàn", value: "b-manual" },
  { label: "B tự động", value: "b-auto" },
  { label: "C1", value: "c1" },
]

export default function ClassesPage() {
  const activeClasses = trainingClasses.filter(
    (item) => item.status !== "Đã kết thúc"
  )
  const enrolled = activeClasses.reduce((total, item) => total + item.filled, 0)
  const seats = activeClasses.reduce((total, item) => total + item.capacity, 0)
  const fillRate = Math.round((enrolled / seats) * 100)
  const openingSoon = activeClasses.filter(
    (item) => item.status !== "Đang học"
  ).length

  return (
    <main id="admin-content" className="p-4">
      <AdminPageHeader
        title="Lớp học & khai giảng"
        action={
          <button
            type="button"
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-primary/85"
          >
            <Plus aria-hidden="true" className="size-4" />
            Tạo lớp mới
          </button>
        }
      />

      <section
        aria-label="Thống kê lớp học"
        className="mt-4 grid divide-y divide-border/70 rounded-lg border border-border/70 bg-background sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4"
      >
        {[
          [
            "Lớp đang vận hành",
            String(activeClasses.length),
            "Không tính lớp đã kết thúc",
          ],
          ["Học viên đang theo học", String(enrolled), `Trên ${seats} chỗ`],
          ["Tỷ lệ lấp chỗ", `${fillRate}%`, "Bình quân các lớp đang mở"],
          [
            "Lớp chờ khai giảng",
            String(openingSoon),
            "Đang nhận hồ sơ và sắp mở",
          ],
        ].map(([label, value, note]) => (
          <article key={label} className="flex items-center gap-3 px-4 py-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <GraduationCap aria-hidden="true" className="size-4" />
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
          searchLabel="Tìm lớp học"
          searchPlaceholder="Mã lớp, giảng viên hoặc chi nhánh..."
          summary={`${trainingClasses.length} lớp trong học kỳ`}
          action={
            <Select items={licenseClassItems} defaultValue="all">
              <SelectTrigger
                aria-label="Lọc theo hạng bằng"
                className="min-h-9 rounded-md text-[13px] font-medium"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                alignItemWithTrigger={false}
                className="shadow-none"
              >
                <SelectGroup>
                  {licenseClassItems.map((item) => (
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
                <th className="px-5 py-3 font-semibold">Mã lớp</th>
                <th className="px-3 py-3 font-semibold">Hạng</th>
                <th className="px-3 py-3 font-semibold">Chi nhánh</th>
                <th className="px-3 py-3 font-semibold">Khai giảng</th>
                <th className="px-3 py-3 font-semibold">Lịch học</th>
                <th className="px-3 py-3 font-semibold">Giảng viên</th>
                <th className="px-3 py-3 font-semibold">Sĩ số</th>
                <th className="px-3 py-3 font-semibold">Trạng thái</th>
                <th className="w-14 px-3 py-3">
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {trainingClasses.map((item) => {
                const percent = Math.round((item.filled / item.capacity) * 100)
                return (
                  <tr key={item.code} className="hover:bg-muted/35">
                    <td className="px-5 py-4 font-semibold text-foreground">
                      {item.code}
                    </td>
                    <td className="px-3 py-4 font-semibold">
                      {item.licenseClass}
                    </td>
                    <td className="px-3 py-4 text-muted-foreground">
                      {item.branch}
                    </td>
                    <td className="px-3 py-4">
                      <span className="block font-medium">
                        {item.startDate}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Kết thúc {item.endDate}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-muted-foreground">
                      {item.schedule}
                    </td>
                    <td className="px-3 py-4">
                      <span className="inline-flex items-center gap-2">
                        <Users
                          aria-hidden="true"
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                        <span className="truncate">{item.instructor}</span>
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <span className="block font-semibold text-navy tabular-nums">
                        {item.filled}/{item.capacity}
                      </span>
                      <span className="mt-1 block h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${percent}%` }}
                        />
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <StatusPill status={item.status} />
                    </td>
                    <td className="px-3 py-4">
                      <button
                        type="button"
                        aria-label={`Tùy chọn cho lớp ${item.code}`}
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
            Hiển thị {trainingClasses.length} lớp · cập nhật lúc 08:30 hôm nay
          </p>
          <p className="flex items-center gap-1.5">
            <CalendarClock aria-hidden="true" className="size-3.5" />
            Lớp còn dưới 10 chỗ cần mở lớp kế tiếp cùng hạng
          </p>
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-border/70 bg-background p-4 sm:p-5">
        <SectionHeading
          title="Cách đọc sĩ số"
          description="Sĩ số tính theo hồ sơ đã hoàn tất, không tính hồ sơ đang chờ xác nhận."
          icon={Users}
        />
        <p className="mt-3 text-[13px] leading-6 text-muted-foreground">
          Tỷ lệ lấp chỗ dưới 70% thì nên đẩy truyền thông cho hạng đó; trên 85%
          thì mở lớp kế tiếp để không mất học viên sang trung tâm khác. Riêng
          hạng B và C1 cần chốt sớm vì mỗi lớp chỉ nhận tối đa 50 hồ sơ theo
          năng lực xe và giảng viên hiện có.
        </p>
      </section>
    </main>
  )
}
