import type { Role } from "@/lib/auth/permissions"

export type SessionUser = {
  id: string
  name: string
  username: string
  phone: string
  role: Role
  branchIds: string[]
  status: string
}
