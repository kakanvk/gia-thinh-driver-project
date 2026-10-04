import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowUpRight,
  BookOpen,
  LifeBuoy,
  MessagesSquare,
  Route,
} from "lucide-react"

import { AdminPageHeader, SectionHeading } from "@/components/admin/admin-ui"
import { supportContacts, supportPlaybook } from "@/lib/admin-data"

export const metadata: Metadata = {
  title: "Trợ giúp",
}

const faqs = [
  {
    question: "Học viên báo mất biên lai học phí, xử lý thế nào?",
    answer:
      "Tra tên ở màn hình Học phí để lấy số đã thu và số còn lại, đối chiếu với phiếu thu lưu tại văn phòng rồi in lại. Không tự sửa số đã thu nếu chưa có phiếu gốc.",
  },
  {
    question: "Sĩ số lớp hiển thị khác với danh sách học viên thì tin số nào?",
    answer:
      "Tin theo danh sách hồ sơ đã hoàn tất. Sĩ số chỉ tính hồ sơ đã xác nhận, nên hồ sơ còn chờ giấy khám sức khỏe sẽ chưa được cộng vào lớp.",
  },
  {
    question: "Học viên xin dời lịch thi sát hạch thì làm gì?",
    answer:
      "Kiểm tra ca thi ở màn hình Lịch thi. Nếu ca chưa tới ngày, chuyển học viên sang ca kế tiếp cùng hạng và ghi chú lý do; ca đã có kết quả thì phải đăng ký lại từ đầu.",
  },
  {
    question: "Cấp lại tài khoản cho giáo viên mới?",
    answer:
      "Gửi yêu cầu tới email hỗ trợ vận hành kèm họ tên và số điện thoại, không gửi mật khẩu qua Zalo nhóm lớp.",
  },
  {
    question: "Phát hiện bài viết sai học phí hoặc trùng nội dung thì sao?",
    answer:
      "Vào màn hình Bài viết, mở bài đó, sửa lại và chuyển về bản nháp để duyệt lại. Học phí và lịch khai giảng chỉ công bố từ tài khoản Quản trị viên.",
  },
]

const quickLinks = [
  {
    label: "Lịch đăng ký",
    href: "/admin/lich-dang-ky",
    note: "Xếp và theo dõi lịch tư vấn",
  },
  {
    label: "Lớp học",
    href: "/admin/lop-hoc",
    note: "Sĩ số, lịch khai giảng, giảng viên",
  },
  {
    label: "Lịch thi",
    href: "/admin/lich-thi",
    note: "Ca thi tốt nghiệp và sát hạch",
  },
  {
    label: "Học phí",
    href: "/admin/hoc-phi",
    note: "Công nợ và biểu phí niêm yết",
  },
]

const publicLinks = [
  {
    label: "Trang nhận tư vấn",
    href: "/tu-van",
    note: "Biểu mẫu khách để lại thông tin",
  },
  { label: "Tin tức", href: "/dien-dan", note: "Bài đã xuất bản trên website" },
  {
    label: "Sân tập 3D",
    href: "/san-tap",
    note: "Sơ đồ sân tập và các bài sa hình",
  },
  {
    label: "Thư viện",
    href: "/thu-vien",
    note: "Hình ảnh và video của trung tâm",
  },
]

export default function HelpPage() {
  return (
    <main id="admin-content" className="p-4">
      <AdminPageHeader
        title="Trợ giúp vận hành"
        action={
          <a
            href="mailto:support@giathinh.vn"
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-[13px] font-medium text-foreground hover:bg-muted"
          >
            <LifeBuoy aria-hidden="true" className="size-4" />
            Gửi yêu cầu hỗ trợ
          </a>
        }
      />

      <section
        aria-label="Đầu mối hỗ trợ"
        className="mt-4 grid gap-3 sm:grid-cols-3"
      >
        {supportContacts.map((contact) => (
          <article
            key={contact.label}
            className="rounded-lg border border-border/70 bg-background p-4"
          >
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {contact.label}
            </p>
            <p className="mt-1.5 text-[15px] font-bold text-navy">
              {contact.value}
            </p>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              {contact.note}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-4 rounded-lg border border-border/70 bg-background p-4 sm:p-5">
        <SectionHeading
          title="Quy trình thường gặp"
          description="Làm đúng thứ tự để không phải sửa dữ liệu về sau."
          icon={Route}
        />
        <ol className="mt-5 flex flex-col gap-3">
          {supportPlaybook.map((item, index) => (
            <li
              key={item.title}
              className="flex flex-col gap-2 rounded-md bg-muted/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-background text-[11px] font-semibold text-primary">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                    {item.steps}
                  </p>
                </div>
              </div>
              <Link
                href={item.href}
                className="inline-flex min-h-9 shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline sm:pl-4"
              >
                {item.linkLabel}
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-border/70 bg-background p-4 sm:p-5">
          <SectionHeading
            title="Câu hỏi thường gặp"
            description="Tình huống hay gặp ở văn phòng và cách xử lý."
            icon={MessagesSquare}
          />
          <dl className="mt-5 flex flex-col gap-4">
            {faqs.map((item) => (
              <div key={item.question}>
                <dt className="text-[13px] font-semibold text-foreground">
                  {item.question}
                </dt>
                <dd className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  {item.answer}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="flex flex-col gap-4">
          <section className="rounded-lg border border-border/70 bg-background p-4 sm:p-5">
            <SectionHeading
              title="Màn hình hay dùng"
              description="Lối tắt cho ca trực văn phòng."
              icon={BookOpen}
            />
            <ul className="mt-5 flex flex-col gap-2">
              {quickLinks.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between gap-3 rounded-md px-3 py-2.5 hover:bg-muted/60"
                  >
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-foreground">
                        {item.label}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {item.note}
                      </span>
                    </span>
                    <ArrowUpRight
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-border/70 bg-background p-4 sm:p-5">
            <SectionHeading
              title="Trang công khai"
              description="Kiểm tra lại trước khi trả lời khách."
              icon={ArrowUpRight}
            />
            <ul className="mt-5 flex flex-col gap-2">
              {publicLinks.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 rounded-md px-3 py-2.5 hover:bg-muted/60"
                  >
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-foreground">
                        {item.label}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {item.note}
                      </span>
                    </span>
                    <span className="sr-only">(mở trong tab mới)</span>
                    <ArrowUpRight
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </main>
  )
}
