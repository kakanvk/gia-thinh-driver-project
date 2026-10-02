import { ScrollReveal } from "@/components/scroll-reveal"
import { TimelineGallery } from "@/components/timeline-gallery"

const milestones = [
  {
    year: "2012",
    title: "Khởi đầu từ lớp A1 nhỏ",
    text: "Một phòng tư vấn, một sân sa hình mượn giờ. Chỉ nhận ít học viên mỗi khóa để kèm kỹ từng người.",
    images: [
      {
        src: "/media/1789307300578_4599662549725482019_4599662549725482019_ad001be0b583fa604cf76a48aa7ad405.jpg",
        alt: "Lớp lý thuyết đông học viên tại trung tâm Gia Thịnh",
      },
      {
        src: "/media/1789307300551_4599662549725482019_4599662549725482019_f8bcfa00a2e8b8b22bc85f65b1947b68.jpg",
        alt: "Học viên nghe giảng luật trong lớp tại Gia Thịnh",
      },
    ],
  },
  {
    year: "2016",
    title: "Sân tập chuẩn sát hạch",
    text: "Có sân tập riêng đúng chuẩn sân thi, bài sa hình B1/B2 được chia nhỏ để học viên yếu cũng theo kịp.",
    images: [
      {
        src: "/media/map/1789307362409_4599662549725482019_4599662549725482019_3e15cc0c135b22be293df84b61f611d1.jpg",
        alt: "Sân sa hình chuẩn sát hạch của trung tâm Gia Thịnh",
      },
      {
        src: "/media/1789307300569_4599662549725482019_4599662549725482019_55b15928ba68463f725b1c80624f85a7.jpg",
        alt: "Khu vực chờ thi tại sân sát hạch",
      },
    ],
  },
  {
    year: "2020",
    title: "Xe đời mới, học cabin",
    text: "Đổi toàn bộ xe tập lái đời mới, thêm cabin mô phỏng và app ôn lý thuyết để học ở nhà vẫn hiệu quả.",
    images: [
      {
        src: "/media/1789307366944_4599662549725482019_4599662549725482019_967a3bf4d808bb7d612acfb0f3d9fc6a.jpg",
        alt: "Dàn xe tập lái đời mới của trung tâm Gia Thịnh",
      },
      {
        src: "/media/1789307366940_4599662549725482019_4599662549725482019_75c4908df6aa52ec8008e66608aacb54.jpg",
        alt: "Xe tập lái tại sân tập của Gia Thịnh",
      },
    ],
  },
  {
    year: "2026",
    title: "Đồng hành đến ngày nhận bằng",
    text: "8.600+ học viên tốt nghiệp, tỉ lệ đạt ngay lần đầu 96%. Lịch học linh hoạt mỗi ngày, minh bạch học phí.",
    images: [
      {
        src: "/media/1789307373617_4599662549725482019_4599662549725482019_6fde98cbf02dab051b15c6b50e57eedf.jpg",
        alt: "Đội xe ô tô và xe tải tập lái của trung tâm Gia Thịnh",
      },
      {
        src: "/media/1789307373534_4599662549725482019_4599662549725482019_21f9f17c5624e14845aca2e2ac4944d7.jpg",
        alt: "Xe tải tập lái in thương hiệu Gia Thịnh",
      },
    ],
  },
]

export function AboutTimeline() {
  return (
    <div className="mx-auto max-w-6xl">
      <ScrollReveal className="mx-auto max-w-2xl text-center">
        <p className="mb-4 font-hand text-3xl font-semibold text-primary sm:text-4xl">
          Về Gia Thịnh
        </p>
        <h2 className="text-3xl font-extrabold tracking-tight text-balance text-navy sm:text-4xl">
          Từ một sân tập nhỏ đến nơi học viên gửi trọn niềm tin
        </h2>
        <p className="mt-5 leading-7 text-muted-foreground">
          Không học mẹo đối phó kỳ thi. Gia Thịnh dạy hiểu luật, lái an toàn và
          bình tĩnh xử lý tình huống thật.
        </p>
      </ScrollReveal>

      <div className="relative mt-14">
        {/* Trục timeline giữa */}
        <span
          aria-hidden="true"
          className="absolute top-0 bottom-0 left-4 w-px bg-gradient-to-b from-primary/40 via-primary/20 to-primary/5 md:left-1/2"
        />
        <ol className="flex flex-col gap-12 md:gap-0">
          {milestones.map((item, index) => {
            const left = index % 2 === 0
            return (
              <li
                key={item.year}
                className="relative md:grid md:grid-cols-2 md:gap-16 md:pb-14 md:last:pb-0"
              >
                {/* Chấm mốc */}
                <span
                  aria-hidden="true"
                  className="absolute top-0.5 left-4 z-10 -translate-x-1/2 md:top-1.5 md:left-1/2"
                >
                  <span className="relative grid size-4 place-items-center">
                    <span className="absolute inset-0 animate-ping rounded-full bg-primary/25 [animation-duration:2.2s]" />
                    <span className="relative size-4 rounded-full border-[3px] border-primary bg-background shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_12%,transparent)]" />
                  </span>
                </span>

                <ScrollReveal
                  className={`pl-12 md:pl-0 ${
                    left
                      ? "md:order-1 md:pr-4 md:text-right"
                      : "md:order-2 md:col-start-2 md:pl-4 md:text-left"
                  }`}
                  delay={0.05 * (index % 2)}
                >
                  <span
                    className={`flex items-center gap-3 ${
                      left ? "md:justify-end" : "md:justify-start"
                    }`}
                  >
                    {left ? (
                      <>
                        <span
                          aria-hidden="true"
                          className="hidden h-px w-10 shrink-0 bg-gradient-to-l from-primary/50 to-primary/10 md:block md:w-14"
                        />
                        <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/[0.07] px-3.5 py-1 text-[13px] font-extrabold tracking-[0.18em] text-primary tabular-nums">
                          {item.year}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/[0.07] px-3.5 py-1 text-[13px] font-extrabold tracking-[0.18em] text-primary tabular-nums">
                          {item.year}
                        </span>
                        <span
                          aria-hidden="true"
                          className="hidden h-px w-10 shrink-0 bg-gradient-to-r from-primary/50 to-primary/10 md:block md:w-14"
                        />
                      </>
                    )}
                  </span>
                  <h3 className="mt-3 text-xl font-extrabold text-navy">
                    {item.title}
                  </h3>
                  <p
                    className={`mt-2 max-w-md text-sm leading-6 text-muted-foreground ${left ? "md:ml-auto" : "md:mr-auto"}`}
                  >
                    {item.text}
                  </p>
                  <TimelineGallery
                    images={item.images}
                    className={`mt-5 md:hidden ${
                      left ? "md:ml-auto" : ""
                    }`}
                  />
                </ScrollReveal>

                <ScrollReveal
                  className={`hidden md:block ${
                    left
                      ? "md:order-2 md:pl-4"
                      : "md:order-1 md:col-start-1 md:row-start-1 md:pr-4 md:text-right"
                  }`}
                  delay={0.12}
                >
                  <TimelineGallery
                    images={item.images}
                    zoom
                  />
                </ScrollReveal>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
