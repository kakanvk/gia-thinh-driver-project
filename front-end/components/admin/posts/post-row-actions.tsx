"use client"

import { Menu } from "@base-ui/react/menu"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { MoreHorizontal } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { AdminPost, PostStatus } from "@/lib/admin/posts"
import { apiData, apiFetch } from "@/lib/api/client"
import { errorMessage } from "@/lib/api/errors"

type Transition = "publish" | "unpublish" | "archive" | "restore"

const TRANSITIONS: {
  action: Transition
  label: string
  done: string
  from: PostStatus[]
}[] = [
  {
    action: "publish",
    label: "Xuất bản",
    done: "Đã xuất bản bài viết",
    from: ["draft", "pending"],
  },
  {
    action: "unpublish",
    label: "Gỡ xuất bản",
    done: "Đã gỡ xuất bản, bài về Nháp",
    from: ["published"],
  },
  {
    action: "archive",
    label: "Lưu trữ",
    done: "Đã lưu trữ bài viết",
    from: ["draft", "pending", "published"],
  },
  {
    action: "restore",
    label: "Khôi phục",
    done: "Đã khôi phục bài viết về Nháp",
    from: ["archived"],
  },
]

export function PostRowActions({ post }: { post: AdminPost }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["posts"] })
    void queryClient.invalidateQueries({ queryKey: ["post", post.id] })
  }

  const transition = useMutation({
    mutationFn: (action: Transition) =>
      apiData<AdminPost>(`/posts/${post.id}/${action}`, { method: "POST" }),
    onSuccess: (_saved, action) => {
      refresh()
      toast.success(
        TRANSITIONS.find((item) => item.action === action)?.done ?? "Đã lưu"
      )
    },
    meta: { silent: true },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const duplicate = useMutation({
    mutationFn: () =>
      apiData<AdminPost>(`/posts/${post.id}/duplicate`, { method: "POST" }),
    onSuccess: (copy) => {
      void queryClient.invalidateQueries({ queryKey: ["posts"] })
      toast.success("Đã nhân bản bài viết")
      router.push(`/admin/bai-viet/${copy.id}`)
    },
    meta: { silent: true },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const remove = useMutation({
    mutationFn: () =>
      apiFetch<void>(`/posts/${post.id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["posts"] })
      toast.success("Đã xoá bài viết")
      setConfirmDelete(false)
    },
    meta: { silent: true },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const busy = transition.isPending || duplicate.isPending

  return (
    // Sự kiện React đi xuyên portal: chặn để bấm menu không mở trang sửa của hàng
    <div
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Thao tác cho ${post.title}`}
              disabled={busy}
            />
          }
        >
          <MoreHorizontal aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-44">
          <DropdownMenuItem
            onClick={() => router.push(`/admin/bai-viet/${post.id}`)}
          >
            Sửa
          </DropdownMenuItem>
          {TRANSITIONS.filter((item) => item.from.includes(post.status)).map(
            (item) => (
              <DropdownMenuItem
                key={item.action}
                onClick={() => transition.mutate(item.action)}
              >
                {item.label}
              </DropdownMenuItem>
            )
          )}
          <DropdownMenuItem onClick={() => duplicate.mutate()}>
            Nhân bản
          </DropdownMenuItem>
          {post.status === "published" ? (
            <Menu.LinkItem
              href={`/dien-dan/${post.slug}`}
              target="_blank"
              rel="noreferrer"
              closeOnClick
              className="relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground"
            >
              Xem trên web
            </Menu.LinkItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirmDelete(true)}
          >
            Xoá
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Xoá bài viết?"
        description={`"${post.title}" sẽ bị xoá khỏi danh sách và không còn hiện trên website.`}
        confirmLabel="Xoá"
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </div>
  )
}
