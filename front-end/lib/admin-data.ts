export type RegistrationStatus = "Đã xác nhận" | "Chờ tư vấn" | "Đã đặt cọc"

export type Registration = {
  id: string
  student: string
  initials: string
  phone: string
  course: "A1" | "A" | "B số sàn" | "B tự động" | "C1"
  branch: string
  registeredAt: string
  schedule: string
  status: RegistrationStatus
}

export const dashboardStats = [
  {
    label: "Hồ sơ trong tháng",
    value: "128",
    change: "+18,5%",
    note: "so với tháng trước",
    tone: "primary" as const,
  },
  {
    label: "Học viên đang học",
    value: "486",
    change: "+8,4%",
    note: "36 học viên mới",
    tone: "signal" as const,
  },
  {
    label: "Lịch học tuần này",
    value: "42",
    change: "12 hôm nay",
    note: "5 lớp sắp đủ chỗ",
    tone: "warning" as const,
  },
  {
    label: "Hoàn tất đúng hạn",
    value: "91%",
    change: "+3,2%",
    note: "trên 423 hồ sơ",
    tone: "success" as const,
  },
]

export const weeklyRegistrations = [
  { day: "T2", value: 18 },
  { day: "T3", value: 26 },
  { day: "T4", value: 22 },
  { day: "T5", value: 34 },
  { day: "T6", value: 42 },
  { day: "T7", value: 31 },
  { day: "CN", value: 24 },
]

export const courseDistribution = [
  { label: "Hạng A1", value: 186, percent: 38 },
  { label: "Hạng B", value: 154, percent: 32 },
  { label: "Hạng A", value: 72, percent: 15 },
  { label: "Hạng C1", value: 74, percent: 15 },
]

/** Doanh thu ghi nhận theo tháng, đơn vị triệu đồng. */
export const monthlyRevenue = [
  { month: "T10/25", actual: 940, target: 900 },
  { month: "T11/25", actual: 1010, target: 950 },
  { month: "T12/25", actual: 1180, target: 1100 },
  { month: "T01/26", actual: 860, target: 900 },
  { month: "T02/26", actual: 720, target: 850 },
  { month: "T03/26", actual: 1140, target: 1050 },
  { month: "T04/26", actual: 1060, target: 1050 },
  { month: "T05/26", actual: 1220, target: 1150 },
  { month: "T06/26", actual: 1480, target: 1350 },
  { month: "T07/26", actual: 1560, target: 1450 },
  { month: "T08/26", actual: 1390, target: 1400 },
  { month: "T09/26", actual: 1180, target: 1200 },
]

/**
 * Cơ cấu doanh thu 12 tháng theo hạng bằng, đơn vị triệu đồng.
 * Tính từ học phí niêm yết (A1 620.000đ, A 1.750.000đ, B 16.500.000đ,
 * C1 18.900.000đ) nhân số học viên từng hạng.
 */
export const revenueByClass = [
  { key: "hang-b", label: "Hạng B", revenue: 8421, share: 61.3 },
  { key: "hang-c1", label: "Hạng C1", revenue: 4520, share: 32.9 },
  { key: "hang-a", label: "Hạng A", revenue: 425, share: 3.1 },
  { key: "hang-a1", label: "Hạng A1", revenue: 370, share: 2.7 },
]

/** Phễu tuyển sinh tháng 09/2026, đếm theo hồ sơ ở từng công đoạn. */
export const enrollmentFunnel = [
  { stage: "Tiếp nhận", count: 1240 },
  { stage: "Đã tư vấn", count: 986 },
  { stage: "Đặt cọc", count: 412 },
  { stage: "Hoàn tất hồ sơ", count: 214 },
  { stage: "Nhập học", count: 128 },
]

/** Nguồn đăng ký của 128 học viên nhập học tháng 09/2026. */
export const studentSources = [
  { source: "Giới thiệu", count: 54 },
  { source: "Facebook/TikTok", count: 38 },
  { source: "Website", count: 22 },
  { source: "Zalo/hotline", count: 9 },
  { source: "Văn phòng", count: 5 },
]

