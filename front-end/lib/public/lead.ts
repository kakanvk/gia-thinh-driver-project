import type { BranchPricing } from "@/lib/public/types"

export const NO_COURSE = "none"

export type CourseOption = { code: string; name: string }

// API trả gói đã sắp theo thứ tự hiển thị trong từng chi nhánh: giữ thứ tự gặp đầu tiên
export function courseOptions(pricing: BranchPricing[] | null): CourseOption[] {
  const byCode = new Map<string, CourseOption>()
  for (const branch of pricing ?? []) {
    for (const course of branch.courses) {
      if (!byCode.has(course.code)) byCode.set(course.code, { code: course.code, name: course.name })
    }
  }
  return [...byCode.values()]
}

export type LeadFields = {
  name: string
  phone: string
  branch: string
  courseCode: string
  preferredContactTime: string
  note: string
  website: string
}

const UTM_KEYS = ["source", "medium", "campaign", "term", "content"] as const

export function readUtm(search: string): Record<string, string> | undefined {
  const params = new URLSearchParams(search)
  const utm: Record<string, string> = {}
  for (const key of UTM_KEYS) {
    const value = params.get(`utm_${key}`)?.trim()
    if (value) utm[key] = value.slice(0, 100)
  }
  return Object.keys(utm).length > 0 ? utm : undefined
}

export function buildLeadBody(fields: LeadFields, search: string): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: fields.name.trim(),
    phone: fields.phone.trim(),
    branch: fields.branch,
  }
  if (fields.courseCode && fields.courseCode !== NO_COURSE) body.courseCode = fields.courseCode
  if (fields.preferredContactTime) body.preferredContactTime = fields.preferredContactTime
  const note = fields.note.trim()
  if (note) body.note = note
  body.consent = true
  body.website = fields.website
  const utm = readUtm(search)
  if (utm) body.utm = utm
  return body
}
