import type { Metadata } from "next"
import {
  CalendarClock,
  Car,
  MoreHorizontal,
  Plus,
  TriangleAlert,
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
import { vehicles } from "@/lib/admin-data"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Xe tập lái",
}

const numberFormatter = new Intl.NumberFormat("vi-VN")

/** Mốc đăng kiểm: xe có hạn trước ngày này được xem là sắp đến hạn. */
const registrationDeadline = { day: 31, month: 10, year: 2026 }

/**
 * So sánh chuỗi "dd/mm/yyyy" với một mốc ngày cụ thể. Tách chuỗi thay vì dựng
 * Date để tránh lệch ngày theo múi giờ.
 */
function isBefore(date: string, day: number, month: number, year: number) {
  const [dateDay, dateMonth, dateYear] = date.split("/").map(Number)

  if (dateYear !== year) {
    return dateYear < year
  }

  if (dateMonth !== month) {
    return dateMonth < month
  }

  return dateDay < day
}

function isRegistrationDue(registration: string) {
  return isBefore(
    registration,
    registrationDeadline.day,
    registrationDeadline.month,
    registrationDeadline.year
  )
}

const statusItems = [
  { label: "Tất cả trạng thái", value: "all" },
  { label: "Đang chạy", value: "running" },
  { label: "Bảo dưỡng", value: "maintenance" },
  { label: "Tạm dừng", value: "paused" },
]

export default function TrainingVehiclesPage() {
  const running = vehicles.filter((item) => item.status === "Đang chạy").length
  const needsService = vehicles.filter(
    (item) => item.status === "Bảo dưỡng" || item.status === "Tạm dừng"
  ).length
  const registrationDue = vehicles.filter((item) =>
    isRegistrationDue(item.registration)
  ).length

  return (
    <main id="admin-content" className="p-4">
      <AdminPageHeader
        title="Xe tập lái"
        action={
          <button
            type="button"
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-primary/85"
          >
            <Plus aria-hidden="true" className="size-4" />
            Thêm xe
          </button>
        }
      />

      <section
        aria-label="Thống kê xe tập lái"
        className="mt-4 grid divide-y divide-border/70 rounded-lg border border-border/70 bg-background sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4"
      >
        {[
          ["Tổng số xe", String(vehicles.length), "Tính cả xe đang bảo dưỡng"],
          ["Đang chạy", String(running), "Sẵn sàng nhận lịch thực hành"],
          [
            "Cần bảo dưỡng",
            String(needsService),
            "Đang bảo dưỡng hoặc tạm dừng",
          ],
          [
            "Sắp đến hạn đăng kiểm",
            String(registrationDue),
            "Hạn trước 31/10/2026",
          ],
        ].map(([label, value, note]) => (
          <article key={label} className="flex items-center gap-3 px-4 py-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <Car aria-hidden="true" className="size-4" />
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
          searchLabel="Tìm xe"
          searchPlaceholder="Biển số, dòng xe hoặc hạng bằng..."
          summary={`${vehicles.length} xe trong đội`}
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
          <table className="w-full min-w-280 text-left text-[13px]">
            <thead className="bg-muted/60 text-[11px] tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-5 py-3 font-semibold">Biển số</th>
                <th className="px-3 py-3 font-semibold">Dòng xe</th>
                <th className="px-3 py-3 font-semibold">Hạng</th>
                <th className="px-3 py-3 font-semibold">Số km</th>
                <th className="px-3 py-3 font-semibold">Km DAT</th>
                <th className="px-3 py-3 font-semibold">Bảo dưỡng gần nhất</th>
                <th className="px-3 py-3 font-semibold">Bảo dưỡng kế tiếp</th>
                <th className="px-3 py-3 font-semibold">Đăng kiểm</th>
                <th className="px-3 py-3 font-semibold">Trạng thái</th>
                <th className="w-14 px-3 py-3">
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {vehicles.map((item) => {
                const dueSoon = isRegistrationDue(item.registration)

                return (
                  <tr key={item.plate} className="hover:bg-muted/35">
                    <td className="px-5 py-4 font-semibold text-foreground tabular-nums">
                      {item.plate}
                    </td>
                    <td className="px-3 py-4 text-muted-foreground">
                      {item.model}
                    </td>
                    <td className="px-3 py-4 font-semibold">
                      {item.licenseClass}
                    </td>
                    <td className="px-3 py-4 tabular-nums">
                      {numberFormatter.format(item.odometer)} km
                    </td>
                    <td
                      className={cn(
                        "px-3 py-4 tabular-nums",
                        item.datKm === 0 && "text-muted-foreground"
                      )}
                    >
                      {item.datKm === 0 ? (
                        <>
                          <span aria-hidden="true">—</span>
                          <span className="sr-only">
                            Không áp dụng cho xe máy
                          </span>
                        </>
                      ) : (
                        `${numberFormatter.format(item.datKm)} km`
                      )}
                    </td>
                    <td className="px-3 py-4 text-muted-foreground tabular-nums">
                      {item.lastService}
                    </td>
                    <td className="px-3 py-4 tabular-nums">
                      {item.nextService}
                    </td>
                    <td className="px-3 py-4">
                      <span className="block tabular-nums">
                        {item.registration}
                      </span>
                      {dueSoon ? (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-highlight/25 px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap text-foreground">
                          <TriangleAlert
                            aria-hidden="true"
                            className="size-3"
                          />
                          Sắp đến hạn
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-4">
                      <StatusPill status={item.status} />
                    </td>
                    <td className="px-3 py-4">
                      <button
                        type="button"
                        aria-label={`Tùy chọn cho xe ${item.plate}`}
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
          <p>Hiển thị {vehicles.length} xe trong đội</p>
          <p className="flex items-center gap-1.5">
            <CalendarClock aria-hidden="true" className="size-3.5" />
            {registrationDue} xe có hạn đăng kiểm trước 31/10/2026
          </p>
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-border/70 bg-background p-4 sm:p-5">
        <SectionHeading
          title="Cách đọc chỉ số xe"
          description="Số km lấy theo đồng hồ công-tơ-mét, km DAT chỉ áp dụng cho ô tô nên xe máy để trống."
          icon={Car}
        />
        <p className="mt-3 text-[13px] leading-6 text-muted-foreground">
          Học phí hạng B và C1 đã bao gồm xăng dầu chạy DAT, nên km DAT vượt
          định mức là chi phí tăng thêm của trung tâm. Đăng kiểm quá hạn thì xe
          không được dùng để dạy, cần đưa đi đăng kiểm trước hạn ghi ở cột Đăng
          kiểm. Xe đang bảo dưỡng cần dời lịch thực hành sang xe khác cùng hạng
          để học viên không bị trễ tiến độ.
        </p>
      </section>
    </main>
  )
}
