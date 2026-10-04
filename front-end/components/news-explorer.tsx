"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  CalendarDays,
  Megaphone,
  MessageCircle,
  Phone,
  RotateCcw,
  Search,
  SearchX,
  X,
} from "lucide-react"

import {
  countPostsByCategory,
  newsMatchesQuery,
  sortNewsPosts,
  type NewsCategory,
  type NewsPost,
  type NewsSortKey,
} from "@/lib/news"
import { HighlightMatch } from "@/components/highlight-match"
import { NewsCard } from "@/components/news-card"
import { ScrollReveal } from "@/components/scroll-reveal"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { toSiteContact, type SiteContact } from "@/lib/public/contact"
import { cn } from "@/lib/utils"

const ALL_CATEGORIES = "all"

const SORT_LABELS: Record<NewsSortKey, string> = {
  newest: "Mới nhất trước",
  oldest: "Cũ nhất trước",
  title: "Tiêu đề A → Z",
}

const SORT_ITEMS = (Object.keys(SORT_LABELS) as NewsSortKey[]).map((value) => ({
  value,
  label: SORT_LABELS[value],
}))

/** Trạng thái đang chọn: viền và nền theo màu thương hiệu thay vì xám mặc định. */
const PRESSED_ITEM =
  "aria-pressed:border-primary/50 aria-pressed:bg-primary/10 aria-pressed:text-primary aria-pressed:hover:text-primary"

function CategoryItems({
  categories,
  total,
  counts,
  itemClassName,
}: {
  categories: NewsCategory[]
  total: number
  counts: Record<string, number>
  itemClassName?: string
}) {
  return (
    <>
      <ToggleGroupItem value={ALL_CATEGORIES} className={cn(PRESSED_ITEM, itemClassName)}>
        Tất cả
        <Badge variant="secondary" className="font-bold tabular-nums">
          {total}
        </Badge>
      </ToggleGroupItem>
      {categories.map((category) => (
        <ToggleGroupItem
          key={category.slug}
          value={category.slug}
          className={cn(PRESSED_ITEM, itemClassName)}
        >
          {category.name}
          <Badge variant="secondary" className="font-bold tabular-nums">
            {counts[category.slug] ?? 0}
          </Badge>
        </ToggleGroupItem>
      ))}
    </>
  )
}