/** Tỷ lệ đỗ sát hạch ngay lần đầu theo hạng, đơn vị phần trăm. */
export const passRateByClass = [
  { licenseClass: "A1", rate: 98 },
  { licenseClass: "A", rate: 96 },
  { licenseClass: "B", rate: 95 },
  { licenseClass: "C1", rate: 91 },
]

/** Lớp đang vận hành: sĩ số, giảng viên phụ trách và tiến độ khai giảng. */
export const trainingClasses = [
  {
    code: "A1-VL-2609",
    licenseClass: "A1",
    branch: "Vũng Liêm",
    startDate: "14/09/2026",
    endDate: "28/09/2026",
    schedule: "T2–T6 · 08:00",
    filled: 38,
    capacity: 50,
    instructor: "Phạm Minh Tuấn",
    status: "Đang học",
  },
  {
    code: "B-TD-2609",
    licenseClass: "B tự động",
    branch: "Tân Ngãi",
    startDate: "21/09/2026",
    endDate: "19/10/2026",
    schedule: "T2–T7 · 13:30",
    filled: 42,
    capacity: 50,
    instructor: "Trần Quốc Hưng",
    status: "Đang học",
  },
  {
    code: "BSS-TN-2610",
    licenseClass: "B số sàn",
    branch: "Tân Ngãi",
    startDate: "05/10/2026",
    endDate: "02/11/2026",
    schedule: "T2–T7 · 07:30",
    filled: 35,
    capacity: 50,
    instructor: "Nguyễn Hoàng Đức",
    status: "Đang nhận hồ sơ",
  },
  {
    code: "C1-LC-2610",
    licenseClass: "C1",
    branch: "Long Châu",
    startDate: "12/10/2026",
    endDate: "09/11/2026",
    schedule: "T2–T6 · 14:00",
    filled: 26,
    capacity: 40,
    instructor: "Lê Văn Tám",
    status: "Đang nhận hồ sơ",
  },
  {
    code: "A-PQ-2610",
    licenseClass: "A",
    branch: "Phú Quới",
    startDate: "19/10/2026",
    endDate: "02/11/2026",
    schedule: "T7–CN · 09:00",
    filled: 12,
    capacity: 30,
    instructor: "Phạm Minh Tuấn",
    status: "Sắp khai giảng",
  },
  {
    code: "A1-TD-2608",
    licenseClass: "A1",
    branch: "Thanh Đức",
    startDate: "17/08/2026",
    endDate: "31/08/2026",
    schedule: "T2–T6 · 08:00",
    filled: 50,
    capacity: 50,
    instructor: "Võ Thị Hồng",
    status: "Đã kết thúc",
  },
]

// Văn phòng tĩnh cho các trang admin còn dùng dữ liệu mẫu
export const offices = [
  {
    name: "VP1 — Tân Ngãi",
    address: "Số 331A, P. Tân Ngãi, T. Vĩnh Long",
    map: "https://www.google.com/maps/search/?api=1&query=331A+T%C3%A2n+Ng%C3%A3i+V%C4%A9nh+Long",
  },
  {
    name: "VP2 — Thanh Đức",
    address: "Số 183, P. Thanh Đức, T. Vĩnh Long",
    map: "https://www.google.com/maps/search/?api=1&query=183+Thanh+%C4%90%E1%BB%A9c+V%C4%A9nh+Long",
  },
  {
    name: "VP3 — Long Châu",
    address: "Số 15C, đường Phạm Hùng, P. Long Châu, T. Vĩnh Long",
    map: "https://www.google.com/maps/search/?api=1&query=15C+Ph%E1%BA%A1m+H%C3%B9ng+Long+Ch%C3%A2u+V%C4%A9nh+Long",
  },
  {
    name: "VP4 — Phú Quới",
    address: "Ấp Long Hòa, xã Phú Quới, T. Vĩnh Long",
    map: "https://www.google.com/maps/search/?api=1&query=Long+Ho%C3%A0+Ph%C3%BA+Qu%E1%BB%9Bi+V%C4%A9nh+Long",
  },
  {
    name: "VP Vũng Liêm",
    address: "TT GDTX Vũng Liêm, QL 53, xã Trung Thành, T. Vĩnh Long",
  },
]

