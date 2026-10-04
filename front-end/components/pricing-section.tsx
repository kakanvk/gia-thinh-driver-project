"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, CalendarDays, Check, FileText } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { consultHref, formatPricingItem, formatVnd, VEHICLE_LABELS } from "@/lib/public/format"
import type { BranchPricing, PricingCourse, PricingItem } from "@/lib/public/types"
import { cn } from "@/lib/utils"

type Hotline = { display: string; telHref: string }

function ItemList({
  title,
  icon: Icon,
  items,
  isDark,
}: {
  title: string
  icon: typeof CalendarDays
  items: PricingItem[]
  isDark: boolean
}) {
  return (
    <div>
      <p className={cn("flex items-center gap-2 text-xs font-semibold", isDark ? "text-signal" : "text-primary")}>
        <Icon aria-hidden="true" className="size-4" />
        {title}
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {items.map((item) => (
          <li
            key={item.key}
            className={cn("flex items-start gap-2 text-xs leading-5", isDark ? "text-white/70" : "text-muted-foreground")}
          >
            <Check aria-hidden="true" className={cn("mt-0.5 size-3.5 shrink-0", isDark ? "text-signal" : "text-primary")} />
            {formatPricingItem(item)}
          </li>
        ))}
      </ul>
    </div>
  )
}

function CourseCard({ course, branch }: { course: PricingCourse; branch: BranchPricing["branch"] }) {
  const isDark = course.vehicleType !== "moto"
  const hasFees = course.fees.length > 0
  const hasDiscounts = course.discounts.length > 0

  return (
    <article
      className={cn(
        "overflow-hidden rounded-md border p-5 sm:p-9",
        isDark ? "border-navy bg-navy text-white" : "border-primary/15 bg-background text-foreground"
      )}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="order-2 sm:order-1">
          <div className="flex flex-wrap gap-2">
            <Badge variant={isDark ? "secondary" : "outline"}>{VEHICLE_LABELS[course.vehicleType]}</Badge>
            <Badge variant="outline" className={isDark ? "border-white/40 bg-transparent text-white" : ""}>
              {branch.name}
            </Badge>
          </div>
          <h3 className={cn("mt-5 text-2xl font-extrabold", isDark ? "text-white" : "text-navy")}>{course.name}</h3>
          {course.description ? (
            <p className={cn("mt-4 max-w-lg text-sm leading-6", isDark ? "text-white/65" : "text-muted-foreground")}>
              {course.description}
            </p>
          ) : null}
        </div>
        {course.image ? (
          <Image
            src={course.image.url}
            alt={course.image.alt || course.name}
            width={352}
            height={352}
            loading="lazy"
            unoptimized
            className="order-1 mx-auto w-32 sm:order-2 sm:mx-0 sm:w-44 sm:shrink-0"
          />
        ) : null}
      </div>

      <div
        className={cn(
          "mt-6 rounded-md border p-4 sm:mt-8 sm:p-6",
          isDark
            ? "border-white/15 bg-white/[0.06]"
            : "border-primary/15 bg-gradient-to-br from-primary/[0.08] to-primary/[0.02]"
        )}
      >
        <p className="flex items-center justify-between gap-4">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold",
              isDark ? "bg-white/10 text-white" : "bg-primary/10 text-primary"
            )}
          >
            Học phí
          </span>
          <span className={cn("text-lg font-extrabold tracking-tight sm:text-xl", isDark ? "text-white" : "text-navy")}>
            {formatVnd(course.price)}
          </span>
        </p>
        {course.priceNote || course.duration ? (
          <div
            className={cn(
              "mt-3 flex flex-col gap-1 border-t pt-3 text-xs leading-5",
              isDark ? "border-white/10 text-white/55" : "border-primary/10 text-muted-foreground"
            )}
          >
            {course.priceNote ? <p>{course.priceNote}</p> : null}
            {course.duration ? <p>Thời lượng: {course.duration}</p> : null}
          </div>
        ) : null}
      </div>

      {hasFees || hasDiscounts ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {hasFees ? <ItemList title="Chi phí phát sinh" icon={CalendarDays} items={course.fees} isDark={isDark} /> : null}
          {hasDiscounts ? <ItemList title="Ưu đãi" icon={FileText} items={course.discounts} isDark={isDark} /> : null}
        </div>
      ) : null}

      <Link
        href={consultHref(branch.slug, course.code)}
        className={cn(
          buttonVariants({ variant: isDark ? "secondary" : "default", size: "lg" }),
          "mt-6 h-11 w-full rounded-full sm:mt-8 sm:w-auto"
        )}
      >
        Tư vấn gói này
        <ArrowRight data-icon="inline-end" aria-hidden="true" />
      </Link>
    </article>
  )
}

export function PricingSection({ pricing, hotline }: { pricing: BranchPricing[] | null; hotline: Hotline }) {
  if (!pricing || pricing.length === 0) {
    return (
      <div className="rounded-md border border-primary/15 bg-background p-7">
        <p className="text-sm leading-6 text-muted-foreground">
          Học phí đang được cập nhật. Gọi{" "}
          <a href={hotline.telHref} className="font-bold text-primary hover:underline">
            {hotline.display}
          </a>{" "}
          để được báo giá mới nhất.
        </p>
      </div>
    )
  }

  return (
    <Tabs defaultValue={pricing[0].branch.slug} className="gap-6">
      <TabsList
        aria-label="Chọn chi nhánh"
        className="-mx-1 flex w-full justify-start gap-2 overflow-x-auto rounded-none bg-transparent px-1 pt-0 pb-1 group-data-horizontal/tabs:h-auto"
      >
        {pricing.map((item) => (
          <TabsTrigger
            key={item.branch.slug}
            value={item.branch.slug}
            className={cn(
              "h-auto min-h-11 flex-none shrink-0 rounded-full border-primary/15 bg-background px-4 py-0 text-sm font-bold text-navy transition-colors hover:bg-primary/5 hover:text-navy",
              "data-active:border-transparent data-active:bg-primary data-active:text-primary-foreground data-active:shadow-none data-active:hover:bg-primary",
              "dark:data-active:border-transparent dark:data-active:bg-primary dark:data-active:text-primary-foreground"
            )}
          >
            {item.branch.officeName || item.branch.name}
          </TabsTrigger>
        ))}
      </TabsList>

      {pricing.map((item) => (
        <TabsContent key={item.branch.slug} value={item.branch.slug}>
          {item.courses.length === 0 ? (
            <p className="rounded-md border border-primary/15 bg-background p-7 text-sm leading-6 text-muted-foreground">
              Chi nhánh này chưa công bố học phí trực tuyến, vui lòng gọi hotline để được báo giá.
            </p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {item.courses.map((course) => (
                <CourseCard key={course.code} course={course} branch={item.branch} />
              ))}
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  )
}
