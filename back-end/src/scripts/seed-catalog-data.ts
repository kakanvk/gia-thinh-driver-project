import type { VehicleType } from '../modules/courses/course.model';
import type { PriceItemKind } from '../modules/pricing/price-item.model';

export type SeedCourse = {
  code: string;
  name: string;
  vehicleType: VehicleType;
  description: string;
  duration: string;
  defaultPrice: number;
  priceNote: string;
  image: { url: string; alt: string };
  order: number;
};

export const seedCourses: SeedCourse[] = [
  {
    code: 'A1',
    name: 'Hạng A1',
    vehicleType: 'moto',
    description: 'Hạng A1 chạy xe đến 125cc (thi xe Wave).',
    duration: 'Lý thuyết 2 ngày',
    defaultPrice: 620_000,
    priceNote: 'Đã gồm hồ sơ, lý thuyết 2 ngày tập trung, lệ phí thi và cấp bằng',
    image: { url: '/vehicles/wave.png', alt: 'Xe Wave thi sát hạch hạng A1' },
    order: 1,
  },
  {
    code: 'A',
    name: 'Hạng A',
    vehicleType: 'moto',
    description: 'Hạng A chạy được xe A1 và xe trên 125cc (thi Vespa tay ga hoặc CB250 tay côn).',
    duration: 'Lý thuyết 2 ngày',
    defaultPrice: 1_750_000,
    priceNote: 'Đã gồm hồ sơ, lý thuyết 2 ngày tập trung, lệ phí thi và cấp bằng',
    image: { url: '/vehicles/scooter-a.png', alt: 'Xe tay ga thi sát hạch hạng A' },
    order: 2,
  },
  {
    code: 'B',
    name: 'Hạng B (sàn & tự động)',
    vehicleType: 'car',
    description: 'Giáo viên kèm từ đầu đến lúc lấy bằng. Hỗ trợ đóng theo đợt, HSSV giảm thêm 1.000.000đ.',
    duration: '3–4 tuần',
    defaultPrice: 16_500_000,
    priceNote: 'Đã gồm xăng DAT, xe giờ đêm/xe tự động, giáo viên đến lúc thi',
    image: { url: '/vehicles/car-b.png', alt: 'Xe tập lái hạng B' },
    order: 3,
  },
  {
    code: 'C1',
    name: 'Hạng C1',
    vehicleType: 'truck',
    description: 'Giáo viên kèm đến lúc lấy bằng. Hỗ trợ đóng theo đợt, HSSV giảm thêm 1.000.000đ.',
    duration: '4–5 tuần',
    defaultPrice: 18_900_000,
    priceNote: 'Đã gồm xăng dầu DAT, xe giờ đêm/xe tự động, giáo viên đến lúc thi',
    image: { url: '/vehicles/truck-c1.png', alt: 'Xe tập lái hạng C1' },
    order: 4,
  },
];

export const seedOverrides = [
  { branchSlug: 'vung-liem', courseCode: 'A1', price: 790_000 },
  { branchSlug: 'vung-liem', courseCode: 'A', price: 1_595_000 },
];

export type SeedPriceItem = {
  kind: PriceItemKind;
  key: string;
  courseCode: string | null;
  branchSlug: string | null;
  label: string;
  amount?: number;
  amountMax?: number;
  unit?: string;
  note?: string;
  hidden?: boolean;
  order: number;
};

const carFees = (courseCode: 'B' | 'C1', sensorMin: number): SeedPriceItem[] => [
  {
    kind: 'fee',
    key: 'kham-suc-khoe',
    courseCode,
    branchSlug: null,
    label: 'Khám sức khỏe',
    note: 'Tự khám hoặc tại trung tâm',
    order: 1,
  },
  {
    kind: 'fee',
    key: 'cabin-mo-phong',
    courseCode,
    branchSlug: null,
    label: 'Cabin mô phỏng',
    amount: 500_000,
    note: '2 giờ',
    order: 2,
  },
  { kind: 'fee', key: 'le-phi-thi', courseCode, branchSlug: null, label: 'Lệ phí thi', amount: 1_500_000, order: 3 },
  {
    kind: 'fee',
    key: 'thue-xe-cam-bien',
    courseCode,
    branchSlug: null,
    label: 'Thuê xe cảm biến',
    amount: sensorMin,
    amountMax: 600_000,
    unit: 'giờ',
    order: 4,
  },
  { kind: 'discount', key: 'hssv', courseCode, branchSlug: null, label: 'HSSV giảm thêm', amount: 1_000_000, order: 1 },
  { kind: 'discount', key: 'dong-theo-dot', courseCode, branchSlug: null, label: 'Hỗ trợ đóng theo đợt', order: 2 },
];

