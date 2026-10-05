"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { EntitySheet } from "@/components/admin/entity-sheet"
import { FormField } from "@/components/admin/form-field"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { type Category, useCategories } from "@/lib/admin/posts"
import { apiData, apiFetch } from "@/lib/api/client"
import { ApiError, errorMessage, fieldErrors } from "@/lib/api/errors"

const CATEGORIES_KEY = ["lookup", "categories"]

type CategoryBody = {
  name: string
  slug?: string
  description?: string
  isAnnouncement: boolean
}

function CategoryForm({
  category,
  onDone,
}: {
  category: Category | null
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(category?.name ?? "")
  const [slug, setSlug] = useState(category?.slug ?? "")
  const [description, setDescription] = useState(category?.description ?? "")
  const [isAnnouncement, setIsAnnouncement] = useState(
    category?.isAnnouncement ?? false
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  const save = useMutation({
    mutationFn: (body: CategoryBody) =>
      category
        ? apiData<Category>(`/categories/${category.id}`, {
            method: "PATCH",
            body,
          })
        : apiData<Category>("/categories", { method: "POST", body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY })
      toast.success(category ? "Đã lưu chuyên mục" : "Đã thêm chuyên mục")
      onDone()
    },
    meta: { silent: true },
    onError: (error) => {
      const fields = error instanceof ApiError ? fieldErrors(error.details) : {}
      if (Object.keys(fields).length > 0) setErrors(fields)
      else toast.error(errorMessage(error))
    },
  })

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 2 || trimmed.length > 100) {
      setErrors({ name: "Tên chuyên mục từ 2 đến 100 ký tự" })
      return
    }
    setErrors({})
    save.mutate({
      name: trimmed,
      slug: slug.trim() || undefined,
      description: description.trim() || undefined,
      isAnnouncement,
    })
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-label={category ? "Sửa chuyên mục" : "Thêm chuyên mục"}
      className="flex flex-col gap-3 rounded-lg border border-border/70 p-3"
    >
      <FormField id="category-name" label="Tên" required error={errors.name}>
        <Input
          value={name}
          maxLength={100}
          onChange={(event) => setName(event.target.value)}
        />
      </FormField>
      <FormField id="category-slug" label="Slug" error={errors.slug}>
        <Input
          value={slug}
          maxLength={150}
          placeholder="Để trống để tự tạo từ tên"
          onChange={(event) => setSlug(event.target.value)}
        />
      </FormField>
      <FormField
        id="category-description"
        label="Mô tả"
        error={errors.description}
      >
        <Textarea
          value={description}
          maxLength={500}
          rows={2}
          onChange={(event) => setDescription(event.target.value)}
        />
      </FormField>
      <label className="flex items-center gap-2 text-[13px]">
        <Checkbox
          checked={isAnnouncement}
          onCheckedChange={(checked) => setIsAnnouncement(checked === true)}
        />
        Thông báo
      </label>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={save.isPending}
          onClick={onDone}
        >
          Huỷ
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {category ? "Lưu chuyên mục" : "Thêm chuyên mục"}
        </Button>
      </div>
    </form>
  )
}

export function CategorySheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const categories = useCategories(open)
  // null: không mở form; "new": thêm mới; Category: đang sửa
  const [editing, setEditing] = useState<Category | "new" | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)

  const reorder = useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch<unknown>("/categories/reorder", {
        method: "PATCH",
        body: { ids },
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY }),
    meta: { silent: true },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const remove = useMutation({
    mutationFn: (category: Category) =>
      apiFetch<void>(`/categories/${category.id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY })
      toast.success("Đã xoá chuyên mục")
      setDeleting(null)
    },
    meta: { silent: true },
    onError: (error) => {
      setDeleting(null)
      toast.error(
        error instanceof ApiError && error.status === 409
          ? "Chuyên mục còn bài viết, hãy chuyển hoặc xoá bài trước"
          : errorMessage(error)
      )
    },
  })

  const list = [...(categories.data ?? [])].sort((a, b) => a.order - b.order)

  function move(index: number, delta: number) {
    const ids = list.map((category) => category.id)
    const target = index + delta
    ;[ids[index], ids[target]] = [ids[target]!, ids[index]!]
    reorder.mutate(ids)
  }

  let content: React.ReactNode
  if (categories.isPending) {
    content = (
      <p role="status" className="text-[13px] text-muted-foreground">
        Đang tải…
      </p>
    )
  } else if (categories.isError) {
    content = (
      <div className="flex flex-col items-start gap-2">
        <p className="text-[13px] text-muted-foreground">
          Không tải được chuyên mục
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => categories.refetch()}
        >
          Thử lại
        </Button>
      </div>
    )
  } else if (list.length === 0) {
    content = (
      <p className="text-[13px] text-muted-foreground">Chưa có chuyên mục</p>
    )
  } else {
    content = (
      <ul aria-label="Chuyên mục" className="flex flex-col gap-2">
        {list.map((category, index) => (
          <li
            key={category.id}
            className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-1.5 font-medium">
                {category.name}
                {category.isAnnouncement ? (
                  <Badge variant="secondary">Thông báo</Badge>
                ) : null}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {category.slug}
                {category.postCount !== undefined
                  ? ` · ${category.postCount} bài`
                  : null}
              </p>
            </div>
            <div
              role="group"
              aria-label={`Thao tác cho ${category.name}`}
              className="flex shrink-0 items-center"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Đưa lên"
                disabled={index === 0 || reorder.isPending}
                onClick={() => move(index, -1)}
              >
                <ArrowUp aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Đưa xuống"
                disabled={index === list.length - 1 || reorder.isPending}
                onClick={() => move(index, 1)}
              >
                <ArrowDown aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Sửa"
                onClick={() => setEditing(category)}
              >
                <Pencil aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Xoá"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleting(category)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <EntitySheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setEditing(null)
        onOpenChange(next)
      }}
      title="Chuyên mục"
      description="Thứ tự ở đây là thứ tự hiện trên website"
    >
      {editing ? (
        <CategoryForm
          key={editing === "new" ? "new" : editing.id}
          category={editing === "new" ? null : editing}
          onDone={() => setEditing(null)}
        />
      ) : (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => setEditing("new")}
        >
          <Plus aria-hidden="true" />
          Thêm chuyên mục
        </Button>
      )}
      {content}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => {
          if (!next) setDeleting(null)
        }}
        title="Xoá chuyên mục?"
        description={
          deleting
            ? `"${deleting.name}" sẽ bị xoá. Chuyên mục còn bài viết thì không xoá được.`
            : undefined
        }
        confirmLabel="Xoá"
        destructive
        pending={remove.isPending}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting)
        }}
      />
    </EntitySheet>
  )
}
