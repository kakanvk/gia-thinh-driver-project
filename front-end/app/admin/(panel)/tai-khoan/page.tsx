import type { Metadata } from "next"
import { KeyRound, UserCircle } from "lucide-react"

import { PasswordForm, ProfileForm } from "@/components/admin/account-forms"
import { AdminPageHeader, SectionHeading } from "@/components/admin/admin-ui"

export const metadata: Metadata = {
  title: "Tài khoản",
}

export default function AccountPage() {
  return (
    <main id="admin-content" className="p-4">
      <AdminPageHeader title="Tài khoản của tôi" />
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border/70 bg-background p-4">
          <SectionHeading title="Hồ sơ" description="Tên và số điện thoại dùng để đăng nhập." icon={UserCircle} />
          <div className="mt-4">
            <ProfileForm />
          </div>
        </section>
        <section className="rounded-lg border border-border/70 bg-background p-4">
          <SectionHeading title="Đổi mật khẩu" icon={KeyRound} />
          <div className="mt-4">
            <PasswordForm />
          </div>
        </section>
      </div>
    </main>
  )
}
