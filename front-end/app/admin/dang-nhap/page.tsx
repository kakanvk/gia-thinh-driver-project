import type { Metadata } from "next"
import { Suspense } from "react"

import { LoginForm } from "@/components/admin/login-form"

export const metadata: Metadata = {
  title: "Đăng nhập",
}

// useSearchParams trong LoginForm cần Suspense để build tĩnh được
export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
