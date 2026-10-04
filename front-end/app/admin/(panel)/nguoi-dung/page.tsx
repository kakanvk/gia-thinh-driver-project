import type { Metadata } from "next"
import { Download, MoreHorizontal, Plus, UserRound } from "lucide-react"

import {
  AdminPageHeader,
  StatusPill,
  TableToolbar,
} from "@/components/admin/admin-ui"
import { adminUsers } from "@/lib/admin-data"

export const metadata: Metadata = {
  title: "Người dùng",
}

export default function UsersPage() {
  return (
    <main id="admin-content" className="p-4">
      <AdminPageHeader
        title="Danh sách người dùng"
        action={
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Xuất danh sách người dùng"
              className="grid size-9 place-items-center rounded-md border border-border bg-background hover:bg-muted"
            >
              <Download aria-hidden="true" className="size-4" />
            </button>
            <button
              type="button"
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-primary/85"
            >
              <Plus aria-hidden="true" className="size-4" />
              Thêm người dùng
            </button>
          </div>
        }
      />

      <section
        className="mt-4 grid divide-y divide-border/70 rounded-lg border border-border/70 bg-background sm:grid-cols-3 sm:divide-x sm:divide-y-0"
        aria-label="Thống kê người dùng"
      >
        {[
          ["Học viên", "462", "95% tổng tài khoản"],
          ["Giáo viên", "18", "14 đang có lịch dạy"],
          ["Nhân viên", "6", "Tư vấn và quản trị"],
        ].map(([label, value, note]) => (
          <article key={label} className="flex items-center gap-3 px-4 py-3">
            <span className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary">
              <UserRound aria-hidden="true" className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-navy">{value}</span>
                <span className="text-[13px] font-semibold">{label}</span>
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {note}
              </span>
            </span>
          </article>
        ))}
      </section>

      <section className="mt-4 overflow-hidden rounded-lg border border-border/70 bg-background">
        <TableToolbar
          searchLabel="Tìm người dùng"
          searchPlaceholder="Tên, email hoặc số điện thoại..."
          summary={`${adminUsers.length} người dùng`}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-[13px]">
            <thead className="bg-muted/60 text-[11px] tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="w-12 px-5 py-3 text-center font-semibold">#</th>
                <th className="px-3 py-3 font-semibold">Người dùng</th>
                <th className="px-3 py-3 font-semibold">Liên hệ</th>
                <th className="px-3 py-3 font-semibold">Vai trò</th>
                <th className="px-3 py-3 font-semibold">Hạng bằng</th>
                <th className="px-3 py-3 font-semibold">Ngày tham gia</th>
                <th className="px-3 py-3 font-semibold">Trạng thái</th>
                <th className="w-14 px-3 py-3">
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {adminUsers.map((user, index) => (
                <tr key={user.email} className="hover:bg-muted/35">
                  <td className="px-5 py-4 text-center font-medium text-muted-foreground tabular-nums">
                    {index + 1}
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={`grid size-9 place-items-center rounded-md text-[11px] font-semibold ${index % 3 === 0 ? "bg-primary/10 text-primary" : index % 3 === 1 ? "bg-signal/20 text-navy" : "bg-highlight/25 text-foreground"}`}
                      >
                        {user.initials}
                      </span>
                      <span>
                        <span className="block font-semibold text-foreground">
                          {user.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          ID GT-{String(index + 1042)}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <span className="block font-medium">{user.phone}</span>
                    <span className="block text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </td>
                  <td className="px-3 py-4 font-semibold">{user.role}</td>
                  <td className="px-3 py-4 text-muted-foreground">
                    {user.course}
                  </td>
                  <td className="px-3 py-4 text-muted-foreground">
                    {user.joined}
                  </td>
                  <td className="px-3 py-4">
                    <StatusPill status={user.status} />
                  </td>
                  <td className="px-3 py-4">
                    <button
                      type="button"
                      aria-label={`Tùy chọn cho ${user.name}`}
                      className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <MoreHorizontal aria-hidden="true" className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-border/70 px-5 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Hiển thị 1–8 trong 486 người dùng</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled
              className="min-h-8 rounded-md border border-border px-3 font-medium disabled:opacity-40"
            >
              Trước
            </button>
            <button
              type="button"
              className="min-h-8 rounded-md border border-border px-3 font-medium text-foreground hover:bg-muted"
            >
              Sau
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
