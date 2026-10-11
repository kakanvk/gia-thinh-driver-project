import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { OfficeList } from "@/components/office-list"
import { StickyHeader } from "@/components/sticky-header"

vi.mock("next/navigation", () => ({ usePathname: () => "/" }))
vi.mock("motion/react", () => ({ useScroll: () => ({ scrollY: 0 }), useMotionValueEvent: () => undefined }))
// jsdom không có IntersectionObserver (header dùng để active nav trên trang chủ)
vi.stubGlobal(
  "IntersectionObserver",
  class {
    observe() {}
    disconnect() {}
  }
)

describe("StickyHeader", () => {
  it("dùng hotline được truyền vào", () => {
    render(<StickyHeader contact={{ hotline: "0909 123 456", telHref: "tel:0909123456" }} />)
    const links = screen.getAllByRole("link").filter((a) => a.getAttribute("href") === "tel:0909123456")
    expect(links.length).toBeGreaterThan(0)
    expect(screen.queryByText(/0779 666 664/)).not.toBeInTheDocument()
  })
})

describe("OfficeList", () => {
  it("liệt kê mọi chi nhánh; có mapUrl thì là link", () => {
    render(
      <OfficeList
        branches={[
          { id: "1", name: "Tân Ngãi", slug: "tan-ngai", officeName: "VP1 — Tân Ngãi", address: "331A", mapUrl: "https://maps.example/1", order: 1 },
          { id: "2", name: "Vũng Liêm", slug: "vung-liem", officeName: "VP Vũng Liêm", address: "QL 53", mapUrl: null, order: 2 },
        ]}
      />
    )
    expect(screen.getByRole("link", { name: /VP1 — Tân Ngãi/ })).toHaveAttribute("href", "https://maps.example/1")
    expect(screen.getByText("VP Vũng Liêm")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /VP Vũng Liêm/ })).not.toBeInTheDocument()
  })

  it("không có dữ liệu → thông báo dự phòng", () => {
    render(<OfficeList branches={null} />)
    expect(screen.getByText(/đang được cập nhật/)).toBeInTheDocument()
  })
})
