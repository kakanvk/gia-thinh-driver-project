export type ForumReply = {
  author: string
  role?: string
  time: string
  likes: number
  content: string
  images?: string[]
}

export type ForumThread = {
  slug: string
  board: string
  title: string
  author: string
  time: string
  likes: number
  pinned?: boolean
  content: string[]
  images?: string[]
  replies: ForumReply[]
}

export const boards = [
  {
    icon: "bike",
    name: "Xe máy — Hạng A & A1",
    description: "Sa hình Wave, Vespa tay ga, CB250 tay côn và mẹo thi lý thuyết.",
    topics: 128,
    posts: "1,2k",
  },
  {
    icon: "car",
    name: "Ô tô — Hạng B & C1",
    description: "Chạy DAT, cabin mô phỏng, ghép ngang dọc và kinh nghiệm đường trường.",
    topics: 96,
    posts: "860",
  },
  {
    icon: "file",
    name: "Hồ sơ & học phí",
    description: "Giấy tờ cần chuẩn bị, lịch khai giảng, đóng theo đợt và ưu đãi HSSV.",
    topics: 54,
    posts: "410",
  },
  {
    icon: "help",
    name: "Hỏi đáp chung",
    description: "Mọi thắc mắc khác — đội ngũ Gia Thịnh và học viên cũ cùng trả lời.",
    topics: 73,
    posts: "520",
  },
]

