import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, Clock3, MapPin, MessageCircle, Phone } from "lucide-react"

import { ConsultationForm } from "@/components/consultation-form"
import { SiteHeader } from "@/components/site-header"
import { getBranches, getSiteContact } from "@/lib/api/public"

export const metadata: Metadata = {
  title: "Nhận tư vấn khóa học | Trường lái Gia Thịnh",
  description:
    "Gửi thông tin để được Gia Thịnh tư vấn hạng bằng, học phí, lịch học và cơ sở thuận tiện.",
}

export const revalidate = 300

export default async function ConsultationPage() {
  const [contact, branches] = await Promise.all([getSiteContact(), getBranches()])
  const supportDetails = [
    {
      icon: Phone,
      title: "Hotline & Zalo",
      description: contact.hotline,
    },
    {
      icon: Clock3,
      title: "Thời gian phản hồi",
      description: "07:00–21:00 mỗi ngày",
    },
    {
      icon: MapPin,
      title: "Cơ sở",
      description: branches?.length
        ? `${branches.length} điểm tư vấn tại Vĩnh Long`
        : "Các điểm tư vấn tại Vĩnh Long",
    },
  ]

  return (
    <main className="min-h-svh bg-mist">
      <SiteHeader />

      <section className="mx-auto grid max-w-7xl gap-6 px-5 pt-3 pb-6 sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-10">
        <div className="order-0 lg:col-span-2">
          <h1 className="sr-only">Nhận tư vấn khóa học</h1>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary hover:underline"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Về trang chủ
          </Link>
        </div>
        <aside className="order-2 border-t border-primary/15 pt-6 lg:order-1 lg:border-0 lg:pt-4">
          <h2 className="text-xl font-extrabold text-navy">Tư vấn rõ trước khi đăng ký</h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            Không cần chuẩn bị hồ sơ ở bước này. Bạn chỉ cần để lại nhu cầu và thời gian thuận tiện.
          </p>

          <div className="mt-5 flex flex-col gap-4">
            {supportDetails.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-navy">{title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                </div>
              </div>
            ))}
          </div>

          <a
            href={contact.zaloHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary hover:underline"
          >
            <MessageCircle aria-hidden="true" className="size-4" />
            Hoặc nhắn Zalo ngay
          </a>
        </aside>

        <div className="order-1 rounded-md border border-primary/15 bg-background p-5 shadow-[0_20px_55px_-42px_rgba(9,57,102,0.45)] sm:p-6 lg:order-2">
          <ConsultationForm />
        </div>
      </section>
    </main>
  )
}
