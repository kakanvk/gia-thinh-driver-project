import type { Metadata } from "next"
import Link from "next/link"
import {
  Building2,
  ExternalLink,
  GraduationCap,
  MapPin,
  Plus,
  TrendingUp,
  Users,
} from "lucide-react"

import {
  AdminPageHeader,
  SectionHeading,
  StatusPill,
  TableToolbar,
} from "@/components/admin/admin-ui"
import { BranchMapSheet } from "@/components/admin/branch-map-sheet"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  branches,
  instructors,
  offices,
  trainingClasses,
} from "@/lib/admin-data"

export const metadata: Metadata = {
  title: "Chi nhánh",
}

const numberFormatter = new Intl.NumberFormat("vi-VN")

const statusItems = [
  { label: "Tất cả trạng thái", value: "all" },
  { label: "Đang hoạt động", value: "active" },
  { label: "Tạm nghỉ", value: "paused" },
]

export default function BranchesPage() {
  const officeByName = new Map(offices.map((office) => [office.name, office]))
  const openClasses = trainingClasses.filter(
    (item) => item.status !== "Đã kết thúc"
  )
  const totalStudents = branches.reduce((sum, item) => sum + item.students, 0)
  const totalRevenue = branches.reduce(
    (sum, item) => sum + item.monthlyRevenue,
    0
  )

  return (
    <main id="admin-content" className="p-4">
      <AdminPageHeader
        title="Chi nhánh"
        action={
          <button
            type="button"
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-primary/85"
          >
            <Plus aria-hidden="true" className="size-4" />
            Thêm chi nhánh
          </button>
        }
      />

      <section
        aria-label="Thống kê chi nhánh"
        className="mt-4 grid divide-y divide-border/70 rounded-lg border border-border/70 bg-background sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4"
      >
        {[
          ["Số chi nhánh", String(branches.length), "Tất cả đang hoạt động"],
          [
            "Học viên đang học",
            numberFormatter.format(totalStudents),
            "Cộng dồn toàn trung tâm",
          ],
          [
            "Lớp đang mở",
            String(openClasses.length),
            "Không tính lớp đã kết thúc",
          ],
          [
            "Doanh thu tháng",
            numberFormatter.format(totalRevenue),
            "Đơn vị triệu đồng",
          ],
        ].map(([label, value, note]) => (
          <article key={label} className="flex items-center gap-3 px-4 py-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <Building2 aria-hidden="true" className="size-4" />
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

      <section
        aria-label="Danh sách chi nhánh"
        className="mt-4 overflow-hidden rounded-lg border border-border/70 bg-background"
      >
        <TableToolbar
          searchLabel="Tìm chi nhánh"
          searchPlaceholder="Tên chi nhánh, người phụ trách hoặc địa chỉ..."
          summary={`${branches.length} chi nhánh`}
          action={
            <Select items={statusItems} defaultValue="all">
              <SelectTrigger
                aria-label="Lọc theo trạng thái chi nhánh"
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

        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {branches.map((branch) => {
            const office = officeByName.get(branch.office)
            const classCount = openClasses.filter(
              (item) => item.branch === branch.name
            ).length
            const instructorCount = instructors.filter(
              (item) => item.branch === branch.name
            ).length

            return (
              <article
                key={branch.name}
                className="flex flex-col rounded-md bg-muted/40 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-background text-primary">
                      <Building2 aria-hidden="true" className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-[15px] font-bold text-navy">
                        {branch.name}
                      </h3>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {branch.office}
                      </p>
                    </div>
                  </div>
                  <StatusPill status={branch.status} />
                </div>

                {office ? (
                  <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-5 text-muted-foreground">
                    <MapPin
                      aria-hidden="true"
                      className="mt-0.5 size-3.5 shrink-0"
                    />
                    {office.address}
                  </p>
                ) : null}

                <dl className="mt-3 flex flex-col gap-1.5 text-[11px]">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Người phụ trách</dt>
                    <dd className="font-medium text-foreground">
                      {branch.manager}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Khu vực học phí</dt>
                    <dd className="font-medium text-foreground">
                      {branch.priceZone}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Giờ làm việc</dt>
                    <dd className="font-medium text-foreground">
                      {branch.openingHours}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 grid grid-cols-3 gap-2 rounded-md bg-background p-3">
                  <div>
                    <p className="flex items-center gap-1 text-[15px] font-bold text-navy tabular-nums">
                      {numberFormatter.format(branch.students)}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      Học viên
                    </p>
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-navy tabular-nums">
                      {classCount}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      Lớp đang mở
                    </p>
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-navy tabular-nums">
                      {instructorCount}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      Giáo viên
                    </p>
                  </div>
                </div>

                <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                  <span className="text-[11px] text-muted-foreground">
                    Doanh thu tháng
                  </span>
                  <span className="text-[13px] font-semibold text-navy tabular-nums">
                    {numberFormatter.format(branch.monthlyRevenue)} triệu
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {office?.map ? (
                    <BranchMapSheet
                      branchName={branch.name}
                      address={office.address}
                      mapUrl={office.map}
                    />
                  ) : null}
                  <Link
                    href="/admin/lop-hoc"
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-md bg-background px-2.5 text-[11px] font-medium text-primary hover:bg-muted"
                  >
                    <GraduationCap aria-hidden="true" className="size-3.5" />
                    Xem lớp
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-border/70 bg-background p-4 sm:p-5">
        <SectionHeading
          title="Cách đọc số liệu chi nhánh"
          description="Số học viên và doanh thu lấy từ sổ vận hành, lớp và giáo viên lấy trực tiếp từ màn hình Lớp học và Giáo viên."
          icon={TrendingUp}
        />
        <p className="mt-3 text-[13px] leading-6 text-muted-foreground">
          Học viên được tính theo học viên còn trong lộ trình, nên một chi nhánh
          có thể không mở lớp mới mà vẫn còn học viên chờ ngày sát hạch — như
          Thanh Đức, lớp A1 gần nhất đã kết thúc cuối tháng 08. Chi nhánh có
          doanh thu thấp mà vẫn đủ lớp thì nên xem lại cơ cấu hạng: hạng A1 rất
          đông nhưng học phí chỉ bằng khoảng một phần hai mươi lần hạng B. Khu
          vực học phí quyết định bảng giá áp dụng, xem chi tiết ở màn hình Học
          phí.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/admin/hoc-phi"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-muted/60 px-3 text-xs font-medium text-foreground hover:bg-muted"
          >
            <ExternalLink aria-hidden="true" className="size-3.5" />
            Xem biểu phí theo khu vực
          </Link>
          <Link
            href="/admin/giao-vien"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-muted/60 px-3 text-xs font-medium text-foreground hover:bg-muted"
          >
            <Users aria-hidden="true" className="size-3.5" />
            Xem tải giảng dạy
          </Link>
        </div>
      </section>
    </main>
  )
}
