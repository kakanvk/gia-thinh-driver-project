import Link from "next/link"
import {
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CircleCheckBig,
  Download,
  FileCheck2,
  Filter,
  Gauge,
  GraduationCap,
  MoreHorizontal,
  Share2,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react"

import {
  AdminPageHeader,
  SectionHeading,
  StatusPill,
} from "@/components/admin/admin-ui"
import {
  EnrollmentFunnelChart,
  PassRateChart,
  RevenueByClassChart,
  RevenueTrendChart,
  StudentSourceChart,
  WeeklyRegistrationChart,
} from "@/components/admin/dashboard-charts"
import { buttonVariants } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  courseDistribution,
  dashboardStats,
  registrations,
  trainingClasses,
} from "@/lib/admin-data"
import { cn } from "@/lib/utils"

const statIcons = [FileCheck2, GraduationCap, CalendarClock, CircleCheckBig]
const periodItems = [
  { label: "Tuần này", value: "week" },
  { label: "Tháng này", value: "month" },
]
const statTones = {
  primary: "bg-primary/10 text-primary",
  signal: "bg-signal/20 text-navy",
  warning: "bg-highlight/25 text-foreground",
  success: "bg-success/10 text-success",
}

export default function AdminDashboardPage() {
  return (
    <main id="admin-content" className="p-4">
      <AdminPageHeader
        title="Tổng quan"
        action={
          <button
            type="button"
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-[13px] font-medium text-foreground hover:bg-muted"
          >
            <Download aria-hidden="true" className="size-4" />
            Xuất báo cáo
          </button>
        }
      />

      <section
        aria-label="Chỉ số tổng quan"
        className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {dashboardStats.map((stat, index) => {
          const Icon = statIcons[index]
          return (
            <article
              key={stat.label}
              className="rounded-lg border border-border/70 bg-background p-4"
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-md",
                    statTones[stat.tone]
                  )}
                >
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <p className="min-w-0 flex-1 text-[13px] font-medium text-muted-foreground">
                  {stat.label}
                </p>
                <button
                  type="button"
                  aria-label={`Tùy chọn cho ${stat.label}`}
                  className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <MoreHorizontal aria-hidden="true" className="size-4" />
                </button>
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <p className="text-2xl font-bold tracking-tight text-navy">
                  {stat.value}
                </p>
                <div className="min-w-0 text-right text-[11px]">
                  <span className="inline-flex rounded-full bg-success/10 px-2 py-0.5 font-semibold text-success">
                    {stat.change}
                  </span>
                  <span className="mt-1 block truncate text-muted-foreground">
                    {stat.note}
                  </span>
                </div>
              </div>
            </article>
          )
        })}
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]">
        <section className="flex flex-col rounded-lg border border-border/70 bg-background p-4 sm:p-5">
          <SectionHeading
            title="Doanh thu theo tháng"
            description="12 tháng gần nhất · đơn vị triệu đồng · đạt 102,9% kế hoạch"
            icon={TrendingUp}
          />
          <RevenueTrendChart />
        </section>

        <section className="rounded-lg border border-border/70 bg-background p-4 sm:p-5">
          <SectionHeading
            title="Cơ cấu doanh thu theo hạng"
            description="Hạng B và C1 đóng góp 94,2% doanh thu 12 tháng"
            icon={Wallet}
          />
          <div className="mt-5">
            <RevenueByClassChart />
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-border/70 bg-background p-4 sm:p-5">
          <SectionHeading
            title="Phễu tuyển sinh"
            description="Tháng 09/2026 · 1.240 hồ sơ tiếp nhận, 128 nhập học (10,3%)"
            icon={Filter}
          />
          <EnrollmentFunnelChart />
        </section>

        <section className="rounded-lg border border-border/70 bg-background p-4 sm:p-5">
          <SectionHeading
            title="Nguồn đăng ký"
            description="128 học viên nhập học · 42% đến từ giới thiệu"
            icon={Share2}
          />
          <StudentSourceChart />
        </section>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className="flex flex-col rounded-lg border border-border/70 bg-background p-4 sm:p-5">
          <SectionHeading
            title="Tỷ lệ đỗ sát hạch ngay lần đầu"
            description="Đường đứt nét là mục tiêu 96% toàn trung tâm"
            icon={Target}
          />
          <PassRateChart />
        </section>

        <section className="rounded-lg border border-border/70 bg-background p-4 sm:p-5">
          <SectionHeading
            title="Lấp chỗ lớp sắp khai giảng"
            description="Còn dưới 10 chỗ thì cần mở lớp hoặc dời lịch"
            icon={Gauge}
          />
          <div className="mt-5 flex flex-col gap-4">
            {trainingClasses
              .filter((item) => item.status !== "Đã kết thúc")
              .slice(0, 4)
              .map((item) => {
                const percent = Math.round((item.filled / item.capacity) * 100)
                return (
                  <div key={item.code}>
                    <div className="flex items-center justify-between gap-4 text-[13px]">
                      <span className="truncate font-medium text-foreground">
                        {item.licenseClass} · khai giảng {item.startDate}
                      </span>
                      <span className="shrink-0 font-semibold text-navy tabular-nums">
                        {item.filled}/{item.capacity}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <p className="mt-1 text-right text-[11px] text-muted-foreground">
                      {percent}% · còn {item.capacity - item.filled} chỗ
                    </p>
                  </div>
                )
              })}
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]">
        <section className="flex flex-col rounded-lg border border-border/70 bg-background p-4 sm:p-5">
          <SectionHeading
            title="Hồ sơ đăng ký trong tuần"
            description="197 hồ sơ mới · tăng 14,2% so với tuần trước"
            icon={CalendarDays}
            action={
              <Select items={periodItems} defaultValue="week">
                <SelectTrigger
                  size="sm"
                  aria-label="Khoảng thời gian biểu đồ"
                  className="rounded-md text-xs font-medium"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  alignItemWithTrigger={false}
                  className="shadow-none"
                >
                  <SelectGroup>
                    {periodItems.map((item) => (
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
          <WeeklyRegistrationChart />
        </section>

        <section className="rounded-lg border border-border/70 bg-background p-4 sm:p-5">
          <SectionHeading
            title="Học viên theo hạng"
            description="486 học viên đang học. Hạng A1 đông nhất nhưng chỉ chiếm 2,7% doanh thu."
            icon={Users}
          />
          <div className="mt-6 flex flex-col gap-5">
            {courseDistribution.map((course) => (
              <div key={course.label}>
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="font-medium text-foreground">
                    {course.label}
                  </span>
                  <span className="font-semibold text-navy">
                    {course.value}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${course.percent}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-[11px] text-muted-foreground">
                  {course.percent}% tổng học viên
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.75fr)]">
        <section className="overflow-hidden rounded-lg border border-border/70 bg-background">
          <div className="p-4 sm:p-5">
            <SectionHeading
              title="Đăng ký gần đây"
              description="Các hồ sơ vừa được gửi từ website và văn phòng"
              icon={FileCheck2}
              action={
                <Link
                  href="/admin/nguoi-dung"
                  className="inline-flex min-h-9 items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Xem tất cả
                  <ArrowUpRight aria-hidden="true" className="size-4" />
                </Link>
              }
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="bg-muted/60 text-[11px] tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-6 py-3 font-semibold">Học viên</th>
                  <th className="px-4 py-3 font-semibold">Hạng bằng</th>
                  <th className="px-4 py-3 font-semibold">Lịch tư vấn</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {registrations.slice(0, 5).map((registration) => (
                  <tr key={registration.id} className="hover:bg-muted/35">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-md bg-secondary text-xs font-semibold text-secondary-foreground">
                          {registration.initials}
                        </span>
                        <span>
                          <span className="block font-semibold text-foreground">
                            {registration.student}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {registration.phone}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-semibold">
                      {registration.course}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="block font-semibold">
                        {registration.schedule}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {registration.branch}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusPill status={registration.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-border/70 bg-background p-4 sm:p-5">
          <SectionHeading
            title="Việc cần xử lý"
            description="Ưu tiên trong hôm nay"
            icon={CheckCircle2}
          />
          <div className="mt-4 divide-y divide-border/70">
            {[
              [
                "14 hồ sơ chờ xác nhận",
                "Kiểm tra giấy tờ và gọi lại trước 11:30",
              ],
              ["2 bài viết cần duyệt", "Gồm 1 bản nháp và 1 bài chờ duyệt"],
              [
                "3 lớp sắp đủ chỗ",
                "Cập nhật trạng thái tuyển sinh trên website",
              ],
            ].map(([title, note], index) => (
              <div key={title} className="flex gap-3 py-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-[11px] font-semibold text-primary">
                  {index + 1}
                </span>
                <span>
                  <span className="block text-[13px] font-semibold text-foreground">
                    {title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                    {note}
                  </span>
                </span>
              </div>
            ))}
          </div>
          <Link
            href="/admin/lich-dang-ky"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "mt-4 h-9 w-full rounded-md text-[13px] font-medium"
            )}
          >
            Mở lịch đăng ký
          </Link>
        </section>
      </div>
    </main>
  )
}
