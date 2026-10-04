import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  Building2,
  Check,
  ChevronRight,
  Clock3,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

import { AboutTimeline } from "@/components/about-timeline"
import { ClassSchedule } from "@/components/class-schedule"
import { ExamSchedule } from "@/components/exam-schedule"
import { JourneyTimeline } from "@/components/journey-timeline"
import { NewsCard } from "@/components/news-card"
import { OfficeList } from "@/components/office-list"
import { PricingSection } from "@/components/pricing-section"
import { ScrollReveal } from "@/components/scroll-reveal"
import { SiteHeader } from "@/components/site-header"
import { TikTokSection } from "@/components/tiktok-section"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  getBranches,
  getLatestPosts,
  getPricing,
  getSiteContact,
  getUpcomingClasses,
  getUpcomingExams,
} from "@/lib/api/public"
import { toNewsPost } from "@/lib/news"
import { cn } from "@/lib/utils"
import mainBanner from "@/public/main-banner.png"
import mainMobileBanner from "@/public/main-mobile-banner.png"

const motoExtras = [
  "Khám sức khỏe tại sân thi Gia Thịnh: 280.000đ (hoặc khám sẵn bên ngoài)",
  "Sách luật: 50.000đ (tùy nhu cầu)",
  "Sân tập xe cảm biến mở trước kỳ thi khoảng 3 ngày",
]

const process = [
  {
    title: "Tư vấn đúng hạng",
    text: "Kiểm tra nhu cầu, điều kiện sức khỏe và thời gian học phù hợp.",
  },
  {
    title: "Hoàn thiện hồ sơ",
    text: "Nhân viên rà soát giấy tờ và thông báo rõ mọi khoản phí.",
  },
  {
    title: "Học và luyện thi",
    text: "Theo dõi tiến độ lý thuyết, mô phỏng và thực hành từng buổi.",
  },
  {
    title: "Thi sát hạch",
    text: "Nhận lịch thi, hướng dẫn thủ tục và đồng hành đến ngày nhận bằng.",
  },
]

export const revalidate = 300

