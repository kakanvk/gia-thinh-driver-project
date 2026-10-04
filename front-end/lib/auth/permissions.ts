export type Role =
  "super_admin" | "branch_manager" | "consultant" | "editor" | "instructor"

// Cùng luật với back-end/src/config/roles.ts: "*", trùng khớp, hoặc "<tài nguyên>.*"
export function hasPermission(
  permissions: readonly string[],
  required: string | null
): boolean {
  if (required === null) return true
  const [resource] = required.split(".")
  return permissions.some(
    (granted) =>
      granted === "*" || granted === required || granted === `${resource}.*`
  )
}