/**
 * Chi nhánh: `office` trỏ tới tên văn phòng trong `offices` ở trên để lấy địa chỉ
 * và bản đồ, `monthlyRevenue` tính bằng triệu đồng cho tháng hiện tại.
 */
export const branches = [
  {
    name: "Tân Ngãi",
    office: "VP1 — Tân Ngãi",
    manager: "Lê Quang Vinh",
    priceZone: "Vĩnh Long",
    students: 186,
    monthlyRevenue: 486,
    openingHours: "7:30–17:30 · T2–T7",
    status: "Đang hoạt động",
  },
  {
    name: "Thanh Đức",
    office: "VP2 — Thanh Đức",
    manager: "Trần Mỹ Duyên",
    priceZone: "Vĩnh Long",
    students: 96,
    monthlyRevenue: 212,
    openingHours: "7:30–17:30 · T2–T7",
    status: "Đang hoạt động",
  },
  {
    name: "Long Châu",
    office: "VP3 — Long Châu",
    manager: "Nguyễn Thanh Sơn",
    priceZone: "Vĩnh Long",
    students: 82,
    monthlyRevenue: 196,
    openingHours: "7:30–17:00 · T2–T7",
    status: "Đang hoạt động",
  },
  {
    name: "Phú Quới",
    office: "VP4 — Phú Quới",
    manager: "Võ Minh Trí",
    priceZone: "Vĩnh Long",
    students: 58,
    monthlyRevenue: 128,
    openingHours: "8:00–17:00 · T2–T6",
    status: "Đang hoạt động",
  },
  {
    name: "Vũng Liêm",
    office: "VP Vũng Liêm",
    manager: "Phạm Thị Loan",
    priceZone: "Vũng Liêm",
    students: 64,
    monthlyRevenue: 158,
    openingHours: "7:30–17:30 · T2–T7",
    status: "Đang hoạt động",
  },
]

/**
 * Ca thi tốt nghiệp (tại trung tâm) và sát hạch (tại Sở GTVT).
 * `passed` là null khi kỳ thi chưa diễn ra nên chưa có kết quả.
 */
export const examSessions: Array<{
  code: string
  examType: "Tốt nghiệp" | "Sát hạch"
  licenseClass: string
  branch: string
  date: string
  candidates: number
  passed: number | null
  absent: number
  status: "Đã có kết quả" | "Sắp diễn ra" | "Đã lên lịch"
}> = [
  {
    code: "SH-2609-01",
    examType: "Sát hạch",
    licenseClass: "A1",
    branch: "Tân Ngãi",
    date: "28/09/2026",
    candidates: 48,
    passed: null,
    absent: 0,
    status: "Sắp diễn ra",
  },
  {
    code: "SH-2609-02",
    examType: "Sát hạch",
    licenseClass: "B tự động",
    branch: "Tân Ngãi",
    date: "28/09/2026",
    candidates: 32,
    passed: null,
    absent: 0,
    status: "Sắp diễn ra",
  },
  {
    code: "TN-2610-03",
    examType: "Tốt nghiệp",
    licenseClass: "B số sàn",
    branch: "Tân Ngãi",
    date: "02/10/2026",
    candidates: 40,
    passed: null,
    absent: 0,
    status: "Đã lên lịch",
  },
  {
    code: "SH-2609-00",
    examType: "Sát hạch",
    licenseClass: "A",
    branch: "Phú Quới",
    date: "21/09/2026",
    candidates: 26,
    passed: 24,
    absent: 0,
    status: "Đã có kết quả",
  },
  {
    code: "SH-2609-11",
    examType: "Sát hạch",
    licenseClass: "C1",
    branch: "Long Châu",
    date: "14/09/2026",
    candidates: 22,
    passed: 20,
    absent: 1,
    status: "Đã có kết quả",
  },
  {
    code: "TN-2609-08",
    examType: "Tốt nghiệp",
    licenseClass: "A1",
    branch: "Thanh Đức",
    date: "07/09/2026",
    candidates: 50,
    passed: 49,
    absent: 0,
    status: "Đã có kết quả",
  },
]

