"use client"

import { useState, type FormEvent } from "react"
import { CheckCircle2, MessageCircle, RotateCcw, Send } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
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
import { offices } from "@/lib/contact"
import { cn } from "@/lib/utils"

const licenseOptions = [
  { label: "Hạng A1 — xe máy đến 125cc", value: "A1" },
  { label: "Hạng A — xe máy trên 125cc", value: "A" },
  { label: "Hạng B — ô tô", value: "B" },
  { label: "Hạng C1 — ô tô tải", value: "C1" },
  { label: "Chưa xác định, cần tư vấn", value: "Chưa xác định" },
]

const contactTimeOptions = [
  { label: "Buổi sáng, 07:00–11:30", value: "Buổi sáng (07:00–11:30)" },
  { label: "Buổi chiều, 13:00–17:30", value: "Buổi chiều (13:00–17:30)" },
  { label: "Buổi tối, 18:00–21:00", value: "Buổi tối (18:00–21:00)" },
  { label: "Liên hệ lúc nào cũng được", value: "Bất kỳ thời gian nào" },
]

export function ConsultationForm() {
  const [license, setLicense] = useState(licenseOptions[0].value)
  const [office, setOffice] = useState(offices[0].name)
  const [contactTime, setContactTime] = useState(contactTimeOptions[0].value)
  const [consent, setConsent] = useState(false)
  const [preparedMessage, setPreparedMessage] = useState<string | null>(null)
  const [shared, setShared] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const name = String(formData.get("name") ?? "").trim()
    const phone = String(formData.get("phone") ?? "").trim()
    const note = String(formData.get("note") ?? "").trim()
    const message = [
      "YÊU CẦU TƯ VẤN HỌC LÁI XE",
      `Họ tên: ${name}`,
      `Số điện thoại: ${phone}`,
      `Hạng bằng quan tâm: ${license}`,
      `Cơ sở thuận tiện: ${office}`,
      `Thời gian có thể liên hệ: ${contactTime}`,
      note ? `Nội dung cần tư vấn: ${note}` : null,
    ]
      .filter(Boolean)
      .join("\n")

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Yêu cầu tư vấn học lái xe",
          text: message,
        })
        setShared(true)
        setPreparedMessage(message)
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return
      }
    }

    try {
      await navigator.clipboard.writeText(message)
    } catch {
      // Nội dung vẫn được hiển thị để người dùng sao chép thủ công.
    }
    setShared(false)
    setPreparedMessage(message)
  }

  if (preparedMessage) {
    return (
      <div className="flex flex-col gap-5" role="status" aria-live="polite">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 aria-hidden="true" className="size-6" />
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-navy">
            {shared ? "Đã mở yêu cầu chia sẻ" : "Thông tin đã được chuẩn bị"}
          </h2>
          <p className="mt-2 leading-7 text-muted-foreground">
            {shared
              ? "Nếu bạn đã chọn Zalo và người nhận, Gia Thịnh sẽ phản hồi theo số điện thoại đã cung cấp."
              : "Nội dung đã được sao chép. Mở Zalo, chọn Gia Thịnh và dán tin nhắn để hoàn tất."}
          </p>
        </div>
        <Textarea
          aria-label="Nội dung yêu cầu tư vấn"
          readOnly
          value={preparedMessage}
          className="min-h-36 resize-none rounded-md bg-mist/60"
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href="https://zalo.me/0779666664"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ size: "lg" }), "h-11 rounded-full px-6")}
          >
            <MessageCircle data-icon="inline-start" aria-hidden="true" />
            Mở Zalo Gia Thịnh
          </a>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => setPreparedMessage(null)}
            className="h-11 rounded-full px-6"
          >
            <RotateCcw data-icon="inline-start" aria-hidden="true" />
            Tạo yêu cầu khác
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-extrabold text-navy">Thông tin cần tư vấn</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Điền các mục dưới đây để tư vấn viên hiểu đúng nhu cầu của bạn.
        </p>
      </div>

      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="consultation-name">Họ và tên</FieldLabel>
          <Input
            id="consultation-name"
            name="name"
            autoComplete="name"
            placeholder="Nguyễn Văn An"
            required
            className="h-11 rounded-md"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="consultation-phone">Số điện thoại</FieldLabel>
          <Input
            id="consultation-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="09xx xxx xxx"
            pattern="(?:\+84|0)(?:[ .-]?[0-9]){9}"
            title="Nhập số điện thoại Việt Nam gồm 10 chữ số"
            required
            className="h-11 rounded-md"
          />
        </Field>
      </FieldGroup>

      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel>Hạng bằng quan tâm</FieldLabel>
          <Select
            items={licenseOptions}
            value={license}
            onValueChange={(value) => {
              if (typeof value === "string") setLicense(value)
            }}
          >
            <SelectTrigger className="w-full rounded-md data-[size=default]:h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {licenseOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>Cơ sở thuận tiện</FieldLabel>
          <Select
            items={offices.map((item) => ({ label: item.name, value: item.name }))}
            value={office}
            onValueChange={(value) => {
              if (typeof value === "string") setOffice(value)
            }}
          >
            <SelectTrigger className="w-full rounded-md data-[size=default]:h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {offices.map((item) => (
                  <SelectItem key={item.name} value={item.name}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>

      <Field>
        <FieldLabel>Thời gian thuận tiện để liên hệ</FieldLabel>
        <Select
          items={contactTimeOptions}
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
              {contactTimeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <FieldLabel htmlFor="consultation-note">Bạn cần hỏi thêm điều gì?</FieldLabel>
        <Textarea
          id="consultation-note"
          name="note"
          placeholder="Ví dụ: học phí trọn khóa, lịch học cuối tuần, hồ sơ cần chuẩn bị…"
          className="min-h-20 resize-y rounded-md"
        />

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

      <Button
        type="submit"
        size="lg"
        disabled={!consent}
        className="h-11 w-full rounded-full text-base font-bold"
      >
        Gửi thông tin tư vấn
        <Send data-icon="inline-end" aria-hidden="true" />
      </Button>

    </form>
  )
}
