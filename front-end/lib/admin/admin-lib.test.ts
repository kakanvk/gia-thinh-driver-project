import { describe, expect, it } from "vitest"

import { canTransition, nextStatuses } from "@/lib/admin/lead-status"
import {
  formatDate,
  formatDateTime,
  isOverdue,
  monthOf,
  shiftMonth,
  toLocalInput,
  todayVn,
  toVnIso,
} from "@/lib/admin/datetime"
import { LEAD_STATUS_LABELS, LEAD_STATUSES } from "@/lib/admin/labels"
import type { LeadStatus } from "@/lib/admin/types"

describe("lead-status giống luật backend", () => {
  const all = LEAD_STATUSES as readonly LeadStatus[]
  const pipeline: LeadStatus[] = [
    "new",
    "contacted",
    "consulted",
    "deposited",
    "docs_completed",
  ]
  const backend = (from: LeadStatus, to: LeadStatus) => {
    if (from === to || from === "enrolled" || to === "enrolled") return false
    if (to === "lost") return true
    if (from === "lost") return to === "contacted"
    return pipeline.indexOf(to) > pipeline.indexOf(from)
  }
  it("mọi cặp khớp", () => {
    for (const from of all)
      for (const to of all)
        expect(canTransition(from, to)).toBe(backend(from, to))
  })
  it("nextStatuses", () => {
    expect(nextStatuses("contacted")).toEqual([
      "consulted",
      "deposited",
      "docs_completed",
      "lost",
    ])
    expect(nextStatuses("lost")).toEqual(["contacted"])
    expect(nextStatuses("enrolled")).toEqual([])
  })
  it("nhãn", () => {
    expect(LEAD_STATUS_LABELS.docs_completed).toBe("Hoàn tất hồ sơ")
  })
})

describe("datetime VN", () => {
  it("chuyển qua lại không phụ thuộc múi giờ", () => {
    expect(toVnIso("2026-10-21T08:30")).toBe("2026-10-21T08:30:00+07:00")
    expect(toLocalInput("2026-10-21T08:30:00+07:00")).toBe("2026-10-21T08:30")
    expect(toLocalInput(null)).toBe("")
    expect(formatDateTime("2026-10-21T08:30:00+07:00")).toBe("21/10/2026 08:30")
    expect(formatDate("2026-10-21T08:30:00+07:00")).toBe("21/10/2026")
  })
  it("ngày hôm nay và tháng theo giờ VN", () => {
    // 2026-10-20T18:00Z = 21/10 01:00 giờ VN
    expect(todayVn(new Date("2026-10-20T18:00:00Z"))).toBe("2026-10-21")
    expect(monthOf("2026-10-21")).toBe("2026-10")
    expect(shiftMonth("2026-12", 1)).toBe("2027-01")
    expect(shiftMonth("2026-01", -1)).toBe("2025-12")
  })
  it("quá hạn", () => {
    const now = new Date("2026-10-21T02:00:00Z") // 09:00 VN
    expect(isOverdue("2026-10-21T08:30:00+07:00", now)).toBe(true)
    expect(isOverdue("2026-10-21T10:00:00+07:00", now)).toBe(false)
    expect(isOverdue(null, now)).toBe(false)
  })
})
