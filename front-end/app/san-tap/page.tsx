import type { Metadata } from "next"

import { SanTapExperience } from "@/components/san-tap/experience"
import { StickyHeader } from "@/components/sticky-header"

export const metadata: Metadata = {
  title: "Sân tập 3D | Trường lái Gia Thịnh",
  description:
    "Xem mô phỏng 3D sân tập Gia Thịnh theo mặt bằng thực tế: đường quanh co chữ S, vòng số 8, bãi đỗ xe, nhà xe mái tôn và khu sát hạch.",
}

export default function Page() {
  return (
    <main data-page="san-tap" className="h-svh overflow-hidden bg-background">
      <StickyHeader />
      <section className="relative h-[calc(100svh-64px)] overflow-hidden">
        <SanTapExperience />
      </section>
    </main>
  )
}
