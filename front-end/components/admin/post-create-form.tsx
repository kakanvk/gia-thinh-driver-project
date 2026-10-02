"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import { ArrowLeft, CalendarIcon, ImagePlus, Save, Send, X } from "lucide-react"
import { z } from "zod"

import { AdminPostEditor } from "@/components/admin/admin-post-editor"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const categoryItems = [
  { label: "Kinh nghiệm thi", value: "exam-experience" },
  { label: "Thông báo", value: "announcement" },
  { label: "Tư vấn chọn bằng", value: "license-consulting" },
  { label: "Học phí minh bạch", value: "tuition" },
  { label: "Xe máy — A & A1", value: "motorbike" },
  { label: "Ô tô — B & C1", value: "car" },
]

const postFormSchema = z.object({
  title: z.string().trim().min(1, "Nhập tiêu đề bài viết."),
  content: z.boolean().refine(Boolean, "Nhập nội dung bài viết."),
})

export function PostCreateForm() {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [hasContent, setHasContent] = useState(false)
  const [titleError, setTitleError] = useState("")
  const [contentError, setContentError] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState("")
  const [feedback, setFeedback] = useState("")
  const [isScrolled, setIsScrolled] = useState(false)
  const [publicationDate, setPublicationDate] = useState(() => new Date())
  const [publicationDateOpen, setPublicationDateOpen] = useState(false)
  const thumbnailInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl)
    }
  }, [thumbnailUrl])

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 0)
    }

    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  function handleThumbnailChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setThumbnailUrl(file ? URL.createObjectURL(file) : null)
  }

  function handleContentChange(nextHasContent: boolean) {
    setHasContent(nextHasContent)
    if (nextHasContent) setContentError("")
  }

  function addTag() {
    const nextTag = tagDraft.trim()
    if (!nextTag) return

    setTags((currentTags) => {
      const alreadyExists = currentTags.some(
        (tag) => tag.toLocaleLowerCase() === nextTag.toLocaleLowerCase()
      )
      return alreadyExists ? currentTags : [...currentTags, nextTag]
    })
    setTagDraft("")
  }

  function handleTagKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault()
      addTag()
      return
    }

    if (event.key === "Backspace" && !tagDraft && tags.length > 0) {
      setTags((currentTags) => currentTags.slice(0, -1))
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const result = postFormSchema.safeParse({
      title: formData.get("title"),
      content: hasContent,
    })

    const nextTitleError = result.success
      ? ""
      : (result.error.issues.find((issue) => issue.path[0] === "title")
          ?.message ?? "")
    const nextContentError = result.success
      ? ""
      : (result.error.issues.find((issue) => issue.path[0] === "content")
          ?.message ?? "")

    setTitleError(nextTitleError)
    setContentError(nextContentError)
    setFeedback("")

    if (!result.success) {
      if (nextTitleError) document.getElementById("post-title")?.focus()
      return
    }

    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null
    const action = submitter?.value

    setFeedback(
      action === "publish"
        ? "Chưa kết nối API xuất bản."
        : "Chưa kết nối API lưu bản nháp."
    )
  }

  return (
    <main id="admin-content" className="px-4 pb-4">
      <div
        className={cn(
          "sticky top-16 z-30 -mx-4 bg-background px-4 py-2 transition-shadow duration-150",
          isScrolled && "shadow-md"
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/bai-viet"
              aria-label="Quay lại danh sách bài viết"
              title="Quay lại danh sách bài viết"
              className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
            </Link>
            <h1 className="text-base font-bold tracking-tight text-navy sm:text-lg">
              Tạo bài viết
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/bai-viet"
              className={cn(buttonVariants({ variant: "ghost" }), "h-9 px-3")}
            >
              Hủy
            </Link>
            <Button
              form="post-create-form"
              type="submit"
              name="action"
              value="draft"
              variant="outline"
              className="h-9 px-3"
            >
              <Save data-icon="inline-start" aria-hidden="true" />
              Lưu bản nháp
            </Button>
            <Button
              form="post-create-form"
              type="submit"
              name="action"
              value="publish"
              className="h-9 px-3"
            >
              <Send data-icon="inline-start" aria-hidden="true" />
              Xuất bản
            </Button>
          </div>
        </div>
        <p role="status" aria-live="polite" className="sr-only">
          {feedback}
        </p>
      </div>

      <form
        id="post-create-form"
        noValidate
        onSubmit={handleSubmit}
        className="mt-4"
      >
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section
            aria-label="Nội dung bài viết"
            className="rounded-lg border border-border/70 bg-background"
          >
            <FieldGroup className="p-4 sm:p-5">
              <Field data-invalid={Boolean(titleError)}>
                <FieldLabel htmlFor="post-title">Tiêu đề bài viết</FieldLabel>
                <Input
                  id="post-title"
                  name="title"
                  required
                  autoFocus
                  aria-invalid={Boolean(titleError)}
                  aria-describedby={titleError ? "post-title-error" : undefined}
                  onChange={() => {
                    if (titleError) setTitleError("")
                  }}
                  placeholder="Nhập tiêu đề bài viết..."
                  className="h-10 rounded-md"
                />
                {titleError ? (
                  <FieldError id="post-title-error">{titleError}</FieldError>
                ) : null}
              </Field>

              <Field>
                <FieldLabel htmlFor="post-summary">Mô tả ngắn</FieldLabel>
                <Textarea
                  id="post-summary"
                  name="summary"
                  maxLength={180}
                  placeholder="Tóm tắt nội dung chính trong 1–2 câu..."
                  className="min-h-24 resize-y rounded-md"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="post-tags">Thẻ bài viết</FieldLabel>
                <Input
                  id="post-tags"
                  value={tagDraft}
                  onChange={(event) => setTagDraft(event.target.value)}
                  onKeyDown={handleTagKeyDown}
                  autoComplete="off"
                  placeholder="Nhập thẻ rồi nhấn Enter..."
                  className="h-10 rounded-md"
                />
                <input type="hidden" name="tags" value={tags.join(",")} />
                {tags.length > 0 ? (
                  <div
                    className="flex flex-wrap gap-2"
                    aria-label="Thẻ bài viết đã chọn"
                  >
                    {tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="h-7 gap-1 pr-0.5 pl-2.5"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() =>
                            setTags((currentTags) =>
                              currentTags.filter((item) => item !== tag)
                            )
                          }
                          aria-label={`Xóa thẻ ${tag}`}
                          className="grid size-6 place-items-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          <X aria-hidden="true" className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </Field>

              <Field data-invalid={Boolean(contentError)}>
                <FieldLabel>Nội dung</FieldLabel>
                <AdminPostEditor
                  invalid={Boolean(contentError)}
                  onContentChange={handleContentChange}
                />
                {contentError ? (
                  <FieldError id="post-content-error">
                    {contentError}
                  </FieldError>
                ) : null}
              </Field>
            </FieldGroup>
          </section>

          <div className="flex flex-col gap-4 xl:sticky xl:top-33">
            <section
              aria-labelledby="post-settings-heading"
              className="rounded-lg border border-border/70 bg-background p-4"
            >
              <h2
                id="post-settings-heading"
                className="text-sm font-semibold text-navy"
              >
                Thiết lập bài viết
              </h2>

              <FieldGroup className="mt-4 gap-4">
                <Field>
                  <FieldLabel>Chuyên mục</FieldLabel>
                  <Select items={categoryItems} defaultValue="exam-experience">
                    <SelectTrigger
                      aria-label="Chọn chuyên mục"
                      className="h-10 w-full rounded-md"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {categoryItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="post-publication-date">
                    Ngày công bố
                  </FieldLabel>
                  <Popover
                    open={publicationDateOpen}
                    onOpenChange={setPublicationDateOpen}
                  >
                    <PopoverTrigger
                      render={
                        <Button
                          id="post-publication-date"
                          type="button"
                          variant="outline"
                          className="h-10 w-full justify-between rounded-md px-3 font-normal"
                        />
                      }
                    >
                      {format(publicationDate, "dd/MM/yyyy", { locale: vi })}
                      <CalendarIcon data-icon="inline-end" aria-hidden="true" />
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={publicationDate}
                        onSelect={(date) => {
                          if (!date) return
                          setPublicationDate(date)
                          setPublicationDateOpen(false)
                        }}
                        locale={vi}
                        timeZone="Asia/Ho_Chi_Minh"
                      />
                    </PopoverContent>
                  </Popover>
                  <input
                    type="hidden"
                    name="publicationDate"
                    value={format(publicationDate, "yyyy-MM-dd")}
                  />
                </Field>
              </FieldGroup>
            </section>

            <section
              aria-labelledby="post-thumbnail-heading"
              className="rounded-lg border border-border/70 bg-background p-4"
            >
              <h2
                id="post-thumbnail-heading"
                className="text-sm font-semibold text-navy"
              >
                Ảnh đại diện
              </h2>

              <button
                type="button"
                onClick={() => thumbnailInputRef.current?.click()}
                aria-label={
                  thumbnailUrl
                    ? "Thay ảnh đại diện bài viết"
                    : "Chọn ảnh đại diện bài viết"
                }
                className="mt-4 block w-full overflow-hidden rounded-md bg-muted/60 text-muted-foreground outline-1 outline-black/10 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:outline-white/10"
              >
                {thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbnailUrl}
                    alt="Xem trước ảnh đại diện bài viết"
                    className="aspect-video w-full object-cover"
                  />
                ) : (
                  <span className="grid aspect-video place-items-center">
                    <span className="flex flex-col items-center gap-2 text-xs">
                      <ImagePlus aria-hidden="true" className="size-6" />
                      Nhấn để chọn ảnh
                    </span>
                  </span>
                )}
              </button>
              <input
                ref={thumbnailInputRef}
                id="post-thumbnail"
                name="thumbnail"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleThumbnailChange}
                hidden
              />
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                PNG, JPG hoặc WebP. Tỷ lệ khuyến nghị 3:2.
              </p>
            </section>
          </div>
        </div>
      </form>
    </main>
  )
}