export const threads: ForumThread[] = [
  {
    slug: "noi-quy-dien-dan",
    board: "Nội quy",
    title: "Nội quy diễn đàn — đọc trước khi đăng bài",
    author: "Quản trị viên",
    time: "Ghim",
    likes: 210,
    pinned: true,
    content: [
      "Chào mừng bạn đến với cộng đồng học viên Gia Thịnh. Để giữ diễn đàn hữu ích và văn minh, vui lòng đọc kỹ các quy định dưới đây trước khi đăng bài hoặc bình luận.",
      "Không đăng thông tin sai lệch về học phí, lịch thi; mọi thông tin chính thức đều được ghim từ tài khoản Quản trị viên và Thầy Đức. Không quảng cáo trung tâm khác, không mua bán bằng lái.",
      "Bài viết nên đặt tiêu đề rõ ràng, ghi đúng chuyên mục và chia sẻ kinh nghiệm thực tế của bản thân để các bạn khóa sau cùng tham khảo.",
    ],
    replies: [
      {
        author: "Minh T.",
        time: "1 tuần trước",
        likes: 34,
        content: "Đã đọc kỹ nội quy. Cảm ơn ban quản trị đã tạo sân chơi rất hữu ích cho học viên.",
      },
      {
        author: "Hoài An",
        time: "5 ngày trước",
        likes: 21,
        content: "Mình thấy quy định ghi đúng chuyên mục rất hay, tìm bài cũ dễ hẳn.",
      },
    ],
  },
  {
    slug: "kinh-nghiem-vong-so-8",
    board: "Xe máy — A & A1",
    title: "Chia sẻ kinh nghiệm qua vòng số 8 không chống chân",
    author: "Minh T.",
    time: "2 giờ trước",
    likes: 98,
    content: [
      "Mình vừa đậu A1 tuần rồi, chia sẻ chút kinh nghiệm qua vòng số 8 cho các bạn sắp thi. Mình thi bằng xe Wave, vào số 2 ngay từ đầu và giữ ga thật đều, đừng mớm ga giật cục.",
      "Mắt nhìn xa về hướng ra của vòng, không nhìn xuống bánh trước. Thân người thả lỏng, dùng hông điều hướng xe thay vì gồng tay lái.",
      "Trước ngày thi mình có thuê xe cảm biến chạy thử 3 vòng (20.000đ/vòng) nên vào thi quen xe hẳn. Chúc mọi người thi tốt!",
    ],
    images: [
      "/media/1789307300348_4599662549725482019_4599662549725482019_fdc3b40a8c3079067cf0cad66a40d03b.jpg",
    ],
    replies: [
      {
        author: "Thầy Đức",
        role: "Giáo viên",
        time: "1 giờ trước",
        likes: 45,
        content: "Bổ sung thêm: khi vào vòng nhớ tắt xi nhan đúng lúc, nhiều bạn quên nên bị trừ điểm oan. Cứ bình tĩnh là qua.",
      },
      {
        author: "Lan P.",
        time: "40 phút trước",
        likes: 12,
        content: "Cảm ơn bạn nhiều, cuối tuần này mình thi rồi, đang run quá. Đọc bài này tự tin hơn hẳn.",
        images: [
          "/media/1789307300543_4599662549725482019_4599662549725482019_b9d6dab7a63f5884f387f59bc22747e7.jpg",
        ],
      },
      {
        author: "Quốc B.",
        time: "20 phút trước",
        likes: 8,
        content: "Mẹo nhìn xa chuẩn thật, hôm bữa mình nhìn xuống bánh là loạng choạng ngay.",
      },
    ],
  },
  {
    slug: "chay-dat-810km-mat-bao-lau",
    board: "Ô tô — B & C1",
    title: "Chạy DAT 810km mất bao lâu? Lịch chạy của mình đây",
    author: "Hoài An",
    time: "5 giờ trước",
    likes: 76,
    content: [
      "Nhiều bạn hỏi chạy DAT bao lâu thì xong, mình chia sẻ lịch của mình học hạng B: mỗi buổi chạy khoảng 3–4 giờ, tuần chạy 3 buổi thì hơn 3 tuần là đủ số km.",
      "Nên đăng ký khung giờ sáng sớm hoặc chiều mát, đường thoáng chạy được nhiều km hơn mà đỡ mệt. Nhớ mang đủ giấy tờ mỗi buổi.",
      "Xăng dầu chạy DAT đã nằm trong học phí trọn gói nên cứ yên tâm chạy, thiếu giờ nào thầy sẽ báo để xếp thêm.",
    ],
    replies: [
      {
        author: "Thầy Đức",
        role: "Giáo viên",
        time: "3 giờ trước",
        likes: 30,
        content: "Lịch này hợp lý. Các bạn nên chia đều buổi chạy ra các tuần, đừng dồn sát ngày thi sẽ rất mệt và nhớ bài kém.",
      },
      {
        author: "Minh T.",
        time: "1 giờ trước",
        likes: 9,
        content: "Cho mình hỏi chạy DAT có được chọn thầy kèm không bạn?",
      },
    ],
  },
  {
    slug: "co-bang-b-hoc-hang-a-mien-ly-thuyet",
    board: "Hồ sơ & học phí",
    title: "Có bằng B rồi học thêm hạng A có được miễn lý thuyết không?",
    author: "Quốc B.",
    time: "Hôm qua",
    likes: 54,
    content: [
      "Mình đã có bằng B được 2 năm, giờ muốn học thêm hạng A để chạy xe trên 125cc. Nghe nói có bằng ô tô thì được miễn thi lý thuyết, không biết thủ tục thế nào?",
      "Với lại học phí hạng A ở Vĩnh Long và Vũng Liêm khác nhau đúng không mọi người?",
    ],
    replies: [
      {
        author: "Tư vấn viên",
        role: "Gia Thịnh",
        time: "Hôm qua",
        likes: 40,
        content: "Chào bạn, có bằng ô tô thì được miễn thi lý thuyết hạng A và được giảm thêm 60.000đ học phí. Khi đăng ký nhớ mang bằng B gốc để đối chiếu nhé. Học phí hạng A tại Vĩnh Long là 1.750.000đ, tại Vũng Liêm là 1.595.000đ.",
      },
      {
        author: "Quốc B.",
        time: "12 giờ trước",
        likes: 6,
        content: "Cảm ơn ad, cuối tuần mình ghé VP1 Tân Ngãi đăng ký.",
      },
    ],
  },
  {
    slug: "meo-canh-guong-ghep-ngang",
    board: "Ô tô — B & C1",
    title: "Mẹo canh gương khi ghép ngang trong sa hình",
    author: "Thầy Đức",
    time: "Hôm qua",
    likes: 132,
    content: [
      "Ghép ngang (đỗ xe song song) là bài rớt nhiều nhất ở hạng B. Thầy chia sẻ điểm canh chuẩn cho xe tập lái của trung tâm.",
      "Khi vai ngang với mép chuồng thì đánh hết lái phải, lùi đến khi gương trái thấy bánh sau chạm vạch thì trả thẳng lái. Tiếp tục lùi đến khi bánh trước qua vạch thì đánh hết lái trái để vào chuồng.",
      "Tốc độ lùi càng chậm càng tốt, côn ra từ từ. Nếu thấy lệch thì mạnh dạn sửa, đừng cố đè vạch vì sẽ bị loại trực tiếp.",
    ],
    images: [
      "/media/map/1789307362409_4599662549725482019_4599662549725482019_3e15cc0c135b22be293df84b61f611d1.jpg",
    ],
    replies: [
      {
        author: "Hoài An",
        time: "20 giờ trước",
        likes: 25,
        content: "Em áp dụng đúng bài này hôm thi tốt nghiệp, ghép một phát ăn ngay. Cảm ơn thầy!",
      },
      {
        author: "Lan P.",
        time: "8 giờ trước",
        likes: 11,
        content: "Thầy ơi xe sát hạch khác xe tập thì điểm canh có lệch nhiều không ạ?",
      },
      {
        author: "Thầy Đức",
        role: "Giáo viên",
        time: "6 giờ trước",
        likes: 28,
        content: "Lệch không đáng kể em nhé, nhưng hôm trước thi nên thuê xe cảm biến chạy 1–2 giờ cho quen xe là chắc ăn nhất.",
      },
    ],
  },
  {
    slug: "thi-ly-thuyet-bao-nhieu-cau-dat",
    board: "Hỏi đáp chung",
    title: "Thi lý thuyết hạng B bao nhiêu câu thì đậu?",
    author: "Thu H.",
    time: "3 ngày trước",
    likes: 41,
    content: [
      "Mình đang ôn bộ 600 câu mà hơi rối, không biết đề thi hạng B gồm bao nhiêu câu và cần đúng tối thiểu bao nhiêu?",
      "Câu điểm liệt có nhiều không, và trượt lý thuyết thì bao lâu được thi lại vậy mọi người?",
    ],
    replies: [
      {
        author: "Tư vấn viên",
        role: "Gia Thịnh",
        time: "3 ngày trước",
        likes: 33,
        content: "Đề hạng B có 35 câu, cần đúng từ 32 câu trở lên và không sai câu điểm liệt. Trượt lý thuyết được đăng ký thi lại ở kỳ sau, bạn ôn thêm đề trên máy tính ở trung tâm cho quen nhé.",
      },
      {
        author: "Minh T.",
        time: "2 ngày trước",
        likes: 10,
        content: "Học câu điểm liệt trước bạn ơi, mình sai 1 câu liệt là rớt dù đủ điểm, tiếc lắm.",
      },
    ],
  },
  {
    slug: "hoc-phi-tra-gop-theo-dot",
    board: "Hồ sơ & học phí",
    title: "Học phí hạng B có được chia nhiều đợt không?",
    author: "Văn K.",
    time: "3 ngày trước",
    likes: 38,
    content: [
      "Mình muốn học hạng B số sàn nhưng chưa đủ tiền đóng một lần. Trung tâm có cho chia học phí theo đợt không, mỗi đợt khoảng bao nhiêu?",
      "HSSV có được giảm thêm không mọi người?",
    ],
    replies: [
      {
        author: "Tư vấn viên",
        role: "Gia Thịnh",
        time: "3 ngày trước",
        likes: 29,
        content: "Được chia theo đợt bạn nhé, đợt 1 đóng khi nhập học để làm hồ sơ, các đợt sau theo tiến độ học. HSSV được giảm thêm 1.000.000đ cho hạng B, mang thẻ HSSV khi đăng ký là được.",
      },
    ],
  },
  {
    slug: "kinh-nghiem-de-pa-doc-cau",
    board: "Ô tô — B & C1",
    title: "Kinh nghiệm đề-pa lên dốc không bị tụt",
    author: "Quốc B.",
    time: "4 ngày trước",
    likes: 87,
    content: [
      "Bài đề-pa mình toàn bị tụt dốc hoặc tắt máy. Thầy dạy dùng phanh tay mà lúc thi mình run quá quên hết.",
      "Mọi người có mẹo nào giữ côn-ga ổn định khi xe dừng giữa dốc không, chia sẻ giúp mình với.",
    ],
    replies: [
      {
        author: "Thầy Đức",
        role: "Giáo viên",
        time: "4 ngày trước",
        likes: 52,
        content: "Khi xe dừng trên dốc, giữ phanh chân, nhả côn từ từ đến khi xe rung nhẹ thì giữ nguyên côn, chuyển sang ga nhẹ rồi mới nhả phanh. Tập 5–10 lần là quen chân côn ngay.",
      },
      {
        author: "Hoài An",
        time: "3 ngày trước",
        likes: 14,
        content: "Mình cũng rớt đề-pa lần đầu, lần 2 cứ bình tĩnh làm đúng bài thầy dặn là qua.",
      },
    ],
  },
  {
    slug: "chon-xe-thi-a-tay-ga-hay-tay-con",
    board: "Xe máy — A & A1",
    title: "Thi hạng A nên chọn xe tay ga hay tay côn?",
    author: "Bảo N.",
    time: "5 ngày trước",
    likes: 46,
    content: [
      "Mình chạy xe số quen rồi, đang phân vân thi hạng A bằng Vespa tay ga cho dễ hay CB250 tay côn cho quen xe nhà.",
      "Sa hình hạng A có khó hơn A1 nhiều không ạ?",
    ],
    replies: [
      {
        author: "Thầy Đức",
        role: "Giáo viên",
        time: "5 ngày trước",
        likes: 31,
        content: "Sa hình hạng A rộng hơn A1 một chút nhưng bài giống nhau. Chạy xe số quen thì thi tay côn lợi thế hơn, còn chỉ cần bằng để đi tay ga thì chọn Vespa cho nhàn.",
      },
    ],
  },
  {
    slug: "kham-suc-khoe-o-dau-nhanh",
    board: "Hồ sơ & học phí",
    title: "Khám sức khỏe học lái xe ở đâu nhanh tại Vĩnh Long?",
    author: "Lan P.",
    time: "6 ngày trước",
    likes: 27,
    content: [
      "Hồ sơ của mình còn thiếu giấy khám sức khỏe. Mọi người thường khám ở đâu, chi phí khoảng bao nhiêu và có cần nhịn ăn sáng không?",
    ],
    replies: [
      {
        author: "Tư vấn viên",
        role: "Gia Thịnh",
        time: "6 ngày trước",
        likes: 20,
        content: "Bạn có thể khám trực tiếp tại sân thi với phí 280.000đ, không cần nhịn ăn. Hoặc khám ở bệnh viện rồi nộp giấy về văn phòng đều được.",
      },
    ],
  },
  {
    slug: "meo-nho-bien-bao-cam",
    board: "Xe máy — A & A1",
    title: "Mẹo nhớ nhanh nhóm biển báo cấm",
    author: "Thu H.",
    time: "1 tuần trước",
    likes: 63,
    content: [
      "Mình hay nhầm biển cấm rẽ với biển cấm quay đầu, biển cấm xe máy với cấm ô tô. Có mẹo hình ảnh nào nhớ nhanh không mọi người?",
      "Thi A1 mà sai mấy câu biển báo tiếc quá.",
    ],
    replies: [
      {
        author: "Minh T.",
        time: "1 tuần trước",
        likes: 26,
        content: "Biển tròn viền đỏ là biển cấm, nhìn hình vẽ bên trong đoán nội dung. Cấm rẽ vẽ mũi tên cong một hướng, cấm quay đầu vẽ hai mũi tên ngược nhau, nhớ hình là nhớ luôn.",
      },
      {
        author: "Hoài An",
        time: "6 ngày trước",
        likes: 11,
        content: "Mình học bằng app, làm đi làm lại 20 câu biển báo mỗi ngày, 1 tuần là thuộc hết.",
      },
    ],
  },
]

export function getThread(slug: string): ForumThread | undefined {
  return threads.find((thread) => thread.slug === slug)
}
