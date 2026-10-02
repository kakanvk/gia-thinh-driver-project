import type { Metadata } from "next"
import Link from "next/link"
import { Building2, MapPin, ShieldCheck, SlidersHorizontal } from "lucide-react"

import { AdminPageHeader, SectionHeading } from "@/components/admin/admin-ui"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { supportContacts } from "@/lib/admin-data"
import { offices } from "@/lib/contact"

export const metadata: Metadata = {
  title: "Cài đặt",
}

const operationalRules = [
  {
    id: "rule-zalo-lead",
    label: "Thông báo Zalo khi có hồ sơ mới",
    description:
      "Nhóm tư vấn nhận tin ngay khi khách để lại số điện thoại ở trang Nhận tư vấn.",
    defaultChecked: true,
  },
  {
    id: "rule-tuition-reminder",
    label: "Tự động nhắc học phí còn lại",
    description:
      "Gửi nhắc trước hạn 3 ngày cho hồ sơ đang đóng theo đợt, tránh dồn nợ tới ngày thi.",
    defaultChecked: true,
  },
  {
    id: "rule-post-approve",
    label: "Duyệt bài viết trước khi xuất bản",
    description:
      "Tin khai giảng và học phí phải được duyệt trước khi hiển thị trên website.",
    defaultChecked: true,
  },
  {
    id: "rule-class-alert",
    label: "Cảnh báo lớp còn dưới 10 chỗ",
    description:
      "Hiện nhắc ở màn hình Lớp học để kịp mở lớp kế tiếp cùng hạng.",
    defaultChecked: true,
  },
  {
    id: "rule-dat-warning",
    label: "Cảnh báo xe vượt định mức km DAT",
    description:
      "Học phí hạng B và C1 đã gồm xăng dầu chạy DAT nên vượt định mức là chi phí tăng thêm.",
    defaultChecked: false,
  },
]

const roleScopes = [
  {
    role: "Quản trị viên",
    scope: "Toàn trung tâm",
    permissions: "Cấu hình hệ thống, phân quyền, xem toàn bộ học phí",
  },
  {
    role: "Tư vấn viên",
    scope: "Chi nhánh được phân",
    permissions: "Tiếp nhận hồ sơ, xếp lịch tư vấn, xem công nợ",
  },
  {
    role: "Giáo viên",
    scope: "Lớp phụ trách",
    permissions: "Điểm danh, ghi nhận giờ chạy DAT, báo kết quả thi",
  },
  {
    role: "Kế toán",
    scope: "Toàn trung tâm",
    permissions: "Ghi nhận thu, đối soát biên lai, xuất báo cáo tài chính",
  },
]

export default function SettingsPage() {
  return (
    <main id="admin-content" className="p-4">
      <AdminPageHeader
        title="Cài đặt"
        action={
          <button
            type="button"
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-primary/85"
          >
            <ShieldCheck aria-hidden="true" className="size-4" />
            Lưu thay đổi
          </button>
        }
      />

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <section className="rounded-lg border border-border/70 bg-background p-4 sm:p-5">
          <SectionHeading
            title="Quy định vận hành"
            description="Các thiết lập áp dụng cho toàn bộ chi nhánh."
            icon={SlidersHorizontal}
          />

          <FieldSet className="mt-5">
            <FieldLegend variant="label" className="sr-only">
              Quy định vận hành
            </FieldLegend>
            <FieldGroup className="gap-4">
              {operationalRules.map((rule) => (
                <Field key={rule.id} orientation="horizontal">
                  <Checkbox id={rule.id} defaultChecked={rule.defaultChecked} />
                  <FieldContent>
                    <FieldLabel htmlFor={rule.id}>{rule.label}</FieldLabel>
                    <FieldDescription>{rule.description}</FieldDescription>
                  </FieldContent>
                </Field>
              ))}
            </FieldGroup>
          </FieldSet>
        </section>

        <section className="rounded-lg border border-border/70 bg-background p-4 sm:p-5">
          <SectionHeading
            title="Đầu mối hỗ trợ"
            description="Dùng khi cần xử lý sự cố vận hành."
            icon={ShieldCheck}
          />
          <div className="mt-5 flex flex-col gap-4">
            {supportContacts.map((contact) => (
              <div
                key={contact.label}
                className="rounded-md bg-muted/50 px-3 py-2.5"
              >
                <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {contact.label}
                </p>
                <p className="mt-1 text-[13px] font-semibold text-navy">
                  {contact.value}
                </p>
                <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                  {contact.note}
                </p>
              </div>
            ))}
          </div>
          <Link
            href="/admin/tro-giup"
            className="mt-4 inline-flex min-h-9 items-center text-xs font-medium text-primary hover:underline"
          >
            Xem quy trình xử lý thường gặp
          </Link>
        </section>
      </div>

      <section className="mt-4 rounded-lg border border-border/70 bg-background p-4 sm:p-5">
        <SectionHeading
          title="Chi nhánh & liên hệ"
          description={`${offices.length} văn phòng đang hoạt động, học phí niêm yết theo từng khu vực.`}
          icon={Building2}
        />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {offices.map((office) => (
            <article
              key={office.name}
              className="rounded-md bg-muted/50 px-3 py-3"
            >
              <p className="text-[13px] font-semibold text-foreground">
                {office.name}
              </p>
              <p className="mt-1 flex items-start gap-1.5 text-[11px] leading-5 text-muted-foreground">
                <MapPin
                  aria-hidden="true"
                  className="mt-0.5 size-3.5 shrink-0"
                />
                {office.address}
              </p>
              {office.map ? (
                <a
                  href={office.map}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                >
                  Mở bản đồ
                  <span className="sr-only"> của {office.name}</span>
                </a>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="mt-4 overflow-hidden rounded-lg border border-border/70 bg-background">
        <div className="p-4 sm:p-5">
          <SectionHeading
            title="Phân quyền theo vai trò"
            description="Chỉ Quản trị viên được đổi cấu hình và phân quyền."
            icon={ShieldCheck}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-200 text-left text-[13px]">
            <thead className="bg-muted/60 text-[11px] tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-5 py-3 font-semibold">Vai trò</th>
                <th className="px-3 py-3 font-semibold">Phạm vi</th>
                <th className="px-3 py-3 font-semibold">Quyền hạn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {roleScopes.map((item) => (
                <tr key={item.role} className="hover:bg-muted/35">
                  <td className="px-5 py-4 font-semibold text-foreground">
                    {item.role}
                  </td>
                  <td className="px-3 py-4 text-muted-foreground">
                    {item.scope}
                  </td>
                  <td className="px-3 py-4 text-muted-foreground">
                    {item.permissions}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
