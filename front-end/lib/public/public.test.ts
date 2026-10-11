import { describe, expect, it } from "vitest"

import { toSiteContact, DEFAULT_CONTACT_TIMES, DEFAULT_REGISTER_NOTES } from "@/lib/public/contact"
import {
  classStatus,
  classTitle,
  consultHref,
  formatDate,
  formatPricingItem,
  formatVnd,
  readTimeLabel,
  seatsLabel,
} from "@/lib/public/format"
import { buildLeadBody, courseOptions, NO_COURSE, readUtm } from "@/lib/public/lead"
import type { BranchPricing, PricingItem, UpcomingClass } from "@/lib/public/types"

const item = (over: Partial<PricingItem>): PricingItem => ({
  key: "k",
  label: "Thuê xe cảm biến",
  amount: null,
  amountMax: null,
  unit: null,
  note: null,
  ...over,
})

const upcoming = (over: Partial<UpcomingClass>): UpcomingClass => ({
  code: "L1",
  course: { code: "B", name: "Hạng B" },
  transmission: "automatic",
  branch: { name: "Tân Ngãi", slug: "tan-ngai" },
  startDate: "2026-10-21T00:00:00+07:00",
  endDate: "2027-01-21T00:00:00+07:00",
  scheduleText: "T2–T6",
  seatsLeft: 12,
  status: "enrolling",
  ...over,
})

describe("format", () => {
  it("tiền và mục phí", () => {
    expect(formatVnd(1750000)).toBe("1.750.000đ")
    expect(formatPricingItem(item({ amount: 300000, amountMax: 600000, unit: "giờ" }))).toBe(
      "Thuê xe cảm biến: 300.000–600.000đ/giờ"
    )
    expect(formatPricingItem(item({ amount: 70000, unit: "vòng", note: "xe A" }))).toBe(
      "Thuê xe cảm biến: 70.000đ/vòng (xe A)"
    )
    expect(formatPricingItem(item({ amount: 50000, amountMax: 50000 }))).toBe("Thuê xe cảm biến: 50.000đ")
    expect(formatPricingItem(item({ note: "tuỳ nhu cầu" }))).toBe("Thuê xe cảm biến (tuỳ nhu cầu)")
  })

  it("ngày và thời gian đọc không phụ thuộc múi giờ", () => {
    expect(formatDate("2026-10-21T00:00:00+07:00")).toBe("21/10/2026")
    expect(formatDate("không phải ngày")).toBe("không phải ngày")
    expect(readTimeLabel(0)).toBe("1 phút đọc")
    expect(readTimeLabel(4)).toBe("4 phút đọc")
  })

  it("lớp khai giảng", () => {
    expect(classTitle(upcoming({}))).toBe("Hạng B (số tự động)")
    expect(classTitle(upcoming({ transmission: null }))).toBe("Hạng B")
    expect(classStatus(upcoming({ seatsLeft: 5 }))).toEqual({ label: "Sắp đủ lớp", urgent: true })
    expect(classStatus(upcoming({}))).toEqual({ label: "Đang nhận hồ sơ", urgent: false })
    expect(classStatus(upcoming({ status: "upcoming" }))).toEqual({ label: "Sắp khai giảng", urgent: false })
    expect(seatsLabel(0)).toBe("Hết chỗ")
    expect(seatsLabel(8)).toBe("Còn 8 chỗ")
  })

  it("link tư vấn", () => {
    expect(consultHref("tan-ngai", "B")).toBe("/tu-van?branch=tan-ngai&course=B")
    expect(consultHref("tan-ngai")).toBe("/tu-van?branch=tan-ngai")
  })
})

describe("toSiteContact", () => {
  it("dùng settings khi có", () => {
    const contact = toSiteContact({
      hotline: "0909 123 456",
      consultationContactTimes: [{ label: "Sáng", value: "Sáng" }],
      registerNotes: ["Mang CCCD"],
    })
    expect(contact).toEqual({
      hotline: "0909 123 456",
      telHref: "tel:0909123456",
      zaloHref: "https://zalo.me/0909123456",
      contactTimes: [{ label: "Sáng", value: "Sáng" }],
      registerNotes: ["Mang CCCD"],
    })
  })

  it("thiếu settings → mặc định", () => {
    const contact = toSiteContact(null)
    expect(contact.hotline).toBe("0779 666 664")
    expect(contact.telHref).toBe("tel:0779666664")
    expect(contact.contactTimes).toBe(DEFAULT_CONTACT_TIMES)
    expect(contact.registerNotes).toBe(DEFAULT_REGISTER_NOTES)
    expect(toSiteContact({ hotline: "  ", registerNotes: [] }).registerNotes).toBe(DEFAULT_REGISTER_NOTES)
  })
})

describe("lead", () => {
  // API trả gói đã sắp theo thứ tự hiển thị trong từng chi nhánh (không có trường order)
  const pricing = [
    { branch: { name: "A", slug: "a", officeName: "VP A", address: "" }, courses: [
      { code: "A1", name: "Hạng A1" },
      { code: "B", name: "Hạng B" },
    ] },
    { branch: { name: "C", slug: "c", officeName: "VP C", address: "" }, courses: [
      { code: "A1", name: "Hạng A1" },
      { code: "C1", name: "Hạng C1" },
    ] },
  ] as unknown as BranchPricing[]

  it("danh sách gói duy nhất theo thứ tự", () => {
    expect(courseOptions(pricing)).toEqual([
      { code: "A1", name: "Hạng A1" },
      { code: "B", name: "Hạng B" },
      { code: "C1", name: "Hạng C1" },
    ])
    expect(courseOptions(null)).toEqual([])
  })

  it("utm từ URL", () => {
    expect(readUtm("?utm_source=fb&utm_campaign=%20thang10%20&x=1")).toEqual({
      source: "fb",
      campaign: "thang10",
    })
    expect(readUtm("")).toBeUndefined()
  })

  it("body gửi lead", () => {
    const fields = {
      name: " An ",
      phone: " 0909123456 ",
      branch: "tan-ngai",
      courseCode: "B",
      preferredContactTime: "Buổi sáng",
      note: "  ",
      website: "",
    }
    expect(buildLeadBody(fields, "?utm_source=fb")).toEqual({
      name: "An",
      phone: "0909123456",
      branch: "tan-ngai",
      courseCode: "B",
      preferredContactTime: "Buổi sáng",
      consent: true,
      website: "",
      utm: { source: "fb" },
    })
    expect(buildLeadBody({ ...fields, courseCode: NO_COURSE, note: "Học tối" }, "")).toEqual({
      name: "An",
      phone: "0909123456",
      branch: "tan-ngai",
      preferredContactTime: "Buổi sáng",
      note: "Học tối",
      consent: true,
      website: "",
    })
  })
})
