import type { Metadata } from "next"
import {
  Banknote,
  CalendarClock,
  Info,
  MoreHorizontal,
  Plus,
  Receipt,
  Wallet,
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
import { extraFees, tuitionRecords, tuitionTable } from "@/lib/admin-data"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Học phí & công nợ",
}

const numberFormatter = new Intl.NumberFormat("vi-VN")

const statusItems = [
  { label: "Tất cả trạng thái", value: "all" },
  { label: "Đã thu đủ", value: "paid" },
  { label: "Đang đóng theo đợt", value: "installment" },
  { label: "Quá hạn", value: "overdue" },
]

export default function TuitionPage() {
  const totalDue = tuitionRecords.reduce((sum, item) => sum + item.total, 0)
  const collected = tuitionRecords.reduce((sum, item) => sum + item.paid, 0)
  const outstanding = totalDue - collected
  const collectedRate = Math.round((collected / totalDue) * 100)
  const overdueCount = tuitionRecords.filter(
    (item) => item.status === "Quá hạn"
  ).length
  const extraFeeTotal = extraFees.reduce((sum, item) => sum + item.amount, 0)

  return (
    <main id="admin-content" className="p-4">
      <AdminPageHeader
        title="Học phí & công nợ"
        action={
          <button
            type="button"
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-primary/85"
          >
            <Plus aria-hidden="true" className="size-4" />
            Ghi nhận thu
          </button>
        }
      />

      <section
        aria-label="Thống kê học phí"
        className="mt-4 grid divide-y divide-border/70 rounded-lg border border-border/70 bg-background sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4"
      >
        {[
          [
            "Tổng phải thu",
            numberFormatter.format(totalDue) + "đ",
            `${tuitionRecords.length} hồ sơ trong danh sách`,
          ],
          [
            "Đã thu",
            numberFormatter.format(collected) + "đ",
            `Đạt ${collectedRate}% tổng phải thu`,
          ],
          [
            "Còn phải thu",
            numberFormatter.format(outstanding) + "đ",
            "Đối chiếu biên lai khi thu nốt",
          ],
          [
            "Hồ sơ quá hạn",
            String(overdueCount),
            "Nhắc trước ngày thi tốt nghiệp",
          ],
        ].map(([label, value, note]) => (
          <article key={label} className="flex items-center gap-3 px-4 py-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <Wallet aria-hidden="true" className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-baseline gap-2">
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
          searchLabel="Tìm hồ sơ học phí"
          searchPlaceholder="Tên học viên, hạng bằng hoặc chi nhánh..."
          summary={`${tuitionRecords.length} hồ sơ học phí`}
          action={
            <Select items={statusItems} defaultValue="all">
              <SelectTrigger
                aria-label="Lọc theo trạng thái học phí"
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
          <table className="w-full min-w-280 text-left text-[13px]">
            <thead className="bg-muted/60 text-[11px] tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-5 py-3 font-semibold">Học viên</th>
                <th className="px-3 py-3 font-semibold">Hạng</th>
                <th className="px-3 py-3 font-semibold">Chi nhánh</th>
                <th className="px-3 py-3 font-semibold">Tổng</th>
                <th className="px-3 py-3 font-semibold">Đã thu</th>
                <th className="px-3 py-3 font-semibold">Còn lại</th>
                <th className="px-3 py-3 font-semibold">Hình thức</th>
                <th className="px-3 py-3 font-semibold">Hạn</th>
                <th className="px-3 py-3 font-semibold">Trạng thái</th>
                <th className="w-14 px-3 py-3">
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {tuitionRecords.map((item, index) => {
                const remaining = item.total - item.paid
                return (
                  <tr key={item.student} className="hover:bg-muted/35">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "grid size-9 shrink-0 place-items-center rounded-md text-[11px] font-semibold",
                            index % 2 === 0
                              ? "bg-primary/10 text-primary"
                              : "bg-highlight/25 text-foreground"
                          )}
                        >
                          {item.initials}
                        </span>
                        <span className="font-semibold text-foreground">
                          {item.student}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-4 font-semibold">
                      {item.licenseClass}
                    </td>
                    <td className="px-3 py-4 text-muted-foreground">
                      {item.branch}
                    </td>
                    <td className="px-3 py-4 font-medium tabular-nums">
                      {numberFormatter.format(item.total) + "đ"}
                    </td>
                    <td className="px-3 py-4 font-medium tabular-nums">
                      {numberFormatter.format(item.paid) + "đ"}
                    </td>
                    <td className="px-3 py-4 tabular-nums">
                      <span
                        className={cn(
                          "font-semibold",
                          remaining === 0
                            ? "text-muted-foreground"
                            : "text-navy"
                        )}
                      >
                        {numberFormatter.format(remaining) + "đ"}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-muted-foreground">
                      {item.method}
                    </td>
                    <td className="px-3 py-4">
                      <span className="inline-flex items-center gap-2">
                        <CalendarClock
                          aria-hidden="true"
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                        <span className="truncate text-muted-foreground">
                          {item.dueDate}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <StatusPill status={item.status} />
                    </td>
                    <td className="px-3 py-4">
                      <button
                        type="button"
                        aria-label={`Tùy chọn cho hồ sơ của ${item.student}`}
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
          <p>Hiển thị {tuitionRecords.length} hồ sơ · số tiền tính theo đồng</p>
          <p className="flex items-center gap-1.5">
            <CalendarClock aria-hidden="true" className="size-3.5" />
            {overdueCount} hồ sơ quá hạn cần gọi nhắc trước ngày thi tốt nghiệp
          </p>
        </div>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className="flex flex-col overflow-hidden rounded-lg border border-border/70 bg-background">
          <div className="border-b border-border/70 p-4 sm:p-5">
            <SectionHeading
              title="Biểu phí niêm yết"
              description="Giá đã gồm hồ sơ và lệ phí thi, chưa gồm khoản thu ngoài trọn gói."
              icon={Receipt}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-140 text-left text-[13px]">
              <thead className="bg-muted/60 text-[11px] tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-5 py-3 font-semibold">Hạng</th>
                  <th className="px-3 py-3 font-semibold">Vĩnh Long</th>
                  <th className="px-3 py-3 font-semibold">Vũng Liêm</th>
                  <th className="px-3 py-3 font-semibold">Thời lượng</th>
                  <th className="px-3 py-3 font-semibold">Đã gồm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {tuitionTable.map((item) => (
                  <tr key={item.licenseClass} className="hover:bg-muted/35">
                    <td className="px-5 py-4 font-semibold text-foreground">
                      {item.licenseClass}
                    </td>
                    <td className="px-3 py-4 font-medium tabular-nums">
                      {numberFormatter.format(item.vinhLong) + "đ"}
                    </td>
                    <td className="px-3 py-4 font-medium tabular-nums">
                      {numberFormatter.format(item.vungLiem) + "đ"}
                    </td>
                    <td className="px-3 py-4 text-muted-foreground">
                      {item.duration}
                    </td>
                    <td className="px-3 py-4 text-muted-foreground">
                      {item.included}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-auto border-t border-border/70 px-5 py-4 text-xs text-muted-foreground">
            Học viên, sinh viên được giảm 500.000đ và khoản giảm đã trừ sẵn ở
            cột hình thức của bảng hồ sơ phía trên.
          </div>
        </section>

        <section className="flex flex-col overflow-hidden rounded-lg border border-border/70 bg-background">
          <div className="border-b border-border/70 p-4 sm:p-5">
            <SectionHeading
              title="Khoản thu ngoài trọn gói"
              description="Thu riêng khi học viên đăng ký, không nằm trong học phí niêm yết."
              icon={Banknote}
            />
          </div>
          <ul className="divide-y divide-border/70">
            {extraFees.map((item) => (
              <li
                key={item.label}
                className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-foreground">
                    {item.label}
                  </span>
                  <span className="block text-xs leading-5 text-muted-foreground">
                    {item.note}
                  </span>
                </span>
                <span className="shrink-0 text-[13px] font-semibold text-navy tabular-nums">
                  {numberFormatter.format(item.amount) + "đ"}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-col gap-1 border-t border-border/70 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>Cộng tối đa nếu học viên dùng tất cả khoản</span>
            <span className="font-semibold text-navy tabular-nums">
              {numberFormatter.format(extraFeeTotal) + "đ"}
            </span>
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-lg border border-border/70 bg-background p-4 sm:p-5">
        <SectionHeading
          title="Cách đọc chỉ số học phí"
          description="Số còn lại là cơ sở đối chiếu biên lai khi thu nốt."
          icon={Info}
        />
        <p className="mt-3 text-[13px] leading-6 text-muted-foreground">
          Ưu đãi học viên, sinh viên đã được trừ sẵn trong cột hình thức, nên
          cột tổng là số phải thu thực tế: lấy tổng trừ đã thu sẽ ra đúng số còn
          lại cần thu nốt, dùng con số này để đối chiếu với biên lai đã phát
          hành. Hồ sơ quá hạn phải gọi nhắc trước ngày thi tốt nghiệp để học
          viên kịp hoàn tất học phí và không bị lùi đợt sát hạch kế tiếp.
        </p>
      </section>
    </main>
  )
}