/** Khối thông báo: bố cục dạng bảng tin, khác hẳn card bài viết có ảnh. */
function AnnouncementList({ posts, query }: { posts: NewsPost[]; query?: string }) {
  return (
    <section className="mt-6 overflow-hidden rounded-md border border-border border-l-4 border-l-primary bg-mist/70">
      <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
        <Megaphone aria-hidden="true" className="size-4 shrink-0 text-primary" />
        <h3 className="text-xs font-extrabold tracking-[0.14em] text-navy uppercase">
          Thông báo từ trung tâm
        </h3>
        <span className="ml-auto text-xs font-bold text-muted-foreground tabular-nums">
          {posts.length}
        </span>
      </div>
      <ul className="divide-y divide-border/70">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link
              href={`/dien-dan/${post.slug}`}
              className="flex gap-3 px-4 py-4 sm:gap-4"
            >
              <span className="relative block h-14 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-background sm:h-16 sm:w-24">
                {post.image ? (
                  <Image
                    src={post.image}
                    alt={post.imageAlt}
                    fill
                    unoptimized
                    sizes="(max-width: 640px) 80px, 96px"
                    loading="lazy"
                    className="object-cover"
                  />
                ) : (
                  <Image src="/giathinh-logo.png" alt="" fill sizes="96px" className="object-contain p-2 opacity-60" />
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col justify-center">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary tabular-nums">
                  <CalendarDays aria-hidden="true" className="size-3.5" />
                  {post.date}
                </span>
                <span className="mt-2 block font-bold text-navy">
                  <HighlightMatch text={post.title} query={query} />
                </span>
                <span className="mt-1 text-sm leading-6 text-muted-foreground line-clamp-2">
                  <HighlightMatch text={post.excerpt} query={query} />
                </span>
              </span>
              <ArrowRight
                aria-hidden="true"
                className="hidden size-4 shrink-0 self-center text-primary sm:block"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

// Hotline lấy ở server (trang /dien-dan); thiếu thì dùng giá trị mặc định
const DEFAULT_CONTACT = toSiteContact(null)

export function NewsExplorer({
  posts,
  categories,
  contact = DEFAULT_CONTACT,
}: {
  posts: NewsPost[]
  categories: NewsCategory[]
  contact?: Pick<SiteContact, "hotline" | "telHref" | "zaloHref">
}) {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<string>(ALL_CATEGORIES)
  const [sort, setSort] = useState<NewsSortKey>("newest")

  const trimmedQuery = query.trim()
  const searching = trimmedQuery.length > 0
  // Chuyên mục thông báo hiện thành khối riêng, không nằm trong bộ lọc
  const filterCategories = useMemo(
    () => categories.filter((item) => !item.isAnnouncement),
    [categories],
  )
  const activeCategory = categories.find((item) => item.slug === category)

  const matched = useMemo(
    () => (trimmedQuery ? posts.filter((post) => newsMatchesQuery(post, trimmedQuery)) : posts),
    [posts, trimmedQuery],
  )
  const counts = useMemo(() => countPostsByCategory(matched), [matched])
  const filtered = useMemo(() => {
    const sameCategory =
      category === ALL_CATEGORIES
        ? matched
        : matched.filter((post) => post.categorySlug === category)
    return sortNewsPosts(sameCategory, sort)
  }, [matched, category, sort])

  const announcements = useMemo(
    () => filtered.filter((post) => post.isAnnouncement),
    [filtered],
  )
  const articles = useMemo(
    () => filtered.filter((post) => !post.isAnnouncement),
    [filtered],
  )

  function handleCategoryChange(next: readonly string[]) {
    setCategory(next[0] ?? ALL_CATEGORIES)
  }

  function handleSortChange(value: unknown) {
    if (value === "newest" || value === "oldest" || value === "title") setSort(value)
  }

  function resetFilters() {
    setQuery("")
    setCategory(ALL_CATEGORIES)
  }

  return (
    <>
      <section className="relative overflow-hidden border-b border-border/60 bg-mist">
        <div aria-hidden="true" className="road-dots absolute inset-0" />
        <div className="relative mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] lg:items-end">
            <ScrollReveal>
              <h1 className="text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
                Kinh nghiệm thi &amp; thông báo mới nhất
              </h1>
            </ScrollReveal>

            <ScrollReveal delay={0.08}>
              <Field>
                <FieldLabel htmlFor="news-search" className="sr-only">
                  Tìm kiếm bài viết
                </FieldLabel>
                <InputGroup className="h-12 rounded-md border-primary/25 bg-background shadow-[0_14px_34px_-28px_color-mix(in_oklch,var(--primary)_85%,transparent)]">
                  <InputGroupInput
                    id="news-search"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Ví dụ: học phí, sa hình, DAT…"
                    className="h-12 text-base [&::-webkit-search-cancel-button]:appearance-none"
                  />
                  <InputGroupAddon align="inline-start" className="pl-3">
                    <Search aria-hidden="true" className="text-muted-foreground" />
                  </InputGroupAddon>
                  {searching ? (
                    <InputGroupAddon align="inline-end" className="pr-2">
                      <InputGroupButton
                        size="icon-sm"
                        aria-label="Xoá từ khoá tìm kiếm"
                        onClick={() => setQuery("")}
                      >
                        <X aria-hidden="true" />
                      </InputGroupButton>
                    </InputGroupAddon>
                  ) : null}
                </InputGroup>
              </Field>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0">
              <div className="lg:hidden">
                <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
                  Chuyên mục
                </p>
                {/* Mobile: dải chip 1 hàng cuộn ngang để không đẩy nội dung xuống; sm+ mới xuống dòng */}
                <ToggleGroup
                  variant="outline"
                  value={[category]}
                  onValueChange={handleCategoryChange}
                  className="mt-3 flex w-full flex-nowrap overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible sm:py-0"
                >
                  <CategoryItems
                    categories={filterCategories}
                    total={matched.length}
                    counts={counts}
                    itemClassName="h-11 px-3.5"
                  />
                </ToggleGroup>
              </div>

              <div className="mt-6 flex flex-wrap items-end justify-between gap-4 lg:mt-0">
                <div className="min-w-0">
                  <h2 className="text-xl font-extrabold tracking-tight text-navy sm:text-2xl">
                    {activeCategory
                      ? activeCategory.name
                      : searching
                        ? "Kết quả tìm kiếm"
                        : "Tất cả bài viết"}
                  </h2>
                  {activeCategory?.description ? (
                    <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground">
                      {activeCategory.description}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center gap-3">
                  <p
                    aria-live="polite"
                    className="text-sm font-semibold text-muted-foreground tabular-nums"
                  >
                    {filtered.length} bài viết
                  </p>
                  <Select items={SORT_ITEMS} value={sort} onValueChange={handleSortChange}>
                    <SelectTrigger
                      aria-label="Sắp xếp bài viết"
                      className="rounded-md border-border bg-card data-[size=default]:h-11 sm:data-[size=default]:h-9"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      alignItemWithTrigger={false}
                      className="w-max min-w-(--anchor-width)"
                    >
                      <SelectGroup>
                        {SORT_ITEMS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {announcements.length > 0 ? (
                <AnnouncementList posts={announcements} query={trimmedQuery} />
              ) : null}

              {articles.length > 0 ? (
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {articles.map((post) => (
                    <NewsCard key={post.slug} post={post} query={trimmedQuery} />
                  ))}
                </div>
              ) : null}

              {posts.length === 0 ? (
                <p className="mt-6 text-muted-foreground">Chưa có bài viết.</p>
              ) : filtered.length === 0 ? (
                <Empty className="mt-6 rounded-md border border-dashed border-border bg-card py-14">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <SearchX aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle className="text-base font-extrabold text-navy">
                      Không tìm thấy bài viết
                    </EmptyTitle>
                    <EmptyDescription>
                      {searching ? (
                        <>Không có bài viết nào khớp với “{trimmedQuery}”.</>
                      ) : (
                        <>Chuyên mục này chưa có bài viết.</>
                      )}{" "}
                      Bạn thử từ khoá ngắn hơn hoặc xem lại tất cả bài viết nhé.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={resetFilters}
                      className="h-10 rounded-full px-5 font-bold"
                    >
                      <RotateCcw data-icon="inline-start" aria-hidden="true" />
                      Xoá bộ lọc
                    </Button>
                  </EmptyContent>
                </Empty>
              ) : null}
            </div>

            <aside className="min-w-0">
              <div className="flex flex-col gap-5 lg:sticky lg:top-24">
                <div className="hidden rounded-md border border-border bg-card p-4 lg:block">
                  <p className="text-[15px] font-bold text-navy">Chuyên mục</p>
                  <ToggleGroup
                    orientation="vertical"
                    variant="outline"
                    value={[category]}
                    onValueChange={handleCategoryChange}
                    className="mt-3 w-full"
                  >
                    <CategoryItems
                      categories={filterCategories}
                      total={matched.length}
                      counts={counts}
                      itemClassName="h-10 justify-between px-3 text-sm font-semibold"
                    />
                  </ToggleGroup>
                </div>

                <div className="rounded-md bg-navy p-6 text-center text-white">
                  <p className="font-extrabold">Cần tư vấn khóa học?</p>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    Phản hồi trong ít phút qua Zalo / điện thoại.
                  </p>
                  <div className="mt-4 flex flex-col gap-2">
                    <a
                      href={contact.telHref}
                      className={cn(
                        buttonVariants({ variant: "secondary", size: "lg" }),
                        "h-11 rounded-full px-6",
                      )}
                    >
                      <Phone data-icon="inline-start" aria-hidden="true" />
                      {contact.hotline}
                    </a>
                    <a
                      href={contact.zaloHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        buttonVariants({ variant: "outline", size: "lg" }),
                        "h-11 rounded-full border-white/30 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <MessageCircle data-icon="inline-start" aria-hidden="true" />
                      Nhắn Zalo
                    </a>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  )
}
