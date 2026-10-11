"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  ExternalLink,
  ImagePlus,
  Save,
  Send,
  Undo2,
  X,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Value } from "platejs"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { AdminPostEditor } from "@/components/admin/admin-post-editor"
import { StatusPill } from "@/components/admin/admin-ui"
import { FormField } from "@/components/admin/form-field"
import { MediaPicker } from "@/components/admin/media/media-picker"
import { useAuth } from "@/components/admin/auth-provider"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toVnIso } from "@/lib/admin/datetime"
import {
  type AdminPost,
  buildPostBody,
  formStateFromPost,
  hasPostContent,
  postFieldKey,
  type PostFormState,
  postStatusLabel,
  slugify,
  useCategories,
} from "@/lib/admin/posts"
import { apiData } from "@/lib/api/client"
import { ApiError, errorMessage, fieldErrors } from "@/lib/api/errors"
import { cn } from "@/lib/utils"

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
const MAX_TAGS = 20
const LEAVE_MESSAGE = "Bài viết có thay đổi chưa lưu. Rời trang?"

type Action = "save" | "publish" | "unpublish"

const DONE: Record<Action, string> = {
  save: "Đã lưu bài viết",
  publish: "Đã xuất bản bài viết",
  unpublish: "Đã gỡ xuất bản, bài về Nháp",
}

function validate(state: PostFormState): Record<string, string> {
  const errors: Record<string, string> = {}
  const title = state.title.trim()
  if (title.length < 5 || title.length > 200) {
    errors.title = "Tiêu đề từ 5 đến 200 ký tự"
  }
  const slug = state.slug.trim()
  if (slug && (!SLUG_PATTERN.test(slug) || slug.length > 150)) {
    errors.slug = "Slug chỉ gồm chữ thường không dấu, số và dấu gạch ngang"
  }
  if (!state.categoryId) errors.categoryId = "Chưa chọn chuyên mục"
  const author = state.authorName.trim()
  if (author && author.length < 2) errors.authorName = "Tên tác giả từ 2 ký tự"
  if (!hasPostContent(state.content)) {
    errors.content = "Nhập nội dung bài viết"
  }
  return errors
}

