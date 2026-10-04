"use client"

import { useRef, useState, type FormEvent } from "react"
import {
  CheckCircle2,
  LoaderCircle,
  MessageCircle,
  Phone,
  RotateCcw,
  Send,
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { apiFetch } from "@/lib/api/client"
import { ApiError, errorMessage, fieldErrors } from "@/lib/api/errors"
import { buildLeadBody, NO_COURSE, type CourseOption } from "@/lib/public/lead"
import { cn } from "@/lib/utils"

type ConsultationFormProps = {
  branches: { slug: string; label: string }[]
  courses: CourseOption[]
  contactTimes: { label: string; value: string }[]
  contact: { hotline: string; telHref: string; zaloHref: string }
  initialBranch?: string
  initialCourse?: string
}

export function ConsultationForm({
  branches,
  courses,
  contactTimes,
  contact,
  initialBranch,
  initialCourse,
}: ConsultationFormProps) {
  const [branch, setBranch] = useState(
    initialBranch && branches.some((item) => item.slug === initialBranch)
      ? initialBranch
      : (branches[0]?.slug ?? "")
  )
  const [courseCode, setCourseCode] = useState(
    initialCourse && courses.some((item) => item.code === initialCourse)
      ? initialCourse
      : NO_COURSE
  )
  const [contactTime, setContactTime] = useState(contactTimes[0]?.value ?? "")
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  // Chặn gửi đôi ngay trong cùng một tick, trước khi state kịp cập nhật
  const inFlight = useRef(false)

  const courseItems = [
    ...courses.map((item) => ({ label: item.name, value: item.code })),
    { label: "Chưa xác định, cần tư vấn", value: NO_COURSE },
  ]
  const branchItems = branches.map((item) => ({ label: item.label, value: item.slug }))

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setSubmitting(true)
    setErrors({})
    setFormError(null)

    const formData = new FormData(event.currentTarget)
    const body = buildLeadBody(
      {
        name: String(formData.get("name") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        branch,
        courseCode,
        preferredContactTime: contactTime,
        note: String(formData.get("note") ?? ""),
        website: String(formData.get("website") ?? ""),
      },
      window.location.search
    )

    try {
      await apiFetch("/public/leads", { method: "POST", body })
      setSubmitted(true)
    } catch (error) {
      if (error instanceof ApiError && error.status === 400 && error.details.length > 0) {
        setErrors(fieldErrors(error.details))
      } else if (error instanceof ApiError && error.status === 400) {
        setFormError(error.message)
      } else if (error instanceof ApiError && error.status === 429) {
        setFormError(
          `${error.message}. Vui lòng gọi hotline ${contact.hotline} để được hỗ trợ ngay.`
        )
      } else {
        setFormError(`${errorMessage(error)} Hoặc gọi hotline ${contact.hotline}.`)
      }
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }

  function reset() {
    setSubmitted(false)
    setErrors({})
    setFormError(null)
    setConsent(false)
  }

  if (branches.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-extrabold text-navy">Thông tin cần tư vấn</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Hiện chưa gửi được yêu cầu trực tuyến. Vui lòng gọi hotline{" "}
          <a href={contact.telHref} className="font-bold text-primary hover:underline">
            {contact.hotline}
          </a>{" "}
          hoặc nhắn Zalo.
        </p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="flex flex-col gap-5" role="status" aria-live="polite">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 aria-hidden="true" className="size-6" />
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-navy">Đã nhận thông tin</h2>
          <p className="mt-2 leading-7 text-muted-foreground">
            Tư vấn viên Gia Thịnh sẽ gọi lại cho bạn trong giờ làm việc. Cần gấp, hãy gọi hotline.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <a
            href={contact.telHref}
            className={cn(buttonVariants({ size: "lg" }), "h-11 rounded-full px-6")}
          >
            <Phone data-icon="inline-start" aria-hidden="true" />
            Gọi {contact.hotline}
          </a>
          <a
            href={contact.zaloHref}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-11 rounded-full px-6"
            )}
          >
            <MessageCircle data-icon="inline-start" aria-hidden="true" />
            Nhắn Zalo
          </a>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={reset}
            className="h-11 rounded-full px-6"
          >
            <RotateCcw data-icon="inline-start" aria-hidden="true" />
            Gửi yêu cầu khác
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="relative flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-extrabold text-navy">Thông tin cần tư vấn</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Điền các mục dưới đây để tư vấn viên hiểu đúng nhu cầu của bạn.
        </p>
      </div>

      {/* Bẫy spam: người thật không thấy ô này */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="consultation-website">Website</label>
        <input
          id="consultation-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={errors.name ? true : undefined}>
          <FieldLabel htmlFor="consultation-name">Họ và tên</FieldLabel>
          <Input
            id="consultation-name"
            name="name"
            autoComplete="name"
            placeholder="Nguyễn Văn An"
            required
            aria-invalid={errors.name ? true : undefined}
            className="h-11 rounded-md"
          />
          {errors.name ? <FieldError>{errors.name}</FieldError> : null}
        </Field>
        <Field data-invalid={errors.phone ? true : undefined}>
          <FieldLabel htmlFor="consultation-phone">Số điện thoại</FieldLabel>
          <Input
            id="consultation-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="09xx xxx xxx"
            required
            aria-invalid={errors.phone ? true : undefined}
            className="h-11 rounded-md"
          />
          {errors.phone ? <FieldError>{errors.phone}</FieldError> : null}
        </Field>
      </FieldGroup>

      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={errors.courseCode ? true : undefined}>
          <FieldLabel>Hạng bằng quan tâm</FieldLabel>
          <Select
            items={courseItems}
            value={courseCode}
            onValueChange={(value) => {
              if (typeof value === "string") setCourseCode(value)
            }}
          >
            <SelectTrigger
              aria-invalid={errors.courseCode ? true : undefined}
              className="w-full rounded-md data-[size=default]:h-11"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {courseItems.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {errors.courseCode ? <FieldError>{errors.courseCode}</FieldError> : null}
        </Field>

        <Field data-invalid={errors.branch ? true : undefined}>
          <FieldLabel>Cơ sở thuận tiện</FieldLabel>
          <Select
            items={branchItems}
            value={branch}
            onValueChange={(value) => {
              if (typeof value === "string") setBranch(value)
            }}
          >
            <SelectTrigger
              aria-invalid={errors.branch ? true : undefined}
              className="w-full rounded-md data-[size=default]:h-11"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {branchItems.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {errors.branch ? <FieldError>{errors.branch}</FieldError> : null}
        </Field>
      </FieldGroup>

      {contactTimes.length > 0 ? (
        <Field>
          <FieldLabel>Thời gian thuận tiện để liên hệ</FieldLabel>
          <Select
            items={contactTimes}
            value={contactTime}
            onValueChange={(value) => {
              if (typeof value === "string") setContactTime(value)
            }}
          >
            <SelectTrigger className="w-full rounded-md data-[size=default]:h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {contactTimes.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      <Field data-invalid={errors.note ? true : undefined}>
        <FieldLabel htmlFor="consultation-note">Bạn cần hỏi thêm điều gì?</FieldLabel>
        <Textarea
          id="consultation-note"
          name="note"
          placeholder="Ví dụ: học phí trọn khóa, lịch học cuối tuần, hồ sơ cần chuẩn bị…"
          aria-invalid={errors.note ? true : undefined}
          className="min-h-20 resize-y rounded-md"
        />
        {errors.note ? <FieldError>{errors.note}</FieldError> : null}
      </Field>

      <Field orientation="horizontal">
        <Checkbox
          id="consultation-consent"
          checked={consent}
          onCheckedChange={setConsent}
          required
        />
        <FieldContent>
          <FieldLabel htmlFor="consultation-consent">
            Tôi đồng ý để Gia Thịnh liên hệ tư vấn theo thông tin đã cung cấp.
          </FieldLabel>
        </FieldContent>
      </Field>

      {formError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={!consent || submitting}
        className="h-11 w-full rounded-full text-base font-bold"
      >
        Gửi thông tin tư vấn
        {submitting ? (
          <LoaderCircle data-icon="inline-end" aria-hidden="true" className="animate-spin" />
        ) : (
          <Send data-icon="inline-end" aria-hidden="true" />
        )}
      </Button>
    </form>
  )
}
