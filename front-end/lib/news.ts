export const newsCategories = [
  {
    slug: "kinh-nghiem-thi",
    name: "Kinh nghiệm thi",
    description: "Mẹo ôn lý thuyết, chạy sa hình và giữ bình tĩnh trong ngày sát hạch.",
  },
  {
    slug: "kinh-nghiem-hoc",
    name: "Kinh nghiệm học",
    description: "Chạy DAT, cabin mô phỏng và cách sắp xếp lịch học thực hành.",
  },
  {
    slug: "tu-van-chon-bang",
    name: "Tư vấn chọn bằng",
    description: "So sánh hạng A, A1, B, C1 theo nhu cầu đi lại và loại xe bạn đang dùng.",
  },
  {
    slug: "hoc-phi-minh-bach",
    name: "Học phí minh bạch",
    description: "Trọn gói gồm những gì, phụ phí nào phát sinh và ưu đãi dành cho HSSV.",
  },
  {
    slug: "thong-bao",
    name: "Thông báo",
    description: "Lịch khai giảng, hồ sơ cần chuẩn bị và thông tin mới từ trung tâm.",
  },
] as const

export type NewsCategory = (typeof newsCategories)[number]
export type NewsCategorySlug = NewsCategory["slug"]
export type NewsCategoryName = NewsCategory["name"]

/** Chuyên mục được tách riêng thành khối "Thông báo" thay vì nằm trong lưới bài viết. */
export const announcementCategorySlug: NewsCategorySlug = "thong-bao"

export type NewsPost = {
  slug: string
  title: string
  excerpt: string
  category: NewsCategoryName
  categorySlug: NewsCategorySlug
  date: string
  readTime: string
  image: string
  imageAlt: string
  content: string[]
}

