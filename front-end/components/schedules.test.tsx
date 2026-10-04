import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ClassSchedule } from "@/components/class-schedule"
import { ExamSchedule } from "@/components/exam-schedule"
import type { UpcomingClass, UpcomingExam } from "@/lib/public/types"

const cls = (i: number, over: Partial<UpcomingClass> = {}): UpcomingClass => ({
  code: `L${i}`,
  course: { code: "B", name: "Hạng B" },
  transmission: "manual",
  branch: { name: "Tân Ngãi", slug: "tan-ngai" },
  startDate: "2026-10-21T00:00:00+07:00",
  endDate: "2027-01-21T00:00:00+07:00",
  scheduleText: "Tối T2–T6",
  seatsLeft: 12,
  status: "enrolling",
  ...over,
})

describe("ClassSchedule", () => {
  it("hiện tối đa 8 lớp với trạng thái và link giữ chỗ", () => {
    const classes = Array.from({ length: 10 }, (_, i) => cls(i, i === 0 ? { seatsLeft: 3 } : {}))
    render(<ClassSchedule classes={classes} />)
    expect(screen.getAllByRole("link", { name: /Giữ chỗ lớp này/ })).toHaveLength(8)
    expect(screen.getAllByText("Hạng B (số sàn)")).toHaveLength(8)
    expect(screen.getByText("Sắp đủ lớp")).toBeInTheDocument()
    expect(screen.getByText("Còn 3 chỗ")).toBeInTheDocument()
    expect(screen.getAllByText("21/10/2026").length).toBeGreaterThan(0)
    expect(screen.getAllByRole("link", { name: /Giữ chỗ lớp này/ })[0]).toHaveAttribute(
      "href",
      "/tu-van?branch=tan-ngai&course=B"
    )
  })

  it("rỗng hoặc lỗi → thông báo", () => {
    render(<ClassSchedule classes={[]} />)
    expect(screen.getByText(/Chưa có lớp sắp khai giảng/)).toBeInTheDocument()
  })
})

describe("ExamSchedule", () => {
  it("hiện loại thi, gói, chi nhánh, ngày, địa điểm", () => {
    const exams: UpcomingExam[] = [
      { type: "official", course: { code: "A1", name: "Hạng A1" }, branch: { name: "Vũng Liêm", slug: "vung-liem" }, date: "2026-11-02T07:30:00+07:00", location: "Sân thi Vũng Liêm" },
    ]
    render(<ExamSchedule exams={exams} />)
    expect(screen.getByText("Thi sát hạch")).toBeInTheDocument()
    expect(screen.getByText("Hạng A1")).toBeInTheDocument()
    expect(screen.getByText("02/11/2026")).toBeInTheDocument()
    expect(screen.getByText(/Sân thi Vũng Liêm/)).toBeInTheDocument()
  })

  it("rỗng → thông báo", () => {
    render(<ExamSchedule exams={null} />)
    expect(screen.getByText(/Chưa có lịch thi mới/)).toBeInTheDocument()
  })
})
