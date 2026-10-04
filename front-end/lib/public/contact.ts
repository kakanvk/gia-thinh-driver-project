import type { PublicSettings } from "@/lib/public/types"

export type SiteContact = {
  hotline: string
  telHref: string
  zaloHref: string
  contactTimes: { label: string; value: string }[]
  registerNotes: string[]
}

export const DEFAULT_HOTLINE = "0779 666 664"

export const DEFAULT_CONTACT_TIMES = [
  { label: "Buổi sáng, 07:00–11:30", value: "Buổi sáng (07:00–11:30)" },
  { label: "Buổi chiều, 13:00–17:30", value: "Buổi chiều (13:00–17:30)" },
  { label: "Buổi tối, 18:00–21:00", value: "Buổi tối (18:00–21:00)" },
  { label: "Liên hệ lúc nào cũng được", value: "Bất kỳ thời gian nào" },
]

export const DEFAULT_REGISTER_NOTES = [
  "Học phí công khai giá gốc — nên đến trực tiếp văn phòng Gia Thịnh để đăng ký.",
  "Đã có GPLX trước đây phải trình báo cho nhân viên tư vấn khi đăng ký.",
  "Đăng ký xong nhớ lấy biên lai và liên hệ Gia Thịnh để vào nhóm Zalo nhận lịch ôn, thi.",
  "Có hỗ trợ ôn kèm luật 1:1 (phí riêng) nếu có nhu cầu.",
]

export function toSiteContact(settings: PublicSettings | null): SiteContact {
  const hotline = settings?.hotline?.trim() || DEFAULT_HOTLINE
  const digits = hotline.replace(/\D/g, "")
  return {
    hotline,
    telHref: `tel:${digits}`,
    // zaloOa là tên OA, không phải đường dẫn: Zalo cá nhân theo số hotline
    zaloHref: `https://zalo.me/${digits}`,
    contactTimes: settings?.consultationContactTimes?.length
      ? settings.consultationContactTimes
      : DEFAULT_CONTACT_TIMES,
    registerNotes: settings?.registerNotes?.length ? settings.registerNotes : DEFAULT_REGISTER_NOTES,
  }
}
