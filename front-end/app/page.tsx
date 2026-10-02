import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  Bike,
  Building2,
  CalendarDays,
  CarFront,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

import { AboutTimeline } from "@/components/about-timeline"
import { JourneyTimeline } from "@/components/journey-timeline"
import { NewsCard } from "@/components/news-card"
import { ScrollReveal } from "@/components/scroll-reveal"
import { StickyHeader } from "@/components/sticky-header"
import { TikTokSection } from "@/components/tiktok-section"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { offices } from "@/lib/contact"
import { newsPosts } from "@/lib/news"
import { cn } from "@/lib/utils"
import mainBanner from "@/public/main-banner.png"
import mainMobileBanner from "@/public/main-mobile-banner.png"

const courses = [
  {
    branch: "Chi nhánh Vĩnh Long",
    type: "Xe máy",
    title: "Hạng A & A1",
    description:
      "Hạng A chạy được xe A1 và xe trên 125cc (thi Vespa tay ga hoặc CB250 tay côn). Hạng A1 chạy xe đến 125cc (thi xe Wave).",
    prices: [
      { label: "Hạng A", value: "1.750.000đ" },
      { label: "Hạng A1", value: "620.000đ" },
    ],
    priceNote: "Đã gồm hồ sơ, lý thuyết 2 ngày tập trung, lệ phí thi và cấp bằng",
    extras: ["Xe cảm biến A: 70.000đ/vòng", "Xe cảm biến A1: 20.000đ/vòng", "Thi thử máy tính: 10.000đ/lượt"],
    discounts: ["Có bằng ô tô: miễn lý thuyết, giảm 60.000đ", "HSSV học hạng A: giảm 500.000đ (mang thẻ khi đăng ký)"],
    images: [
      { src: "/vehicles/scooter-a.png", alt: "Xe tay ga thi sát hạch hạng A" },
    ],
    icon: Bike,
    tone: "light",
  },
  {
    branch: "Chi nhánh Vũng Liêm",
    type: "Xe máy",
    title: "Hạng A & A1",
    description:
      "Hạng A chạy được xe A1 và xe trên 125cc (thi Vespa tay ga hoặc CB250 tay côn). Hạng A1 chạy xe đến 125cc (thi xe Wave).",
    prices: [
      { label: "Hạng A", value: "1.595.000đ" },
      { label: "Hạng A1", value: "790.000đ" },
    ],
    priceNote: "Đã gồm hồ sơ, lý thuyết 2 ngày tập trung, lệ phí thi và cấp bằng",
    extras: ["Cảm biến A tay ga Vespa: 50.000đ/vòng", "Cảm biến A tay côn: 40.000đ/vòng", "Cảm biến A1: 20.000đ/vòng"],
    discounts: ["Có bằng ô tô: miễn lý thuyết, giảm 60.000đ"],
    images: [
      { src: "/vehicles/moto-a.png", alt: "Xe mô tô thi sát hạch hạng A" },
    ],
    icon: Bike,
    tone: "light",
  },
  {
    branch: "Tất cả chi nhánh",
    type: "Ô tô",
    title: "Hạng B (sàn & tự động)",
    description:
      "Giáo viên kèm từ đầu đến lúc lấy bằng. Hỗ trợ đóng theo đợt, HSSV giảm thêm 1.000.000đ.",
    prices: [{ label: "Trọn khóa", value: "16.500.000đ" }],
    priceNote: "Đã gồm xăng DAT, xe giờ đêm/xe tự động, giáo viên đến lúc thi",
    extras: ["Khám sức khỏe: tự khám hoặc tại trung tâm", "Cabin mô phỏng: 500.000đ (2 giờ)", "Lệ phí thi: 1.500.000đ", "Thuê xe cảm biến: 300.000–600.000đ/giờ"],
    discounts: ["HSSV giảm thêm 1.000.000đ", "Hỗ trợ đóng theo đợt"],
    images: [{ src: "/vehicles/car-b.png", alt: "Xe tập lái hạng B" }],
    icon: CarFront,
    tone: "dark",
  },
  {
    branch: "Tất cả chi nhánh",
    type: "Ô tô tải",
    title: "Hạng C1",
    description:
      "Giáo viên kèm đến lúc lấy bằng. Hỗ trợ đóng theo đợt, HSSV giảm thêm 1.000.000đ.",
    prices: [{ label: "Trọn khóa", value: "18.900.000đ" }],
    priceNote: "Đã gồm xăng dầu DAT, xe giờ đêm/xe tự động, giáo viên đến lúc thi",
    extras: ["Khám sức khỏe: tự khám hoặc tại trung tâm", "Cabin mô phỏng: 500.000đ (2 giờ)", "Lệ phí thi: 1.500.000đ", "Thuê xe cảm biến: 350.000–600.000đ/giờ"],
    discounts: ["HSSV giảm thêm 1.000.000đ", "Hỗ trợ đóng theo đợt"],
    images: [{ src: "/vehicles/truck-c1.png", alt: "Xe tập lái hạng C1" }],
    icon: CarFront,
    tone: "dark",
  },
]

