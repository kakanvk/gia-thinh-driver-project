import { ScrollReveal } from "@/components/scroll-reveal"
import { TimelineGallery } from "@/components/timeline-gallery"

const milestones = [
  {
    year: "2012",
    title: "Khởi đầu từ lớp A1 nhỏ",
    text: "Một phòng tư vấn, một sân sa hình mượn giờ. Chỉ nhận ít học viên mỗi khóa để kèm kỹ từng người.",
    images: [
      {
        src: "https://storage.googleapis.com/gia-thinh-media-storage-dev/2026/11/49008eef-a3c6-4313-94da-fa82deba5cb7.webp",
        alt: "Lớp lý thuyết đông học viên tại trung tâm Gia Thịnh",
      },
      {
        src: "https://storage.googleapis.com/gia-thinh-media-storage-dev/2026/11/1bb09666-fe02-4eb8-86ab-e16782476bd0.webp",
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
        src: "https://storage.googleapis.com/gia-thinh-media-storage-dev/2026/11/53b9f8eb-1ae3-47e4-9a4a-3f99d22acf4e.webp",
        alt: "Sân sa hình chuẩn sát hạch của trung tâm Gia Thịnh",
      },
      {
        src: "https://storage.googleapis.com/gia-thinh-media-storage-dev/2026/11/2afa78d9-d378-4488-8914-e5060fa89c87.webp",
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
        src: "https://storage.googleapis.com/gia-thinh-media-storage-dev/2026/11/ea3c3599-dde8-42ba-b7e4-ceb8e1d2e087.webp",
        alt: "Dàn xe tập lái đời mới của trung tâm Gia Thịnh",
      },
      {
        src: "https://storage.googleapis.com/gia-thinh-media-storage-dev/2026/10/28470149-6246-4895-b5d8-30f607607fe3.webp",
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
        src: "https://storage.googleapis.com/gia-thinh-media-storage-dev/2026/11/b2f13863-362c-4535-b55f-a149ac6421ce.webp",
        alt: "Đội xe ô tô và xe tải tập lái của trung tâm Gia Thịnh",
      },
      {
        src: "https://storage.googleapis.com/gia-thinh-media-storage-dev/2026/11/9e653052-9f04-4588-8c6a-3dff18959496.webp",
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
