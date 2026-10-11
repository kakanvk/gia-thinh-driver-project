"use client"

import { useAuth } from "@/components/admin/auth-provider"
import { hasPermission } from "@/lib/auth/permissions"

export function useCan(permission: string): boolean {
  return hasPermission(useAuth().permissions, permission)
}