export const seedPriceItems: SeedPriceItem[] = [
  // Xe máy — mặc định (khu vực Vĩnh Long)
  {
    kind: 'fee',
    key: 'cam-bien-a',
    courseCode: 'A',
    branchSlug: null,
    label: 'Xe cảm biến A',
    amount: 70_000,
    unit: 'vòng',
    order: 1,
  },
  {
    kind: 'fee',
    key: 'cam-bien-a1',
    courseCode: 'A1',
    branchSlug: null,
    label: 'Xe cảm biến A1',
    amount: 20_000,
    unit: 'vòng',
    order: 1,
  },
  {
    kind: 'fee',
    key: 'thi-thu-may-tinh',
    courseCode: 'A',
    branchSlug: null,
    label: 'Thi thử máy tính',
    amount: 10_000,
    unit: 'lượt',
    order: 3,
  },
  {
    kind: 'fee',
    key: 'thi-thu-may-tinh',
    courseCode: 'A1',
    branchSlug: null,
    label: 'Thi thử máy tính',
    amount: 10_000,
    unit: 'lượt',
    order: 3,
  },
  {
    kind: 'discount',
    key: 'co-bang-o-to',
    courseCode: 'A',
    branchSlug: null,
    label: 'Có bằng ô tô: miễn lý thuyết',
    amount: 60_000,
    order: 1,
  },
  {
    kind: 'discount',
    key: 'co-bang-o-to',
    courseCode: 'A1',
    branchSlug: null,
    label: 'Có bằng ô tô: miễn lý thuyết',
    amount: 60_000,
    order: 1,
  },
  {
    kind: 'discount',
    key: 'hssv',
    courseCode: 'A',
    branchSlug: null,
    label: 'HSSV học hạng A (mang thẻ khi đăng ký)',
    amount: 500_000,
    order: 2,
  },
  // Xe máy — Vũng Liêm
  {
    kind: 'fee',
    key: 'cam-bien-a',
    courseCode: 'A',
    branchSlug: 'vung-liem',
    label: 'Cảm biến A tay ga Vespa',
    amount: 50_000,
    unit: 'vòng',
    order: 1,
  },
  {
    kind: 'fee',
    key: 'cam-bien-a-tay-con',
    courseCode: 'A',
    branchSlug: 'vung-liem',
    label: 'Cảm biến A tay côn',
    amount: 40_000,
    unit: 'vòng',
    order: 2,
  },
  {
    kind: 'fee',
    key: 'thi-thu-may-tinh',
    courseCode: 'A',
    branchSlug: 'vung-liem',
    label: 'Thi thử máy tính',
    hidden: true,
    order: 3,
  },
  {
    kind: 'fee',
    key: 'thi-thu-may-tinh',
    courseCode: 'A1',
    branchSlug: 'vung-liem',
    label: 'Thi thử máy tính',
    hidden: true,
    order: 3,
  },
  {
    kind: 'discount',
    key: 'hssv',
    courseCode: 'A',
    branchSlug: 'vung-liem',
    label: 'HSSV học hạng A',
    hidden: true,
    order: 2,
  },
  // Ô tô
  ...carFees('B', 300_000),
  ...carFees('C1', 350_000),
];

export const seedCategories = [
  {
    slug: 'kinh-nghiem-thi',
    name: 'Kinh nghiệm thi',
    description: 'Mẹo ôn lý thuyết, chạy sa hình và giữ bình tĩnh trong ngày sát hạch.',
    isAnnouncement: false,
    order: 1,
  },
  {
    slug: 'kinh-nghiem-hoc',
    name: 'Kinh nghiệm học',
    description: 'Chạy DAT, cabin mô phỏng và cách sắp xếp lịch học thực hành.',
    isAnnouncement: false,
    order: 2,
  },
  {
    slug: 'tu-van-chon-bang',
    name: 'Tư vấn chọn bằng',
    description: 'So sánh hạng A, A1, B, C1 theo nhu cầu đi lại và loại xe bạn đang dùng.',
    isAnnouncement: false,
    order: 3,
  },
  {
    slug: 'hoc-phi-minh-bach',
    name: 'Học phí minh bạch',
    description: 'Trọn gói gồm những gì, phụ phí nào phát sinh và ưu đãi dành cho HSSV.',
    isAnnouncement: false,
    order: 4,
  },
  {
    slug: 'thong-bao',
    name: 'Thông báo',
    description: 'Lịch khai giảng, hồ sơ cần chuẩn bị và thông tin mới từ trung tâm.',
    isAnnouncement: true,
    order: 5,
  },
];