export default async function Page() {
  const [contact, branches, pricing, classes, exams, latest] = await Promise.all([
    getSiteContact(),
    getBranches(),
    getPricing(),
    getUpcomingClasses(),
    getUpcomingExams(),
    getLatestPosts(4),
  ])
  // latest null = API lỗi: hiện thông báo dự phòng kèm hotline, khác với chưa có bài
  const latestPosts = latest ? latest.map(toNewsPost) : null

  return (
    <main className="min-h-svh overflow-x-clip bg-background">
      <div className="bg-navy text-white">
        <div className="mx-auto flex min-h-9 max-w-7xl items-center justify-between gap-4 px-5 py-2 text-xs sm:px-8">
          <p className="flex min-w-0 items-center gap-2 leading-5">
            <MapPin aria-hidden="true" className="size-3.5 shrink-0 text-signal" />
            331A Tân Ngãi, Vĩnh Long · TT GDTX Vũng Liêm
          </p>
          <p className="hidden items-center gap-2 sm:flex">
            <Clock3 aria-hidden="true" className="size-3.5 text-signal" />
            Tư vấn 07:00–21:00 mỗi ngày
          </p>
        </div>
      </div>

      <SiteHeader />

      <section className="relative overflow-hidden border-b border-border/60 bg-background lg:h-[40vw] lg:min-h-[480px]">
        <div
          aria-hidden="true"
          className="absolute inset-0 hidden bg-cover bg-center bg-no-repeat lg:block"
          style={{ backgroundImage: `url(${mainBanner.src})` }}
        />
        <div className="relative px-5 pt-5 pb-8 sm:px-8 lg:hidden">
          <Image
            src={mainMobileBanner}
            alt="Giáo viên Gia Thịnh hướng dẫn học viên thực hành lái xe"
            loading="eager"
            className="h-auto w-full rounded-md object-cover"
          />
        </div>
        <div className="relative mx-auto flex max-w-7xl items-center px-5 pb-8 sm:px-8 lg:h-full lg:items-start lg:py-0 lg:pt-20">
          <ScrollReveal className="max-w-2xl lg:max-w-[40%]">
            <Badge className="mb-4 rounded-full px-3 py-1 lg:mb-3" variant="secondary">
              <Sparkles data-icon="inline-start" aria-hidden="true" />
              Tuyển sinh liên tục tháng 09/2026
            </Badge>
            <h1 className="text-4xl font-extrabold leading-[1.08] tracking-[-0.045em] text-navy sm:text-5xl lg:text-[2.75rem]">
              <span className="block font-hand font-bold tracking-normal text-primary">
                              Học đúng lộ trình
                            </span>
              <span className="block">Vững tay lái. Tự tin ngày thi.</span>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg lg:mt-3 lg:text-base">
              Đào tạo xe máy và ô tô với học phí minh bạch, lịch học linh hoạt và giáo viên theo sát từng buổi thực hành.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-4">
              <Link
                href="/tu-van"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "relative isolate h-11 rounded-full pr-6 has-data-[icon=inline-start]:pl-5 shadow-[0_10px_28px_-10px_color-mix(in_oklch,var(--primary)_75%,transparent)] hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-10px_color-mix(in_oklch,var(--primary)_85%,transparent)]"
                )}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-1 -z-10 rounded-full bg-primary/25 blur-md motion-safe:animate-pulse animation-duration-[2.4s]"
                />
                <MessageCircle data-icon="inline-start" aria-hidden="true" />
                Nhận tư vấn miễn phí
              </Link>
              <a
                href="#khoa-hoc"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-11 rounded-full border-primary/25 bg-white pl-5 text-primary has-data-[icon=inline-end]:pr-5"
                )}
              >
                Xem khóa đang tuyển
                <ArrowRight data-icon="inline-end" aria-hidden="true" />
              </a>
            </div>
            <div className="mt-6 grid max-w-lg grid-cols-3 gap-4 border-t border-primary/15 pt-4 sm:gap-5 lg:mt-4">
              <div>
                <strong className="block text-2xl font-extrabold text-navy">14+</strong>
                <span className="text-xs leading-5 text-muted-foreground">Năm đào tạo</span>
              </div>
              <div>
                <strong className="block text-2xl font-extrabold text-navy">8.600+</strong>
                <span className="text-xs leading-5 text-muted-foreground">Học viên tốt nghiệp</span>
              </div>
              <div>
                <strong className="block text-2xl font-extrabold text-navy">96%</strong>
                <span className="text-xs leading-5 text-muted-foreground">Đạt ngay lần đầu</span>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section id="gioi-thieu" className="bg-background py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <AboutTimeline />
        </div>
      </section>

      <section id="khoa-hoc" className="bg-mist py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <ScrollReveal className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <Badge variant="secondary" className="mb-5">Khóa học đang tuyển</Badge>
              <h2 className="text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
                Chọn hạng bằng phù hợp với bạn
              </h2>
            </div>
          </ScrollReveal>

          <ScrollReveal className="mt-12" delay={0.08} amount="some">
            <PricingSection pricing={pricing} hotline={{ display: contact.hotline, telHref: contact.telHref }} />
          </ScrollReveal>

          <ScrollReveal className="mt-6 grid gap-6 lg:grid-cols-2" delay={0.1}>
            <div className="rounded-md border border-primary/15 bg-background p-7 sm:p-8">
              <h3 className="text-lg font-extrabold text-navy">Lưu ý chung cho hạng A & A1</h3>
              <ul className="mt-4 flex flex-col gap-2.5">
                {motoExtras.map((extra) => (
                  <li key={extra} className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                    <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-signal" />
                    {extra}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-md border border-primary/15 bg-background p-7 sm:p-8">
              <h3 className="text-lg font-extrabold text-navy">Trước khi đăng ký</h3>
              <ul className="mt-4 flex flex-col gap-2.5">
                {contact.registerNotes.map((note) => (
                  <li key={note} className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                    <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-signal" />
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          <ScrollReveal className="mt-12" delay={0.08}>
            <div className="flex items-center gap-2">
              <MapPin aria-hidden="true" className="size-5 text-primary" />
              <h3 className="text-xl font-extrabold text-navy sm:text-2xl">Hệ thống văn phòng Gia Thịnh</h3>
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="overflow-hidden rounded-md border border-primary/15 bg-background">
                <iframe
                  title="Bản đồ văn phòng chính Gia Thịnh tại Vũng Liêm"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d7853.740089955028!2d106.17797439357913!3d10.061406499999999!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31a00d13ffffffff%3A0x91c156ee68037d66!2zVHQgR2nDoW8gROG7pWMgVGjGsOG7nW5nIFh1ecOqbiBIdXnhu4duIFbFqW5nIExpw6pt!5e0!3m2!1svi!2sus!4v1789315363299!5m2!1svi!2sus"
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  className="h-80 w-full border-0 sm:h-96"
                />
                <div className="px-5 py-4 sm:px-6">
                  <a
                    href="https://www.google.com/maps/search/?api=1&query=Trung+t%C3%A2m+GDNN+GDTX+V%C5%A9ng+Li%C3%AAm+V%C4%A9nh+Long"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Xem bản đồ VP Vũng Liêm"
                    className="group flex items-center gap-3"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                      <Building2 aria-hidden="true" className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-extrabold text-navy">VP Vũng Liêm</span>
                      <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                        TT GDTX Vũng Liêm, QL 53, xã Trung Thành, T. Vĩnh Long
                      </span>
                    </span>
                    <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
                  </a>
                </div>
              </div>
              <OfficeList branches={branches} />
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section id="lich-khai-giang" className="bg-background py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
            <ScrollReveal>
              <p className="mb-4 font-hand text-3xl font-bold text-primary sm:text-4xl">Lịch mới nhất</p>
              <h2 className="text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">Theo dõi lớp sắp khai giảng</h2>
              <p className="mt-5 leading-7 text-muted-foreground">Lịch được cập nhật theo số lượng hồ sơ thực tế. Giữ chỗ trước, hoàn thiện giấy tờ sau.</p>
            </ScrollReveal>

            <ScrollReveal delay={0.08}>
              <ClassSchedule classes={classes} />
            </ScrollReveal>
          </div>
        </div>
      </section>

      <section id="lich-thi" className="bg-mist py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
            <ScrollReveal>
              <p className="mb-4 font-hand text-3xl font-bold text-primary sm:text-4xl">Lịch thi</p>
              <h2 className="text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">Các ca thi sắp tới</h2>
              <p className="mt-5 leading-7 text-muted-foreground">
                Học viên nhận lịch chính thức qua nhóm Zalo của lớp. Bảng dưới để theo dõi nhanh.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={0.08}>
              <ExamSchedule exams={exams} />
            </ScrollReveal>
          </div>
        </div>
      </section>

      <section className="bg-background py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <ScrollReveal className="max-w-2xl">
            <p className="mb-4 font-hand text-3xl font-bold text-primary sm:text-4xl">Lộ trình nhập học</p>
            <h2 className="text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">Bốn bước rõ ràng từ tư vấn đến sát hạch</h2>
          </ScrollReveal>
          <JourneyTimeline steps={process} />
        </div>
      </section>

      <section id="tin-tuc" className="bg-mist py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <ScrollReveal className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="mb-4 font-hand text-3xl font-bold text-primary sm:text-4xl">Tin tức mới nhất</p>
              <h2 className="text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
                Kinh nghiệm thi & thông báo mới
              </h2>
            </div>
            <Link href="/dien-dan" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary hover:underline">
              Xem tất cả tin tức
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </ScrollReveal>

          {latestPosts === null ? (
            <p className="mt-12 text-muted-foreground">
              Tin tức đang được cập nhật, vui lòng gọi hotline{" "}
              <a href={contact.telHref} className="font-bold text-primary hover:underline">
                {contact.hotline}
              </a>{" "}
              để được hỗ trợ.
            </p>
          ) : latestPosts.length > 0 ? (
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {latestPosts.map((post, index) => (
                <ScrollReveal key={post.slug} delay={0.05 * index}>
                  <NewsCard post={post} />
                </ScrollReveal>
              ))}
            </div>
          ) : (
            <p className="mt-12 text-muted-foreground">Chưa có bài viết mới.</p>
          )}
        </div>
      </section>

      <TikTokSection />

      <section id="lien-he" className="pb-12 sm:pb-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="relative overflow-hidden rounded-md bg-navy px-6 py-12 text-white sm:px-12 lg:px-16 lg:py-16">
          <div className="relative grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-bold text-signal">
                <ShieldCheck aria-hidden="true" className="size-4" />
                Tư vấn đúng nhu cầu, không ép nhập học
              </div>
              <h2 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">Bạn chưa biết nên học hạng nào?</h2>
              <p className="mt-4 max-w-xl leading-7 text-white/70">Gọi hoặc nhắn Zalo, đội ngũ Gia Thịnh sẽ kiểm tra điều kiện và gửi lịch học phù hợp trong ít phút.</p>
              <ul className="mt-6 flex flex-col gap-2.5 text-sm text-white/75">
                <li className="flex items-center gap-2.5">
                  <Check aria-hidden="true" className="size-4 shrink-0 text-signal" />
                  Học phí công khai giá gốc theo từng chi nhánh
                </li>
                <li className="flex items-center gap-2.5">
                  <Check aria-hidden="true" className="size-4 shrink-0 text-signal" />
                  Hỗ trợ đóng theo đợt, HSSV được giảm thêm
                </li>
                <li className="flex items-center gap-2.5">
                  <Check aria-hidden="true" className="size-4 shrink-0 text-signal" />
                  Đồng hành từ buổi học đầu đến ngày nhận bằng
                </li>
              </ul>
            </div>
            <div className="rounded-md border border-white/15 bg-white/[0.07] p-6 text-center sm:p-8">
              <p className="text-xs font-bold tracking-[0.14em] text-white/60 uppercase">Hotline hỗ trợ (Zalo)</p>
              <a href={contact.telHref} className="mt-2 flex min-h-11 items-center justify-center text-3xl font-extrabold tracking-tight text-white hover:text-signal sm:text-4xl">
                {contact.hotline}
              </a>
              <p className="mt-2 text-xs text-white/55">Tư vấn 07:00–21:00 mỗi ngày</p>
              <div className="mt-6 flex flex-col gap-3">
                <a href={contact.telHref} className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "h-11 rounded-full px-5")}>
                  <Phone data-icon="inline-start" aria-hidden="true" />
                  Gọi ngay
                </a>
                <a href={contact.zaloHref} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 rounded-full border-white/30 bg-transparent px-5 text-white hover:bg-white/10 hover:text-white")}>
                  <MessageCircle data-icon="inline-start" aria-hidden="true" />
                  Nhắn Zalo
                </a>
              </div>
            </div>
          </div>
        </div>
        </div>
      </section>

    </main>
  )
}
