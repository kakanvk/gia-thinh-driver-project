"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { FolderTree, ImageOff, Plus } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { AdminPageHeader, StatusPill } from "@/components/admin/admin-ui"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { FilterBar, FilterSelect } from "@/components/admin/filter-bar"
import { Pagination } from "@/components/admin/pagination"
import { CategorySheet } from "@/components/admin/posts/category-sheet"
import { PostRowActions } from "@/components/admin/posts/post-row-actions"
import { Button, buttonVariants } from "@/components/ui/button"
import { formatDateTime } from "@/lib/admin/datetime"
import { nameById } from "@/lib/admin/lookups"
import {
  type AdminPost,
  POST_STATUS_LABELS,
  POST_STATUSES,
  postStatusLabel,
  useCategories,
} from "@/lib/admin/posts"
import type { Page } from "@/lib/admin/types"
import { useCan } from "@/lib/admin/use-can"
import { useListParams } from "@/lib/admin/use-list-params"
import { apiFetch } from "@/lib/api/client"

const LIMIT = 20
const FILTER_KEYS = ["q", "status", "categoryId"] as const

function Cover({ post }: { post: AdminPost }) {
  return (
    <div className="relative aspect-3/2 w-16 overflow-hidden rounded-md border border-border/70 bg-muted">
      {post.cover ? (
        <Image
          src={post.cover.url}
          alt={post.cover.alt}
          fill
          unoptimized
          sizes="4rem"
          className="object-cover"
        />
      ) : (
        <span className="grid size-full place-items-center text-muted-foreground">
          <ImageOff aria-hidden="true" className="size-4" />
        </span>
      )}
    </div>
  )
}

export function PostList() {
  const router = useRouter()
  const canManageCategories = useCan("category.manage")
  const { values, page, set, setPage } = useListParams(FILTER_KEYS)
  const categories = useCategories()
  const [categoriesOpen, setCategoriesOpen] = useState(false)

  const query = { ...values, page, limit: LIMIT, sort: "-updatedAt" }
  const posts = useQuery({
    queryKey: ["posts", query],
    queryFn: ({ signal }) =>
      apiFetch<Page<AdminPost>>("/posts", { query, signal }),
    placeholderData: keepPreviousData,
  })

  const columns: DataTableColumn<AdminPost>[] = [
    {
      key: "cover",
      header: "Ảnh bìa",
      className: "w-20",
      cell: (post) => <Cover post={post} />,
    },
    {
      key: "title",
      header: "Tiêu đề",
      cell: (post) => (
        <div className="min-w-48">
          <p className="line-clamp-2 font-semibold text-foreground">
            {post.title}
          </p>
          <p className="truncate text-xs text-muted-foreground">{post.slug}</p>
        </div>
      ),
    },
    {
      key: "category",
      header: "Chuyên mục",
      className: "whitespace-nowrap",
      cell: (post) => nameById(categories.data, post.categoryId, "—"),
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (post) => <StatusPill status={postStatusLabel(post)} />,
    },
    {
      key: "author",
      header: "Tác giả",
      className: "whitespace-nowrap",
      cell: (post) => post.authorName,
    },
    {
      key: "views",
      header: "Lượt xem",
      className: "text-right tabular-nums",
      cell: (post) => post.views.toLocaleString("vi-VN"),
    },
    {
      key: "updatedAt",
      header: "Cập nhật",
      className: "whitespace-nowrap text-muted-foreground",
      cell: (post) => formatDateTime(post.updatedAt),
    },
    {
      key: "actions",
      header: "",
      className: "w-10",
      cell: (post) => <PostRowActions post={post} />,
    },
  ]

  return (
    <>
      <AdminPageHeader
        title="Bài viết"
        action={
          <div className="flex flex-wrap gap-2">
            {canManageCategories ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setCategoriesOpen(true)}
              >
                <FolderTree aria-hidden="true" />
                Chuyên mục
              </Button>
            ) : null}
            <Link href="/admin/bai-viet/tao-moi" className={buttonVariants()}>
              <Plus aria-hidden="true" />
              Viết bài
            </Link>
          </div>
        }
      />

      <section className="mt-4 overflow-hidden rounded-xl border border-border/80 bg-card">
        <FilterBar
          search={{
            value: values.q,
            placeholder: "Tìm theo tiêu đề",
            onChange: (q) => set({ q }),
          }}
        >
          <FilterSelect
            label="Trạng thái"
            items={POST_STATUSES.map((status) => ({
              value: status,
              label: POST_STATUS_LABELS[status],
            }))}
            value={values.status}
            onChange={(status) => set({ status })}
          />
          <FilterSelect
            label="Chuyên mục"
            items={(categories.data ?? []).map((category) => ({
              value: category.id,
              label: category.name,
            }))}
            value={values.categoryId}
            onChange={(categoryId) => set({ categoryId })}
          />
        </FilterBar>

        <DataTable
          columns={columns}
          rows={posts.data?.data}
          rowKey={(post) => post.id}
          isLoading={posts.isPending}
          error={posts.error}
          onRetry={() => void posts.refetch()}
          onRowClick={(post) => router.push(`/admin/bai-viet/${post.id}`)}
          empty="Chưa có bài viết nào khớp bộ lọc."
        />
        {posts.data ? (
          <Pagination
            page={posts.data.meta.page}
            limit={posts.data.meta.limit}
            total={posts.data.meta.total}
            onPageChange={setPage}
          />
        ) : null}
      </section>

      {canManageCategories ? (
        <CategorySheet open={categoriesOpen} onOpenChange={setCategoriesOpen} />
      ) : null}
    </>
  )
}
