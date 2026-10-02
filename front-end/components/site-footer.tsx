import Image from "next/image"

import { offices } from "@/lib/contact"

const officeColumns = [
  [offices[4], offices[0], offices[1]],
  offices.slice(2, 4),
]

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-mist">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 md:grid-cols-[1fr_2fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <Image
              src="/giathinh-logo.png"
              alt="Logo Gia Thịnh đào tạo lái xe"
              width={160}
              height={48}
              loading="lazy"
              className="h-10 w-auto"
            />
            <span className="flex flex-col leading-none">
              <span className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Trung tâm đào tạo lái xe
              </span>
              <strong className="mt-1 font-extrabold text-logo-red">GIA THỊNH</strong>
            </span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">
            Đào tạo lái xe an toàn, minh bạch chi phí và đồng hành đến ngày nhận bằng.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-extrabold text-navy">Liên hệ</h2>
          <div className="mt-4 grid gap-2 text-sm leading-5 text-muted-foreground lg:grid-cols-2 lg:gap-6">
            {officeColumns.map((column, index) => (
              <div key={index} className="flex flex-col gap-2">
                {column.map((office) => (
                  <p key={office.name}>
                    <strong className="font-bold text-navy">{office.name}:</strong>{" "}
                    {office.address}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-extrabold text-navy">Giờ làm việc</h2>
          <div className="mt-2 flex flex-col gap-3 text-sm text-muted-foreground">
            <a
              href="tel:0779666664"
              className="inline-flex min-h-11 items-center font-bold text-navy hover:text-primary"
            >
              0779 666 664 (Zalo)
            </a>
            <p>Thứ 2 – Thứ 7: 07:00 – 21:00</p>
            <p>Chủ nhật: 08:00 – 17:00</p>
            <p>Nhận hồ sơ tất cả các ngày</p>
          </div>
        </div>
      </div>
      {/* pb lớn trên mobile để nút gọi nổi không che dòng bản quyền */}
      <div className="border-t border-border px-5 pt-5 pb-24 text-center text-xs text-muted-foreground lg:pb-5">
        © 2026 Trung tâm đào tạo lái xe Gia Thịnh. Thông tin trên trang là dữ liệu mẫu.
      </div>
    </footer>
  )
}