/** Giáo viên: chuyên môn, tải dạy và tỷ lệ đỗ của học viên do mình phụ trách. */
export const instructors = [
  {
    name: "Nguyễn Hoàng Đức",
    initials: "HĐ",
    phone: "0907 226 880",
    specialty: "B, C1",
    branch: "Tân Ngãi",
    classes: 4,
    students: 62,
    passRate: 96,
    hoursThisMonth: 128,
    status: "Đang hoạt động",
  },
  {
    name: "Phạm Minh Tuấn",
    initials: "MT",
    phone: "0913 528 447",
    specialty: "A, A1",
    branch: "Vũng Liêm",
    classes: 5,
    students: 96,
    passRate: 98,
    hoursThisMonth: 142,
    status: "Đang hoạt động",
  },
  {
    name: "Trần Quốc Hưng",
    initials: "QH",
    phone: "0932 771 205",
    specialty: "B tự động",
    branch: "Tân Ngãi",
    classes: 3,
    students: 54,
    passRate: 94,
    hoursThisMonth: 96,
    status: "Đang hoạt động",
  },
  {
    name: "Lê Văn Tám",
    initials: "VT",
    phone: "0988 214 630",
    specialty: "B, C1",
    branch: "Long Châu",
    classes: 3,
    students: 48,
    passRate: 92,
    hoursThisMonth: 104,
    status: "Đang hoạt động",
  },
  {
    name: "Võ Thị Hồng",
    initials: "TH",
    phone: "0779 666 664",
    specialty: "Lý thuyết",
    branch: "Thanh Đức",
    classes: 6,
    students: 180,
    passRate: 97,
    hoursThisMonth: 118,
    status: "Đang hoạt động",
  },
  {
    name: "Đặng Minh Khoa",
    initials: "MK",
    phone: "0901 336 118",
    specialty: "A, A1",
    branch: "Phú Quới",
    classes: 2,
    students: 34,
    passRate: 89,
    hoursThisMonth: 72,
    status: "Tạm nghỉ",
  },
]

/** Xe tập lái. `datKm` chỉ áp dụng cho ô tô nên xe máy để 0. */
export const vehicles = [
  {
    plate: "64A-123.45",
    model: "Toyota Vios 1.5G",
    licenseClass: "B tự động",
    odometer: 128400,
    datKm: 1240,
    lastService: "12/09/2026",
    nextService: "12/12/2026",
    registration: "20/11/2026",
    status: "Đang chạy",
  },
  {
    plate: "64A-078.21",
    model: "Hyundai Accent",
    licenseClass: "B số sàn",
    odometer: 96450,
    datKm: 980,
    lastService: "05/09/2026",
    nextService: "05/12/2026",
    registration: "14/10/2026",
    status: "Đang chạy",
  },
  {
    plate: "64C-045.90",
    model: "Hyundai Mighty 75S",
    licenseClass: "C1",
    odometer: 74200,
    datKm: 640,
    lastService: "28/08/2026",
    nextService: "28/11/2026",
    registration: "30/09/2026",
    status: "Bảo dưỡng",
  },
  {
    plate: "64A-190.33",
    model: "Kia Morning",
    licenseClass: "B tự động",
    odometer: 143900,
    datKm: 1120,
    lastService: "02/09/2026",
    nextService: "02/12/2026",
    registration: "08/11/2026",
    status: "Đang chạy",
  },
  {
    plate: "64B1-234.56",
    model: "Honda Wave Alpha",
    licenseClass: "A1",
    odometer: 18200,
    datKm: 0,
    lastService: "18/09/2026",
    nextService: "18/12/2026",
    registration: "22/12/2026",
    status: "Đang chạy",
  },
  {
    plate: "64B1-311.08",
    model: "Vespa Liberty",
    licenseClass: "A",
    odometer: 12400,
    datKm: 0,
    lastService: "10/09/2026",
    nextService: "10/12/2026",
    registration: "05/01/2027",
    status: "Đang chạy",
  },
  {
    plate: "64B1-098.77",
    model: "Honda CB250",
    licenseClass: "A",
    odometer: 15600,
    datKm: 0,
    lastService: "20/08/2026",
    nextService: "20/11/2026",
    registration: "12/02/2027",
    status: "Tạm dừng",
  },
]