export const newsPosts: NewsPost[] = [
  {
    slug: "5-luu-y-truoc-ngay-thi-sat-hach-a1",
    title: "5 lưu ý trước ngày thi sát hạch A1",
    excerpt:
      "Giấy tờ cần mang, giờ có mặt, cách chạy sa hình Wave và mẹo giữ bình tĩnh trong phòng thi lý thuyết.",
    category: "Kinh nghiệm thi",
    categorySlug: "kinh-nghiem-thi",
    date: "06/09/2026",
    readTime: "4 phút đọc",
    image:
      "/media/1789307300348_4599662549725482019_4599662549725482019_fdc3b40a8c3079067cf0cad66a40d03b.jpg",
    imageAlt: "Toàn cảnh sân tập và sát hạch của trung tâm Gia Thịnh nhìn từ trên cao",
    content: [
      "Mang đủ CCCD bản gốc, biên lai đăng ký và có mặt trước giờ thi ít nhất 30 phút để làm thủ tục, nhận số báo danh và nghe phổ biến quy chế.",
      "Phần lý thuyết 25 câu, cần đúng 21 câu và không sai câu điểm liệt. Những câu về nồng độ cồn, tốc độ tối đa và nhường đường nên ôn kỹ vì rất dễ mất điểm.",
      "Bài sa hình thi bằng xe Wave: giữ ga đều, mắt nhìn xa, vào vòng số 8 bằng số 2 và tuyệt đối không chống chân hay cán vạch.",
      "Trước kỳ thi khoảng 3 ngày, sân thi Gia Thịnh mở xe cảm biến thi thử (hạng A1: 20.000đ/vòng). Nên chạy thử 2–3 vòng để quen xe và quen vạch cảm biến.",
      "Nếu đã có bằng lái ô tô, bạn được miễn thi lý thuyết — nhớ báo với nhân viên tư vấn khi đăng ký để được trừ 60.000đ học phí.",
    ],
  },
  {
    slug: "phan-biet-hang-a-a1-moi",
    title: "Phân biệt hạng A và A1 theo quy định mới",
    excerpt:
      "Hạng A chạy được xe trên 125cc, hạng A1 giới hạn đến 125cc — chọn sao cho đúng nhu cầu và tiết kiệm học phí.",
    category: "Tư vấn chọn bằng",
    categorySlug: "tu-van-chon-bang",
    date: "28/08/2026",
    readTime: "3 phút đọc",
    image:
      "/media/1789307300543_4599662549725482019_4599662549725482019_b9d6dab7a63f5884f387f59bc22747e7.jpg",
    imageAlt: "Lớp học lý thuyết hạng A và A1 tại trung tâm Gia Thịnh",
    content: [
      "Hạng A cho phép điều khiển xe mô tô hai bánh không giới hạn phân khối, đồng thời chạy được cả xe của hạng A1. Xe thi sát hạch là Vespa tay ga hoặc CB250 tay côn.",
      "Hạng A1 giới hạn xe đến 125cc, xe thi là Wave — phù hợp với nhu cầu đi lại hằng ngày trong nội thành.",
      "Tại Gia Thịnh Vĩnh Long, học phí hạng A là 1.750.000đ, hạng A1 là 620.000đ; tại Vũng Liêm lần lượt là 1.595.000đ và 790.000đ. Cả hai đã gồm hồ sơ, lý thuyết 2 ngày, lệ phí thi và cấp bằng.",
      "Học sinh, sinh viên đăng ký hạng A tại Vĩnh Long được giảm ngay 500.000đ khi mang thẻ HSSV lúc đăng ký.",
      "Chưa chắc chắn? Gọi hotline 0779 666 664 để được tư vấn hạng bằng phù hợp với xe bạn đang đi và quãng đường di chuyển mỗi ngày.",
    ],
  },
  {
    slug: "hoc-phi-b-c1-gom-nhung-gi",
    title: "Học phí B và C1 gồm những gì, phát sinh bao nhiêu?",
    excerpt:
      "Bóc tách trọn gói 16,5 triệu (B) và 18,9 triệu (C1): đã gồm gì, phát sinh gì và cách đóng theo đợt.",
    category: "Học phí minh bạch",
    categorySlug: "hoc-phi-minh-bach",
    date: "20/08/2026",
    readTime: "5 phút đọc",
    image:
      "/media/1789307366944_4599662549725482019_4599662549725482019_967a3bf4d808bb7d612acfb0f3d9fc6a.jpg",
    imageAlt: "Dàn xe tập lái hạng B thực tế của trung tâm Gia Thịnh",
    content: [
      "Học phí hạng B là 16.500.000đ (số sàn và số tự động), hạng C1 là 18.900.000đ. Mức phí đã gồm xăng dầu chạy DAT, xe giờ đêm/xe tự động và giáo viên kèm từ đầu đến lúc lấy bằng.",
      "Học viên được hỗ trợ đóng theo đợt và HSSV được giảm thêm 1.000.000đ cho cả hai hạng.",
      "Các khoản phát sinh ngoài trọn gói: khám sức khỏe (tự khám hoặc tại trung tâm), cabin mô phỏng 500.000đ (2 giờ), lệ phí thi 1.500.000đ (tốt nghiệp, sát hạch, in cấp bằng).",
      "Tiền thuê xe cảm biến: tốt nghiệp khoảng 300.000–350.000đ/giờ, sát hạch khoảng 500.000–600.000đ/giờ. Thực tế học viên chỉ cần thuê 1–2 giờ là chạy ổn.",
      "Mọi khoản phí đều được thông báo rõ trước khi nhập học và ghi trong biên lai — đăng ký xong nhớ giữ biên lai để đối chiếu.",
    ],
  },
  {
    slug: "meo-hoc-ly-thuyet-600-cau",
    title: "Mẹo học lý thuyết 600 câu nhớ lâu, thi một lần đậu",
    excerpt:
      "Chia nhỏ theo nhóm câu hỏi, học câu điểm liệt trước và thi thử trên máy tính trước ngày thi.",
    category: "Kinh nghiệm thi",
    categorySlug: "kinh-nghiem-thi",
    date: "12/08/2026",
    readTime: "4 phút đọc",
    image:
      "/media/1789307300578_4599662549725482019_4599662549725482019_ad001be0b583fa604cf76a48aa7ad405.jpg",
    imageAlt: "Lớp lý thuyết đông học viên tại trung tâm Gia Thịnh",
    content: [
      "Chia 600 câu thành 4 nhóm: khái niệm — quy tắc, biển báo, sa hình và câu điểm liệt. Học dứt điểm từng nhóm thay vì làm đề ngẫu nhiên ngay từ đầu.",
      "Ưu tiên thuộc lòng nhóm câu điểm liệt trước vì chỉ cần sai 1 câu là trượt cả bài, dù tổng điểm có cao.",
      "Mỗi ngày làm 2–3 đề thi thử, ghi lại các câu sai vào sổ riêng và ôn lại sau 48 giờ để chuyển vào trí nhớ dài hạn.",
      "Trước kỳ thi, có thể thuê thi thử trên máy tính tại trung tâm (10.000đ/lượt) để quen áp lực thời gian và giao diện máy thi thật.",
      "Nếu cần kèm riêng, Gia Thịnh có hỗ trợ ôn kèm luật 1:1 (phí riêng) — liên hệ hotline 0779 666 664 để đặt lịch.",
    ],
  },
  {
    slug: "lich-khai-giang-thang-9",
    title: "Lịch khai giảng tháng 09: A1, B số tự động và B số sàn",
    excerpt: "Các lớp sắp khai giảng, số chỗ còn lại và cách giữ chỗ trước khi hoàn thiện giấy tờ.",
    category: "Thông báo",
    categorySlug: "thong-bao",
    date: "02/09/2026",
    readTime: "2 phút đọc",
    image:
      "/media/1789307373617_4599662549725482019_4599662549725482019_6fde98cbf02dab051b15c6b50e57eedf.jpg",
    imageAlt: "Đội xe ô tô và xe tải tập lái của trung tâm Gia Thịnh",
    content: [
      "Lớp A1 khai giảng ngày 14/09/2026, hiện còn 12 chỗ và đang nhận hồ sơ tại cả hai chi nhánh Vĩnh Long và Vũng Liêm.",
      "Lớp B số tự động khai giảng ngày 21/09/2026, sắp đủ lớp (còn 08 chỗ) — học viên có nhu cầu nên giữ chỗ sớm.",
      "Lớp B số sàn khai giảng ngày 05/10/2026, còn 15 chỗ, phù hợp với người muốn chủ động lịch học theo tuần.",
      "Học viên có thể giữ chỗ trước và hoàn thiện giấy tờ sau. Hồ sơ gồm CCCD photo, ảnh thẻ và giấy khám sức khỏe (có thể khám tại sân thi với phí 280.000đ).",
      "Đăng ký tại 1 trong 5 văn phòng Gia Thịnh hoặc gọi 0779 666 664 để được thêm vào nhóm Zalo nhận thông báo lịch ôn và thi.",
    ],
  },
  {
    slug: "chay-dat-la-gi-kinh-nghiem",
    title: "Chạy DAT là gì? Kinh nghiệm tích đủ giờ lái đường trường",
    excerpt: "Hiểu đúng về thiết bị DAT, số km cần chạy và cách sắp xếp lịch chạy phù hợp.",
    category: "Kinh nghiệm học",
    categorySlug: "kinh-nghiem-hoc",
    date: "25/07/2026",
    readTime: "4 phút đọc",
    image:
      "/media/map/1789307362409_4599662549725482019_4599662549725482019_3e15cc0c135b22be293df84b61f611d1.jpg",
    imageAlt: "Sân sa hình chuẩn sát hạch tại Gia Thịnh",
    content: [
      "DAT là thiết bị giám sát thời gian và quãng đường học lái xe trên đường trường. Học viên phải tích đủ số giờ và km theo quy định mới được dự thi sát hạch.",
      "Học phí B và C1 tại Gia Thịnh đã gồm xăng dầu chạy DAT nên học viên không phải đóng thêm cho phần này.",
      "Nên chia nhỏ buổi chạy DAT thành nhiều ngày thay vì dồn một lúc để giữ sức khỏe và ghi nhớ tình huống tốt hơn.",
      "Chủ động đặt lịch chạy vào khung giờ ít kẹt xe, mang đủ giấy tờ và tuân thủ hướng dẫn của giáo viên ngồi kèm.",
      "Mọi buổi chạy DAT đều được giáo viên theo dõi và ghi nhận đầy đủ — học viên có thể hỏi tiến độ bất cứ lúc nào qua nhóm Zalo lớp.",
    ],
  },
]