const motoExtras = [
  "Khám sức khỏe tại sân thi Gia Thịnh: 280.000đ (hoặc khám sẵn bên ngoài)",
  "Sách luật: 50.000đ (tùy nhu cầu)",
  "Sân tập xe cảm biến mở trước kỳ thi khoảng 3 ngày",
]


const registerNotes = [
  "Học phí công khai giá gốc — nên đến trực tiếp văn phòng Gia Thịnh để đăng ký.",
  "Đã có GPLX trước đây phải trình báo cho nhân viên tư vấn khi đăng ký.",
  "Đăng ký xong nhớ lấy biên lai và liên hệ Gia Thịnh để vào nhóm Zalo nhận lịch ôn, thi.",
  "Có hỗ trợ ôn kèm luật 1:1 (phí riêng) nếu có nhu cầu.",
]

const schedules = [
  { license: "A1", date: "14/09/2026", deadline: "Còn 12 chỗ", status: "Đang nhận hồ sơ" },
  { license: "B số tự động", date: "21/09/2026", deadline: "Còn 08 chỗ", status: "Sắp đủ lớp" },
  { license: "B số sàn", date: "05/10/2026", deadline: "Còn 15 chỗ", status: "Đang nhận hồ sơ" },
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

export default function Page() {
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

      <StickyHeader />

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

          <ScrollReveal
            className="mt-12 grid gap-6 lg:grid-cols-2"
            delay={0.08}
            amount="some"
          >
            {courses.map((course) => {
              const isDark = course.tone === "dark"

              return (
                <article
                  key={`${course.branch}-${course.title}`}
                  className={cn(
                    "overflow-hidden rounded-md border p-5 sm:p-9",
                    isDark
                      ? "border-navy bg-navy text-white"
                      : "border-primary/15 bg-background text-foreground"
                  )}
                >
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="order-2 sm:order-1">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={isDark ? "secondary" : "outline"}>{course.type}</Badge>
                        <Badge
                          variant="outline"
                          className={
                            isDark
                              ? "border-white/40 bg-transparent text-white"
                              : ""
                          }
                        >
                          {course.branch}
                        </Badge>
                      </div>
                      <h3 className={cn("mt-5 text-2xl font-extrabold", isDark ? "text-white" : "text-navy")}>{course.title}</h3>
                      <p className={cn("mt-4 max-w-lg text-sm leading-6", isDark ? "text-white/65" : "text-muted-foreground")}>{course.description}</p>
                    </div>
                    {course.images.length === 1 ? (
                      <Image
                        src={course.images[0].src}
                        alt={course.images[0].alt}
                        width={352}
                        height={352}
                        loading="lazy"
                        className="order-1 mx-auto w-32 sm:order-2 sm:mx-0 sm:w-44 sm:shrink-0"
                      />
                    ) : null}
                  </div>

                  <div className={cn("mt-6 rounded-md border p-4 sm:mt-8 sm:p-6", isDark ? "border-white/15 bg-white/[0.06]" : "border-primary/15 bg-gradient-to-br from-primary/[0.08] to-primary/[0.02]")}>
                    <div className="flex flex-col gap-3">
                      {course.prices.map((price) => (
                        <p key={price.label} className="flex items-center justify-between gap-4">
                          <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-bold", isDark ? "bg-white/10 text-white" : "bg-primary/10 text-primary")}>{price.label}</span>
                          <span className={cn("text-lg font-extrabold tracking-tight sm:text-xl", isDark ? "text-white" : "text-navy")}>{price.value}</span>
                        </p>
                      ))}
                    </div>
                    <p className={cn("mt-3 border-t pt-3 text-xs leading-5", isDark ? "border-white/10 text-white/55" : "border-primary/10 text-muted-foreground")}>{course.priceNote}</p>
                  </div>

                  <div className="mt-6 grid gap-6 sm:grid-cols-2">
                    <div>
                      <p className={cn("flex items-center gap-2 text-xs font-semibold", isDark ? "text-signal" : "text-primary")}>
                        <CalendarDays aria-hidden="true" className="size-4" />
                        Chi phí phát sinh
                      </p>
                      <ul className="mt-2 flex flex-col gap-2">
                        {course.extras.map((extra) => (
                          <li key={extra} className={cn("flex items-start gap-2 text-xs leading-5", isDark ? "text-white/70" : "text-muted-foreground")}>
                            <Check aria-hidden="true" className={cn("mt-0.5 size-3.5 shrink-0", isDark ? "text-signal" : "text-primary")} />
                            {extra}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className={cn("flex items-center gap-2 text-xs font-semibold", isDark ? "text-signal" : "text-primary")}>
                        <FileText aria-hidden="true" className="size-4" />
                        Ưu đãi
                      </p>
                      <ul className="mt-2 flex flex-col gap-2">
                        {course.discounts.map((discount) => (
                          <li key={discount} className={cn("flex items-start gap-2 text-xs leading-5", isDark ? "text-white/70" : "text-muted-foreground")}>
                            <Check aria-hidden="true" className={cn("mt-0.5 size-3.5 shrink-0", isDark ? "text-signal" : "text-primary")} />
                            {discount}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <a
                    href="#lien-he"
                    className={cn(
                      buttonVariants({ variant: isDark ? "secondary" : "default", size: "lg" }),
                      "mt-6 h-11 w-full rounded-full sm:mt-8 sm:w-auto"
                    )}
                  >
                    <span className="sm:hidden">Đăng ký</span>
                    <span className="hidden sm:inline">Đăng ký {course.title} — {course.branch}</span>
                    <ArrowRight data-icon="inline-end" aria-hidden="true" />
                  </a>
                </article>
              )
            })}
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
                {registerNotes.map((note) => (
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
              <div className="flex flex-col gap-4">
                {offices.slice(0, 4).map((office) => (
                  <a
                    key={office.name}
                    href={office.map}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Xem bản đồ ${office.name}`}
                    className="group flex flex-1 items-center gap-4 rounded-md border border-primary/15 bg-background px-5 py-4 transition-colors hover:border-primary/40 hover:bg-primary/[0.04]"
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                      <Building2 aria-hidden="true" className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-extrabold text-navy">{office.name}</span>
                      <span className="mt-1.5 block text-sm leading-6 text-muted-foreground">{office.address}</span>
                    </span>
                    <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
                  </a>
                ))}
              </div>
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

            <ScrollReveal className="overflow-hidden rounded-md border border-border" delay={0.08}>
              <div className="hidden grid-cols-[0.7fr_1fr_1fr_1.2fr] gap-4 bg-navy px-6 py-4 text-xs font-semibold text-white/70 sm:grid">
                <span>Hạng bằng</span>
                <span>Khai giảng</span>
                <span>Tình trạng</span>
                <span></span>
              </div>
              {schedules.map((schedule, index) => (
                <div key={schedule.license}>
                  {index > 0 ? <Separator /> : null}
                  <div className="grid gap-4 px-5 py-5 sm:grid-cols-[0.7fr_1fr_1fr_1.2fr] sm:items-center sm:px-6">
                    <strong className="text-navy">Hạng {schedule.license}</strong>
                    <span className="text-sm font-semibold">{schedule.date}</span>
                    <div>
                      <Badge variant={schedule.status === "Sắp đủ lớp" ? "destructive" : "secondary"}>{schedule.status}</Badge>
                      <p className="mt-1 text-xs text-muted-foreground">{schedule.deadline}</p>
                    </div>
                    <a
                      href="#lien-he"
                      className="inline-flex h-11 items-center justify-between gap-2 rounded-md bg-primary/[0.06] px-3.5 text-sm font-bold text-primary transition-colors active:bg-primary/10 sm:h-auto sm:bg-transparent sm:px-0 sm:hover:bg-transparent sm:hover:underline"
                    >
                      Giữ chỗ lớp này
                      <ChevronRight aria-hidden="true" className="size-4" />
                    </a>
                  </div>
                </div>
              ))}
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

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {newsPosts.slice(0, 4).map((post, index) => (
              <ScrollReveal key={post.slug} delay={0.05 * index}>
                <NewsCard post={post} />
              </ScrollReveal>
            ))}
          </div>
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
              <a href="tel:0779666664" className="mt-2 flex min-h-11 items-center justify-center text-3xl font-extrabold tracking-tight text-white hover:text-signal sm:text-4xl">
                0779 666 664
              </a>
              <p className="mt-2 text-xs text-white/55">Tư vấn 07:00–21:00 mỗi ngày</p>
              <div className="mt-6 flex flex-col gap-3">
                <a href="tel:0779666664" className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "h-11 rounded-full px-5")}>
                  <Phone data-icon="inline-start" aria-hidden="true" />
                  Gọi ngay
                </a>
                <a href="https://zalo.me/0779666664" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 rounded-full border-white/30 bg-transparent px-5 text-white hover:bg-white/10 hover:text-white")}>
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