/** Hồ sơ học phí. Số tiền tính bằng đồng. */
export const tuitionRecords = [
  {
    student: "Nguyễn Minh Anh",
    initials: "MA",
    licenseClass: "B tự động",
    branch: "Tân Ngãi",
    total: 16500000,
    paid: 16500000,
    method: "Một lần",
    dueDate: "24/08/2026",
    status: "Đã thu đủ",
  },
  {
    student: "Trần Quốc Bảo",
    initials: "QB",
    licenseClass: "A1",
    branch: "Vũng Liêm",
    total: 790000,
    paid: 400000,
    method: "2 đợt",
    dueDate: "30/09/2026",
    status: "Đang đóng theo đợt",
  },
  {
    student: "Lê Hoài Thương",
    initials: "HT",
    licenseClass: "B số sàn",
    branch: "Thanh Đức",
    total: 16500000,
    paid: 8250000,
    method: "3 đợt",
    dueDate: "15/10/2026",
    status: "Đang đóng theo đợt",
  },
  {
    student: "Phạm Gia Huy",
    initials: "GH",
    licenseClass: "C1",
    branch: "Long Châu",
    total: 18900000,
    paid: 18900000,
    method: "Một lần",
    dueDate: "20/08/2026",
    status: "Đã thu đủ",
  },
  {
    student: "Võ Ngọc Trâm",
    initials: "NT",
    licenseClass: "A",
    branch: "Phú Quới",
    total: 1595000,
    paid: 1095000,
    method: "HSSV −500.000đ",
    dueDate: "05/10/2026",
    status: "Đang đóng theo đợt",
  },
  {
    student: "Đặng Tuấn Kiệt",
    initials: "TK",
    licenseClass: "B tự động",
    branch: "Tân Ngãi",
    total: 16500000,
    paid: 16500000,
    method: "Một lần",
    dueDate: "18/08/2026",
    status: "Đã thu đủ",
  },
  {
    student: "Bùi Thanh Hà",
    initials: "TH",
    licenseClass: "A1",
    branch: "Vũng Liêm",
    total: 620000,
    paid: 620000,
    method: "Một lần",
    dueDate: "21/09/2026",
    status: "Đã thu đủ",
  },
  {
    student: "Ngô Đức Phúc",
    initials: "ĐP",
    licenseClass: "B số sàn",
    branch: "Thanh Đức",
    total: 16500000,
    paid: 5500000,
    method: "3 đợt",
    dueDate: "20/09/2026",
    status: "Quá hạn",
  },
]

/** Biểu phí niêm yết theo hạng và chi nhánh, số tiền tính bằng đồng. */
export const tuitionTable = [
  {
    licenseClass: "A1",
    vinhLong: 620000,
    vungLiem: 790000,
    duration: "Lý thuyết 2 ngày",
    included: "Hồ sơ, lệ phí thi, cấp bằng",
  },
  {
    licenseClass: "A",
    vinhLong: 1750000,
    vungLiem: 1595000,
    duration: "Lý thuyết 2 ngày",
    included: "Hồ sơ, lệ phí thi, cấp bằng",
  },
  {
    licenseClass: "B",
    vinhLong: 16500000,
    vungLiem: 16500000,
    duration: "3–4 tuần",
    included: "Xăng dầu DAT, xe tự động, giáo viên kèm",
  },
  {
    licenseClass: "C1",
    vinhLong: 18900000,
    vungLiem: 18900000,
    duration: "4–5 tuần",
    included: "Xăng dầu DAT, cabin mô phỏng, giáo viên kèm",
  },
]