export function getPost(slug: string): NewsPost | undefined {
  return newsPosts.find((post) => post.slug === slug)
}

const COMBINING_MARKS = /[\u0300-\u036f]/g

/**
 * Chuẩn hoá văn bản để tìm kiếm không phân biệt dấu: "hoc phi" khớp "Học phí".
 * Chuẩn hoá theo từng điểm mã (code point) nên độ dài không đổi, nhờ đó vị trí
 * khớp trong chuỗi đã chuẩn hoá vẫn ánh xạ đúng sang văn bản gốc khi tô sáng.
 */
export function normalizeForSearch(value: string): string {
  return Array.from(value)
    .map(
      (char) =>
        char.normalize("NFD").replace(COMBINING_MARKS, "").replace(/đ/gi, "d").toLowerCase() ||
        char,
    )
    .join("")
}

export function newsMatchesQuery(post: NewsPost, query: string): boolean {
  const needle = normalizeForSearch(query.trim())
  if (!needle) return true
  const haystack = [post.title, post.excerpt, post.category, post.content.join(" ")]
  return haystack.some((field) => normalizeForSearch(field).includes(needle))
}

export type TextSegment = { text: string; match: boolean }

/** Cắt văn bản thành các đoạn khớp / không khớp từ khoá để tô sáng kết quả. */
export function splitByQuery(text: string, query: string): TextSegment[] {
  const needle = normalizeForSearch(query.trim())
  if (!needle) return [{ text, match: false }]

  const chars = Array.from(text)
  const normalized = Array.from(normalizeForSearch(text)).join("")
  const needleLength = Array.from(needle).length
  const segments: TextSegment[] = []

  let cursor = 0
  let index = normalized.indexOf(needle)
  while (index !== -1 && cursor < chars.length) {
    if (index > cursor) {
      segments.push({ text: chars.slice(cursor, index).join(""), match: false })
    }
    segments.push({
      text: chars.slice(index, index + needleLength).join(""),
      match: true,
    })
    cursor = index + needleLength
    index = normalized.indexOf(needle, cursor)
  }

  if (cursor < chars.length) {
    segments.push({ text: chars.slice(cursor).join(""), match: false })
  }
  return segments
}

export type NewsSortKey = "newest" | "oldest" | "title"

function toTimestamp(date: string): number {
  const [day, month, year] = date.split("/").map(Number)
  return new Date(year, month - 1, day).getTime()
}

export function sortNewsPosts(posts: NewsPost[], sort: NewsSortKey): NewsPost[] {
  const list = [...posts]
  if (sort === "title") {
    return list.sort((a, b) => a.title.localeCompare(b.title, "vi"))
  }
  return list.sort((a, b) =>
    sort === "oldest"
      ? toTimestamp(a.date) - toTimestamp(b.date)
      : toTimestamp(b.date) - toTimestamp(a.date),
  )
}

export function countPostsByCategory(
  posts: NewsPost[],
): Partial<Record<NewsCategorySlug, number>> {
  const counts: Partial<Record<NewsCategorySlug, number>> = {}
  for (const post of posts) {
    counts[post.categorySlug] = (counts[post.categorySlug] ?? 0) + 1
  }
  return counts
}