function TagsInput({
  tags,
  onChange,
  error,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
  error?: string
}) {
  const [draft, setDraft] = useState("")

  function add() {
    const tag = draft.trim().toLowerCase().slice(0, 30)
    setDraft("")
    if (!tag || tags.includes(tag) || tags.length >= MAX_TAGS) return
    onChange([...tags, tag])
  }

  return (
    <FormField id="post-tags" label="Tag" error={error}>
      {(control) => (
        <div className="flex flex-col gap-2">
          <Input
            {...control}
            value={draft}
            autoComplete="off"
            maxLength={30}
            disabled={tags.length >= MAX_TAGS}
            placeholder={
              tags.length >= MAX_TAGS
                ? `Tối đa ${MAX_TAGS} tag`
                : "Nhập tag rồi nhấn Enter"
            }
            onChange={(event) => setDraft(event.target.value)}
            onBlur={add}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault()
                add()
              } else if (event.key === "Backspace" && !draft && tags.length) {
                onChange(tags.slice(0, -1))
              }
            }}
          />
          {tags.length > 0 ? (
            <ul aria-label="Tag đã chọn" className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <li key={tag}>
                  <Badge variant="secondary" className="h-7 gap-1 pr-0.5 pl-2.5">
                    {tag}
                    <button
                      type="button"
                      aria-label={`Bỏ tag ${tag}`}
                      onClick={() => onChange(tags.filter((t) => t !== tag))}
                      className="grid size-6 place-items-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <X aria-hidden="true" className="size-3" />
                    </button>
                  </Badge>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </FormField>
  )
}

function PostForm({ post }: { post: AdminPost | null }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const categories = useCategories()

  const [state, setState] = useState<PostFormState>(() =>
    formStateFromPost(post, user?.name ?? "")
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)
  const [slugTouched, setSlugTouched] = useState(post !== null)
  const [scheduleAt, setScheduleAt] = useState("")
  const [coverPickerOpen, setCoverPickerOpen] = useState(false)
  // Bài vừa tạo trong lượt bấm hiện tại (xuất bản lỗi vẫn chuyển sang trang sửa)
  const createdId = useRef<string | null>(null)

  const published = post?.status === "published"
  const archived = post?.status === "archived"

  useEffect(() => {
    if (!dirty) return
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault()
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  function update<K extends keyof PostFormState>(
    key: K,
    value: PostFormState[K]
  ) {
    setState((current) => ({ ...current, [key]: value }))
    setDirty(true)
    if (errors[key]) {
      setErrors((current) => {
        const next = { ...current }
        delete next[key]
        return next
      })
    }
  }

  function changeTitle(title: string) {
    update("title", title)
    if (!slugTouched) setState((current) => ({ ...current, slug: slugify(title) }))
  }

  const submit = useMutation({
    meta: { silent: true },
    mutationFn: async (action: Action) => {
      createdId.current = null
      let saved = post
      if (action !== "unpublish") {
        const body = buildPostBody(state)
        saved = post
          ? await apiData<AdminPost>(`/posts/${post.id}`, {
              method: "PATCH",
              body,
            })
          : await apiData<AdminPost>("/posts", { method: "POST", body })
        if (!post) createdId.current = saved.id
        setDirty(false)
      }
      if (action === "publish") {
        saved = await apiData<AdminPost>(`/posts/${saved!.id}/publish`, {
          method: "POST",
          body: scheduleAt ? { publishedAt: toVnIso(scheduleAt) } : undefined,
        })
      } else if (action === "unpublish") {
        saved = await apiData<AdminPost>(`/posts/${post!.id}/unpublish`, {
          method: "POST",
        })
      }
      return saved!
    },
    onSuccess: (saved, action) => {
      queryClient.setQueryData(["post", saved.id], saved)
      void queryClient.invalidateQueries({ queryKey: ["posts"] })
      toast.success(DONE[action])
      if (action === "publish") setScheduleAt("")
      if (!post) router.replace(`/admin/bai-viet/${saved.id}`)
    },
    onError: (error) => {
      const fields =
        error instanceof ApiError && error.status === 400
          ? fieldErrors(error.details)
          : {}
      const mapped: Record<string, string> = {}
      for (const [path, message] of Object.entries(fields)) {
        const key = postFieldKey(path)
        if (!(key in mapped)) mapped[key] = message
      }
      if (Object.keys(mapped).length > 0) {
        setErrors(mapped)
        toast.error("Kiểm tra lại các ô báo lỗi")
      } else {
        toast.error(errorMessage(error))
      }
      if (createdId.current) {
        void queryClient.invalidateQueries({ queryKey: ["posts"] })
        router.replace(`/admin/bai-viet/${createdId.current}`)
      }
    },
  })

  function run(action: Action) {
    if (action !== "unpublish") {
      const found = validate(state)
      setErrors(found)
      const first = Object.keys(found)[0]
      if (first) {
        document.getElementById(`post-${first}`)?.focus()
        return
      }
    }
    submit.mutate(action)
  }

  function confirmLeave(event: React.MouseEvent) {
    if (dirty && !window.confirm(LEAVE_MESSAGE)) event.preventDefault()
  }

  const categoryItems = (categories.data ?? []).map((category) => ({
    value: category.id,
    label: category.name,
  }))
  const busy = submit.isPending

  return (
    <main id="admin-content" className="px-4 pb-4">
      <div className="sticky top-16 z-30 -mx-4 border-b border-border/70 bg-background px-4 py-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/admin/bai-viet"
              aria-label="Quay lại danh sách bài viết"
              title="Quay lại danh sách bài viết"
              onClick={confirmLeave}
              className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
            </Link>
            <h1 className="truncate text-base font-bold tracking-tight text-navy sm:text-lg">
              {post ? "Sửa bài viết" : "Viết bài mới"}
            </h1>
            {post ? <StatusPill status={postStatusLabel(post)} /> : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {published ? (
              <>
                <a
                  href={`/dien-dan/${post.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: "ghost" })}
                >
                  <ExternalLink aria-hidden="true" />
                  Xem trên web
                </a>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => run("unpublish")}
                >
                  <Undo2 aria-hidden="true" />
                  Gỡ xuất bản
                </Button>
                <Button type="button" disabled={busy} onClick={() => run("save")}>
                  <Save aria-hidden="true" />
                  Cập nhật
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => run("save")}
                >
                  <Save aria-hidden="true" />
                  {post && post.status !== "draft" ? "Lưu" : "Lưu nháp"}
                </Button>
                {archived ? null : (
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() => run("publish")}
                  >
                    <Send aria-hidden="true" />
                    {scheduleAt ? "Hẹn giờ xuất bản" : "Xuất bản"}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <form
        noValidate
        aria-label={post ? "Sửa bài viết" : "Viết bài mới"}
        onSubmit={(event) => {
          event.preventDefault()
          run("save")
        }}
        className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]"
      >
        <section
          aria-label="Nội dung bài viết"
          className="flex flex-col gap-4 rounded-lg border border-border/70 bg-background p-4 sm:p-5"
        >
          <FormField id="post-title" label="Tiêu đề" required error={errors.title}>
            <Input
              value={state.title}
              maxLength={200}
              placeholder="Nhập tiêu đề bài viết"
              onChange={(event) => changeTitle(event.target.value)}
            />
          </FormField>
          <FormField id="post-slug" label="Slug" error={errors.slug}>
            <Input
              value={state.slug}
              maxLength={150}
              placeholder="Để trống để tự tạo từ tiêu đề"
              onChange={(event) => {
                setSlugTouched(true)
                update("slug", event.target.value)
              }}
            />
          </FormField>
          <FormField id="post-excerpt" label="Tóm tắt" error={errors.excerpt}>
            <Textarea
              value={state.excerpt}
              maxLength={500}
              rows={3}
              placeholder="Để trống để tự tạo từ nội dung"
              onChange={(event) => update("excerpt", event.target.value)}
            />
          </FormField>
          <div className="flex flex-col gap-1.5">
            <span
              id="post-content-label"
              className="text-[13px] leading-none font-medium"
            >
              Nội dung
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </span>
            <AdminPostEditor
              value={state.content as Value}
              invalid={Boolean(errors.content)}
              onChange={(content) => update("content", content)}
            />
            {errors.content ? (
              <p id="post-content-error" className="text-xs text-destructive">
                {errors.content}
              </p>
            ) : null}
          </div>
        </section>

        <div className="flex flex-col gap-4 xl:sticky xl:top-33">
          <section
            aria-label="Thiết lập bài viết"
            className="flex flex-col gap-4 rounded-lg border border-border/70 bg-background p-4"
          >
            <FormField
              id="post-categoryId"
              label="Chuyên mục"
              required
              error={errors.categoryId}
            >
              {(control) => (
                <Select
                  items={categoryItems}
                  value={state.categoryId || null}
                  onValueChange={(value) => update("categoryId", value ?? "")}
                >
                  <SelectTrigger {...control} className="w-full">
                    <SelectValue placeholder="Chọn chuyên mục" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <TagsInput
              tags={state.tags}
              error={errors.tags}
              onChange={(tags) => update("tags", tags)}
            />
            <FormField
              id="post-authorName"
              label="Tác giả"
              error={errors.authorName}
            >
              <Input
                value={state.authorName}
                maxLength={100}
                onChange={(event) => update("authorName", event.target.value)}
              />
            </FormField>
            {published || archived ? null : (
              <FormField
                id="post-publishedAt"
                label="Hẹn giờ xuất bản"
                error={errors.publishedAt}
              >
                <Input
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(event) => setScheduleAt(event.target.value)}
                />
              </FormField>
            )}
          </section>

          <section
            aria-labelledby="post-cover-heading"
            className="flex flex-col gap-3 rounded-lg border border-border/70 bg-background p-4"
          >
            <h2 id="post-cover-heading" className="text-sm font-semibold text-navy">
              Ảnh bìa
            </h2>
            {state.cover ? (
              <div className="relative aspect-3/2 overflow-hidden rounded-md border border-border/70 bg-muted">
                <Image
                  src={state.cover.url}
                  alt={state.cover.alt || "Ảnh bìa bài viết"}
                  fill
                  unoptimized
                  sizes="320px"
                  className="object-cover"
                />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                id="post-cover"
                type="button"
                variant="outline"
                onClick={() => setCoverPickerOpen(true)}
              >
                <ImagePlus aria-hidden="true" />
                {state.cover ? "Đổi ảnh bìa" : "Chọn ảnh bìa"}
              </Button>
              {state.cover ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => update("cover", null)}
                >
                  Bỏ ảnh bìa
                </Button>
              ) : null}
            </div>
            {errors.cover ? (
              <p className="text-xs text-destructive">{errors.cover}</p>
            ) : null}
          </section>

          <section
            aria-label="SEO"
            className="flex flex-col gap-4 rounded-lg border border-border/70 bg-background p-4"
          >
            <FormField
              id="post-seo.title"
              label="SEO tiêu đề"
              error={errors["seo.title"]}
            >
              <Input
                value={state.seoTitle}
                maxLength={70}
                onChange={(event) => update("seoTitle", event.target.value)}
              />
            </FormField>
            <FormField
              id="post-seo.description"
              label="SEO mô tả"
              error={errors["seo.description"]}
            >
              <Textarea
                value={state.seoDescription}
                maxLength={160}
                rows={3}
                onChange={(event) =>
                  update("seoDescription", event.target.value)
                }
              />
            </FormField>
          </section>
        </div>
      </form>

      <MediaPicker
        open={coverPickerOpen}
        onOpenChange={setCoverPickerOpen}
        kind="image"
        title="Chọn ảnh bìa"
        onSelect={(media) =>
          update("cover", {
            url: media.url,
            alt: media.alt ?? "",
            mediaId: media.id,
          })
        }
      />
    </main>
  )
}

export function PostEditorForm({ postId }: { postId?: string }) {
  const post = useQuery({
    queryKey: ["post", postId],
    queryFn: ({ signal }) => apiData<AdminPost>(`/posts/${postId}`, { signal }),
    enabled: Boolean(postId),
    // Không tải lại giữa chừng: form giữ bản đang sửa
    staleTime: Infinity,
  })

  if (!postId) return <PostForm post={null} />

  if (post.isPending) {
    return (
      <main id="admin-content" className="p-4">
        <p role="status" className="text-[13px] text-muted-foreground">
          Đang tải bài viết…
        </p>
      </main>
    )
  }

  if (post.isError) {
    const notFound = post.error instanceof ApiError && post.error.status === 404
    return (
      <main id="admin-content" className="flex flex-col items-start gap-3 p-4">
        <p className="text-[13px] text-muted-foreground">
          {notFound ? "Không tìm thấy bài viết" : errorMessage(post.error)}
        </p>
        <div className="flex gap-2">
          {notFound ? null : (
            <Button
              type="button"
              variant="outline"
              onClick={() => void post.refetch()}
            >
              Thử lại
            </Button>
          )}
          <Link
            href="/admin/bai-viet"
            className={cn(buttonVariants({ variant: "ghost" }))}
          >
            Về danh sách bài viết
          </Link>
        </div>
      </main>
    )
  }

  return <PostForm key={post.data.id} post={post.data} />
}