/** Các khoản thu ngoài học phí trọn gói. */
export const extraFees = [
  {
    label: "Khám sức khỏe",
    amount: 280000,
    note: "Khám tại sân thi hoặc tự khám bên ngoài",
  },
  {
    label: "Cabin mô phỏng",
    amount: 500000,
    note: "2 giờ bắt buộc theo quy định",
  },
  {
    label: "Lệ phí thi",
    amount: 1500000,
    note: "Tốt nghiệp, sát hạch và in cấp bằng",
  },
  {
    label: "Thuê xe cảm biến",
    amount: 550000,
    note: "Khoảng 500.000–600.000đ mỗi giờ khi sát hạch",
  },
]

/** Đầu mối hỗ trợ vận hành cho nhân viên. */
export const supportContacts = [
  {
    label: "Hotline tư vấn",
    value: "0779 666 664",
    note: "8:00–17:30 hằng ngày, kể cả thứ 7",
  },
  {
    label: "Zalo OA",
    value: "Gia Thịnh Vĩnh Long",
    note: "Dùng để gửi thông báo lịch ôn và lịch thi",
  },
  {
    label: "Email vận hành",
    value: "support@giathinh.vn",
    note: "Báo sai lệch dữ liệu, cấp lại tài khoản",
  },
]

/** Quy trình thường gặp, dẫn thẳng tới màn hình xử lý. */
export const supportPlaybook = [
  {
    title: "Tiếp nhận hồ sơ mới",
    steps:
      "Đối chiếu CCCD, ảnh thẻ và giấy khám sức khỏe, sau đó xếp lịch tư vấn trong Lịch đăng ký.",
    href: "/admin/lich-dang-ky",
    linkLabel: "Mở lịch đăng ký",
  },
  {
    title: "Mở lớp khi sắp hết chỗ",
    steps:
      "Theo dõi tỷ lệ lấp chỗ ở màn hình Lớp học; lớp còn dưới 10 chỗ thì tạo lớp kế tiếp cùng hạng.",
    href: "/admin/lop-hoc",
    linkLabel: "Mở danh sách lớp",
  },
  {
    title: "Đối soát học phí còn nợ",
    steps:
      "Lọc hồ sơ quá hạn ở màn hình Học phí, gọi nhắc trước ngày thi tốt nghiệp.",
    href: "/admin/hoc-phi",
    linkLabel: "Mở sổ học phí",
  },
  {
    title: "Xử lý bài viết chờ duyệt",
    steps:
      "Duyệt tin khai giảng và học phí trước khi xuất bản; bài quá 3 ngày chưa duyệt thì nhắc người phụ trách.",
    href: "/admin/bai-viet",
    linkLabel: "Mở danh sách bài viết",
  },
]

export const registrations: Registration[] = [
  {
    id: "GT-260924-01",
    student: "Nguyễn Minh Anh",
    initials: "MA",
    phone: "0903 412 869",
    course: "B tự động",
    branch: "Tân Ngãi",
    registeredAt: "24/09/2026",
    schedule: "24/09 · 08:00",
    status: "Đã xác nhận",
  },
  {
    id: "GT-260924-02",
    student: "Trần Quốc Bảo",
    initials: "QB",
    phone: "0786 205 114",
    course: "A1",
    branch: "Vũng Liêm",
    registeredAt: "24/09/2026",
    schedule: "24/09 · 09:30",
    status: "Chờ tư vấn",
  },
  {
    id: "GT-260923-08",
    student: "Lê Hoài Thương",
    initials: "HT",
    phone: "0939 882 610",
    course: "B số sàn",
    branch: "Thanh Đức",
    registeredAt: "23/09/2026",
    schedule: "24/09 · 14:00",
    status: "Đã đặt cọc",
  },
  {
    id: "GT-260923-07",
    student: "Phạm Gia Huy",
    initials: "GH",
    phone: "0918 440 327",
    course: "C1",
    branch: "Long Châu",
    registeredAt: "23/09/2026",
    schedule: "25/09 · 08:30",
    status: "Đã xác nhận",
  },
  {
    id: "GT-260922-11",
    student: "Võ Ngọc Trâm",
    initials: "NT",
    phone: "0765 149 280",
    course: "A",
    branch: "Phú Quới",
    registeredAt: "22/09/2026",
    schedule: "25/09 · 10:00",
    status: "Chờ tư vấn",
  },
  {
    id: "GT-260922-09",
    student: "Đặng Tuấn Kiệt",
    initials: "TK",
    phone: "0972 661 934",
    course: "B tự động",
    branch: "Tân Ngãi",
    registeredAt: "22/09/2026",
    schedule: "26/09 · 15:30",
    status: "Đã đặt cọc",
  },
  {
    id: "GT-260921-06",
    student: "Bùi Thanh Hà",
    initials: "TH",
    phone: "0854 707 122",
    course: "A1",
    branch: "Vũng Liêm",
    registeredAt: "21/09/2026",
    schedule: "28/09 · 08:00",
    status: "Đã xác nhận",
  },
  {
    id: "GT-260920-04",
    student: "Ngô Đức Phúc",
    initials: "ĐP",
    phone: "0988 351 406",
    course: "B số sàn",
    branch: "Thanh Đức",
    registeredAt: "20/09/2026",
    schedule: "28/09 · 13:30",
    status: "Chờ tư vấn",
  },
]

