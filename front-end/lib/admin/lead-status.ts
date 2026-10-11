import type { LeadStatus } from "@/lib/admin/types"

export const PIPELINE: LeadStatus[] = [
  "new",
  "contacted",
  "consulted",
  "deposited",
  "docs_completed",
]

// Trạng thái còn theo dõi (giống OPEN_STATUSES ở backend)
export function isOpenStatus(status: LeadStatus): boolean {
  return PIPELINE.includes(status)
}

// Giống back-end/src/modules/leads/lead.status.ts
export function canTransition(from: LeadStatus, to: LeadStatus): boolean {
  if (from === to || from === "enrolled" || to === "enrolled") return false
  if (to === "lost") return true
  if (from === "lost") return to === "contacted"
  return PIPELINE.indexOf(to) > PIPELINE.indexOf(from)
}

export function nextStatuses(from: LeadStatus): LeadStatus[] {
  return [...PIPELINE, "lost" as const].filter((to) => canTransition(from, to))
}
