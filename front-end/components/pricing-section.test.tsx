import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { PricingSection } from "@/components/pricing-section"
import type { BranchPricing, PricingCourse } from "@/lib/public/types"

const course = (over: Partial<PricingCourse>): PricingCourse => ({
  code: "A1",
  name: "Hạng A1",
  vehicleType: "moto",
  description: "Xe đến 125cc",
  duration: "2 ngày lý thuyết",
  image: null,
  price: 620000,
  priceNote: "Đã gồm lệ phí",
  fees: [{ key: "cb", label: "Xe cảm biến", amount: 20000, amountMax: null, unit: "vòng", note: null }],
  discounts: [{ key: "hssv", label: "HSSV giảm", amount: 500000, amountMax: null, unit: null, note: null }],
  ...over,
})

const pricing: BranchPricing[] = [
  {
    branch: { name: "Tân Ngãi", slug: "tan-ngai", officeName: "VP1 — Tân Ngãi", address: "" },
    courses: [course({}), course({ code: "B", name: "Hạng B", vehicleType: "car", price: 16500000 })],
  },
  {
    branch: { name: "Vũng Liêm", slug: "vung-liem", officeName: "VP Vũng Liêm", address: "" },
    courses: [course({ price: 790000 })],
  },
  { branch: { name: "Mới", slug: "moi", officeName: "VP Mới", address: "" }, courses: [] },
]

const hotline = { display: "0779 666 664", telHref: "tel:0779666664" }

describe("PricingSection", () => {
  it("mặc định chi nhánh đầu, đổi tab đổi giá và link tư vấn", async () => {
    render(<PricingSection pricing={pricing} hotline={hotline} />)
    expect(screen.getByText("620.000đ")).toBeInTheDocument()
    expect(screen.getByText("16.500.000đ")).toBeInTheDocument()
    // Hai gói của Tân Ngãi dùng chung phí mẫu
    expect(screen.getAllByText("Xe cảm biến: 20.000đ/vòng")).toHaveLength(2)
    expect(screen.getAllByRole("link", { name: /Tư vấn gói này/ })[0]).toHaveAttribute(
      "href",
      "/tu-van?branch=tan-ngai&course=A1"
    )
    await userEvent.click(screen.getByRole("tab", { name: "VP Vũng Liêm" }))
    expect(screen.getByText("790.000đ")).toBeInTheDocument()
    expect(screen.queryByText("16.500.000đ")).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Tư vấn gói này/ })).toHaveAttribute(
      "href",
      "/tu-van?branch=vung-liem&course=A1"
    )
  })

  it("chi nhánh không có gói → thông báo, không vỡ", async () => {
    render(<PricingSection pricing={pricing} hotline={hotline} />)
    await userEvent.click(screen.getByRole("tab", { name: "VP Mới" }))
    expect(screen.getByText(/chưa công bố học phí/)).toBeInTheDocument()
  })

  it("không có dữ liệu → khối dự phòng có hotline", () => {
    render(<PricingSection pricing={null} hotline={hotline} />)
    expect(screen.getByRole("link", { name: /0779 666 664/ })).toHaveAttribute("href", "tel:0779666664")
  })
})