export type CalendarEvent = {
  day: number
  title: string
  meta: string
  tone: "primary" | "signal" | "warning"
}

export const calendarEvents: CalendarEvent[] = [
  {
    day: 2,
    title: "A1 · 6 học viên",
    meta: "08:00 · Vũng Liêm",
    tone: "signal",
  },
  {
    day: 5,
    title: "B tự động · 4 HV",
    meta: "13:30 · Tân Ngãi",
    tone: "primary",
  },
  {
    day: 8,
    title: "C1 · 5 học viên",
    meta: "08:30 · Long Châu",
    tone: "warning",
  },
  {
    day: 11,
    title: "A · 8 học viên",
    meta: "09:00 · Phú Quới",
    tone: "signal",
  },
  {
    day: 14,
    title: "A1 · 12 học viên",
    meta: "07:30 · Vũng Liêm",
    tone: "primary",
  },
  {
    day: 17,
    title: "B số sàn · 6 HV",
    meta: "14:00 · Thanh Đức",
    tone: "warning",
  },
  {
    day: 21,
    title: "B tự động · 8 HV",
    meta: "08:00 · Tân Ngãi",
    tone: "primary",
  },
  {
    day: 24,
    title: "Tư vấn hồ sơ · 12",
    meta: "08:00–16:30 · VP1",
    tone: "signal",
  },
  {
    day: 25,
    title: "C1 · 5 học viên",
    meta: "08:30 · Long Châu",
    tone: "warning",
  },
  {
    day: 28,
    title: "A1 · 10 học viên",
    meta: "08:00 · Vũng Liêm",
    tone: "primary",
  },
]

