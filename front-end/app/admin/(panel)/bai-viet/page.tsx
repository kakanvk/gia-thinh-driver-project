import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import {
  Eye,
  FileText,
  MessageSquareText,
  MoreHorizontal,
  Newspaper,
  Plus,
} from "lucide-react"

import {
  AdminPageHeader,
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
import { adminPosts } from "@/lib/admin-data"

export const metadata: Metadata = {
  title: "Bài viết",
}

const categoryItems = [
  { label: "Tất cả chuyên mục", value: "all" },
  ...Array.from(new Set(adminPosts.map((post) => post.category))).map(
    (category) => ({ label: category, value: category })
  ),
]

export default function PostsPage() {
  const publishedViews = adminPosts.reduce(
    (total, post) => total + (Number(post.views.replace(/\./g, "")) || 0),
    0
  )

  return (
    <main id="admin-content" className="p-4">
      <AdminPageHeader
        title="Quản lý bài viết"
        action={
          <Link
            href="/admin/bai-viet/tao-moi"
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-primary/85"
          >
            <Plus aria-hidden="true" className="size-4" />
            Tạo bài viết
          </Link>
        }
      />

      <section
        aria-label="Thống kê nội dung"
        className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {[
          [Newspaper, "Tin đã xuất bản", "24", "+4 tháng này"],
          [FileText, "Bản nháp", "6", "2 bài đang biên tập"],
          [MessageSquareText, "Chờ duyệt", "5", "Cần xử lý hôm nay"],
          [
            Eye,
            "Lượt xem",
            publishedViews.toLocaleString("vi-VN"),
            "Cộng dồn các bài đã đăng",
          ],
        ].map(([Icon, label, value, note]) => {
          const StatIcon = Icon as typeof FileText
          return (
            <article
              key={String(label)}
              className="rounded-lg border border-border/70 bg-background p-4"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                  <StatIcon aria-hidden="true" className="size-4" />
                </span>
                <p className="text-[13px] font-medium text-muted-foreground">
                  {String(label)}
                </p>
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <p className="text-2xl font-bold tracking-tight text-navy">
                  {String(value)}
                </p>
                <p className="truncate text-right text-[11px] text-muted-foreground">
                  {String(note)}
                </p>
              </div>
            </article>
          )
        })}
      </section>

      <section className="mt-4 overflow-hidden rounded-lg border border-border/70 bg-background">
        <TableToolbar
          searchLabel="Tìm bài viết"
          searchPlaceholder="Tìm theo tiêu đề hoặc tác giả..."
          summary={`${adminPosts.length} bài viết gần đây`}
          action={
            <Select items={categoryItems} defaultValue="all">
              <SelectTrigger
                aria-label="Lọc theo chuyên mục"
                className="min-h-9 rounded-md text-[13px] font-medium"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                alignItemWithTrigger={false}
                className="shadow-none"
              >
                <SelectGroup>
                  {categoryItems.map((item) => (
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
          <table className="w-full min-w-[1000px] text-left text-[13px]">
            <thead className="bg-muted/60 text-[11px] tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="w-12 px-5 py-3 text-center font-semibold">#</th>
                <th className="px-3 py-3 font-semibold">Bài viết</th>
                <th className="px-3 py-3 font-semibold">Chuyên mục</th>
                <th className="px-3 py-3 font-semibold">Tác giả</th>
                <th className="px-3 py-3 font-semibold">Cập nhật</th>
                <th className="px-3 py-3 font-semibold">Lượt xem</th>
                <th className="px-3 py-3 font-semibold">Trạng thái</th>
                <th className="w-14 px-3 py-3">
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {adminPosts.map((post, index) => (
                <tr key={post.title} className="hover:bg-muted/35">
                  <td className="px-5 py-4 text-center font-medium text-muted-foreground tabular-nums">
                    {index + 1}
                  </td>
                  <td className="max-w-md px-3 py-3">
                    <div className="flex items-center gap-3">
                      <Image
                        src={post.thumbnail}
                        alt=""
                        width={48}
                        height={32}
                        sizes="48px"
                        className="h-8 w-12 shrink-0 rounded-md object-cover outline-1 outline-black/10 dark:outline-white/10"
                      />
                      <span className="block min-w-0 truncate font-semibold text-foreground">
                        {post.title}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-4 font-medium text-muted-foreground">
                    {post.category}
                  </td>
                  <td className="px-3 py-4 text-muted-foreground">
                    {post.author}
                  </td>
                  <td className="px-3 py-4 text-muted-foreground">
                    {post.updated}
                  </td>
                  <td className="px-3 py-4 font-semibold">{post.views}</td>
                  <td className="px-3 py-4">
                    <StatusPill status={post.status} />
                  </td>
                  <td className="px-3 py-4">
                    <button
                      type="button"
                      aria-label={`Tùy chọn cho ${post.title}`}
                      className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <MoreHorizontal aria-hidden="true" className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-border/70 px-5 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Hiển thị 1–7 trong 35 bài viết</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled
              className="min-h-8 rounded-md border border-border px-3 font-medium disabled:opacity-40"
            >
              Trước
            </button>
            <button
              type="button"
              className="min-h-8 rounded-md border border-border px-3 font-medium text-foreground hover:bg-muted"
            >
              Sau
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
