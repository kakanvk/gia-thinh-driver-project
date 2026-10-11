import { describe, expect, it } from "vitest"

import {
  CANDIDATE_RESULT_LABELS,
  CANDIDATE_RESULTS,
  CLASS_STATUS_LABELS,
  CLASS_STATUSES,
  EXAM_STATUS_LABELS,
  EXAM_STATUSES,
  EXAM_TYPE_LABELS,
  INSTRUCTOR_STATUS_LABELS,
  INSTRUCTOR_STATUSES,
  STUDENT_STATUS_LABELS,
  STUDENT_STATUSES,
  TRANSMISSION_LABELS,
  VEHICLE_STATUS_LABELS,
  VEHICLE_STATUSES,
} from "@/lib/admin/labels"
import {
  classTitle,
  formatPassRate,
  passRate,
  transmissionLabel,
} from "@/lib/admin/training"

describe("passRate", () => {
  it("đậu / (thí sinh − vắng − chờ) × 100", () => {
    expect(
      passRate({ candidates: 10, passed: 6, failed: 2, absent: 1, pending: 1 })
    ).toBe(75)
  })

  it("mẫu 0 (chưa có thí sinh, toàn vắng hoặc chờ) → null", () => {
    expect(
      passRate({ candidates: 0, passed: 0, failed: 0, absent: 0, pending: 0 })
    ).toBeNull()
    expect(
      passRate({ candidates: 3, passed: 0, failed: 0, absent: 3, pending: 0 })
    ).toBeNull()
    expect(
      passRate({ candidates: 4, passed: 0, failed: 0, absent: 1, pending: 3 })
    ).toBeNull()
  })

  it("làm tròn 1 chữ số thập phân", () => {
    expect(
      passRate({ candidates: 3, passed: 2, failed: 1, absent: 0, pending: 0 })
    ).toBe(66.7)
  })
})

describe("formatPassRate", () => {
  it("dấu phẩy thập phân, '—' khi null", () => {
    expect(formatPassRate(75)).toBe("75%")
    expect(formatPassRate(85.5)).toBe("85,5%")
    expect(formatPassRate(0)).toBe("0%")
    expect(formatPassRate(null)).toBe("—")
    expect(formatPassRate(undefined)).toBe("—")
  })
})

describe("transmissionLabel / classTitle", () => {
  it("nhãn số, rỗng khi không có", () => {
    expect(transmissionLabel("manual")).toBe("Số sàn")
    expect(transmissionLabel("automatic")).toBe("Số tự động")
    expect(transmissionLabel(null)).toBe("")
  })

  it("mã gói kèm số", () => {
    expect(
      classTitle({
        courseCode: "B",
        course: { id: "c1", code: "B1", name: "Hạng B1" },
        transmission: "automatic",
      })
    ).toBe("B1 · Số tự động")
    expect(
      classTitle({ courseCode: "C1", course: null, transmission: null })
    ).toBe("C1")
  })
})

describe("nhãn đào tạo", () => {
  it("đúng chữ theo spec", () => {
    expect(STUDENT_STATUS_LABELS).toEqual({
      studying: "Đang học",
      paused: "Tạm dừng",
      completed: "Hoàn thành",
      dropped: "Thôi học",
    })
    expect(CLASS_STATUS_LABELS).toEqual({
      enrolling: "Đang nhận hồ sơ",
      upcoming: "Sắp khai giảng",
      ongoing: "Đang học",
      finished: "Đã kết thúc",
    })
    expect(EXAM_TYPE_LABELS).toEqual({
      graduation: "Tốt nghiệp",
      official: "Sát hạch",
    })
    expect(EXAM_STATUS_LABELS).toEqual({
      scheduled: "Đã lên lịch",
      done: "Đã có kết quả",
      cancelled: "Đã hủy",
    })
    expect(CANDIDATE_RESULT_LABELS).toEqual({
      pending: "Chờ kết quả",
      passed: "Đậu",
      failed: "Trượt",
      absent: "Vắng",
    })
    expect(INSTRUCTOR_STATUS_LABELS).toEqual({
      active: "Đang hoạt động",
      on_leave: "Tạm nghỉ",
      inactive: "Nghỉ việc",
    })
    expect(VEHICLE_STATUS_LABELS).toEqual({
      active: "Đang chạy",
      maintenance: "Bảo dưỡng",
      paused: "Tạm dừng",
    })
    expect(TRANSMISSION_LABELS).toEqual({
      manual: "Số sàn",
      automatic: "Số tự động",
    })
  })

  it("danh sách giá trị khớp backend", () => {
    expect(STUDENT_STATUSES).toEqual([
      "studying",
      "paused",
      "completed",
      "dropped",
    ])
    expect(CLASS_STATUSES).toEqual([
      "enrolling",
      "upcoming",
      "ongoing",
      "finished",
    ])
    expect(EXAM_STATUSES).toEqual(["scheduled", "done", "cancelled"])
    expect(CANDIDATE_RESULTS).toEqual(["pending", "passed", "failed", "absent"])
    expect(INSTRUCTOR_STATUSES).toEqual(["active", "on_leave", "inactive"])
    expect(VEHICLE_STATUSES).toEqual(["active", "maintenance", "paused"])
  })
})