export const adminUsers = [
  {
    name: "Nguyễn Minh Anh",
    initials: "MA",
    phone: "0903 412 869",
    email: "minhanh.nguyen@gmail.com",
    role: "Học viên",
    course: "B tự động",
    joined: "24/09/2026",
    status: "Đang học",
  },
  {
    name: "Trần Quốc Bảo",
    initials: "QB",
    phone: "0786 205 114",
    email: "quocbao.tran@gmail.com",
    role: "Học viên",
    course: "A1",
    joined: "24/09/2026",
    status: "Chờ xác nhận",
  },
  {
    name: "Lê Hoài Thương",
    initials: "HT",
    phone: "0939 882 610",
    email: "hoaithuong.le@gmail.com",
    role: "Học viên",
    course: "B số sàn",
    joined: "23/09/2026",
    status: "Đang học",
  },
  {
    name: "Phạm Gia Huy",
    initials: "GH",
    phone: "0918 440 327",
    email: "giahuy.pham@gmail.com",
    role: "Học viên",
    course: "C1",
    joined: "23/09/2026",
    status: "Đã hoàn tất",
  },
  {
    name: "Võ Ngọc Trâm",
    initials: "NT",
    phone: "0765 149 280",
    email: "ngoctram.vo@gmail.com",
    role: "Học viên",
    course: "A",
    joined: "22/09/2026",
    status: "Chờ xác nhận",
  },
  {
    name: "Nguyễn Hoàng Đức",
    initials: "HĐ",
    phone: "0907 226 880",
    email: "duc.nguyen@giathinh.vn",
    role: "Giáo viên",
    course: "B, C1",
    joined: "12/01/2024",
    status: "Đang hoạt động",
  },
  {
    name: "Trần Mỹ Duyên",
    initials: "MD",
    phone: "0779 666 664",
    email: "duyen.tran@giathinh.vn",
    role: "Tư vấn viên",
    course: "—",
    joined: "06/03/2025",
    status: "Đang hoạt động",
  },
  {
    name: "Bùi Thanh Hà",
    initials: "TH",
    phone: "0854 707 122",
    email: "thanhha.bui@gmail.com",
    role: "Học viên",
    course: "A1",
    joined: "21/09/2026",
    status: "Đang học",
  },
]

export const adminPosts = [
  {
    title: "5 lưu ý trước ngày thi sát hạch A1",
    thumbnail:
      "/media/1789307300348_4599662549725482019_4599662549725482019_fdc3b40a8c3079067cf0cad66a40d03b.jpg",
    author: "Ban biên tập",
    category: "Kinh nghiệm thi",
    updated: "24/09/2026",
    status: "Đã xuất bản",
    views: "1.248",
  },
  {
    title: "Lịch khai giảng tháng 10: A1, B và C1",
    thumbnail:
      "/media/1789307373617_4599662549725482019_4599662549725482019_6fde98cbf02dab051b15c6b50e57eedf.jpg",
    author: "Mỹ Duyên",
    category: "Thông báo",
    updated: "23/09/2026",
    status: "Bản nháp",
    views: "—",
  },
  {
    title: "Chia sẻ kinh nghiệm qua vòng số 8 không chống chân",
    thumbnail:
      "/media/1789307300348_4599662549725482019_4599662549725482019_fdc3b40a8c3079067cf0cad66a40d03b.jpg",
    author: "Minh T.",
    category: "Xe máy — A & A1",
    updated: "23/09/2026",
    status: "Đã duyệt",
    views: "986",
  },
  {
    title: "Chạy DAT 810km mất bao lâu? Lịch chạy của mình đây",
    thumbnail:
      "/media/map/1789307362409_4599662549725482019_4599662549725482019_3e15cc0c135b22be293df84b61f611d1.jpg",
    author: "Hoài An",
    category: "Ô tô — B & C1",
    updated: "22/09/2026",
    status: "Chờ duyệt",
    views: "654",
  },
  {
    title: "Phân biệt hạng A và A1 theo quy định mới",
    thumbnail:
      "/media/1789307300543_4599662549725482019_4599662549725482019_b9d6dab7a63f5884f387f59bc22747e7.jpg",
    author: "Ban biên tập",
    category: "Tư vấn chọn bằng",
    updated: "20/09/2026",
    status: "Đã xuất bản",
    views: "2.106",
  },
  {
    title: "Mẹo canh gương khi ghép ngang trong sa hình",
    thumbnail:
      "/media/map/1789307362409_4599662549725482019_4599662549725482019_3e15cc0c135b22be293df84b61f611d1.jpg",
    author: "Thầy Đức",
    category: "Ô tô — B & C1",
    updated: "19/09/2026",
    status: "Đã duyệt",
    views: "1.572",
  },
  {
    title: "Học phí B và C1 gồm những gì, phát sinh bao nhiêu?",
    thumbnail:
      "/media/1789307366944_4599662549725482019_4599662549725482019_967a3bf4d808bb7d612acfb0f3d9fc6a.jpg",
    author: "Ban biên tập",
    category: "Học phí minh bạch",
    updated: "18/09/2026",
    status: "Đã xuất bản",
    views: "3.420",
  },
]
