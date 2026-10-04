import type { IBranch } from '../modules/branches/branch.model';
import type { SettingsValues } from '../modules/settings/settings.schema';

type SeedBranch = Pick<IBranch, 'name' | 'slug' | 'officeName' | 'address' | 'openingHours' | 'order'> & {
  mapUrl?: string;
};

export const seedBranches: SeedBranch[] = [
  {
    name: 'Tân Ngãi',
    slug: 'tan-ngai',
    officeName: 'VP1 — Tân Ngãi',
    address: 'Số 331A, P. Tân Ngãi, T. Vĩnh Long',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=331A+T%C3%A2n+Ng%C3%A3i+V%C4%A9nh+Long',
    openingHours: '7:30–17:30 · T2–T7',
    order: 1,
  },
  {
    name: 'Thanh Đức',
    slug: 'thanh-duc',
    officeName: 'VP2 — Thanh Đức',
    address: 'Số 183, P. Thanh Đức, T. Vĩnh Long',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=183+Thanh+%C4%90%E1%BB%A9c+V%C4%A9nh+Long',
    openingHours: '7:30–17:30 · T2–T7',
    order: 2,
  },
  {
    name: 'Long Châu',
    slug: 'long-chau',
    officeName: 'VP3 — Long Châu',
    address: 'Số 15C, đường Phạm Hùng, P. Long Châu, T. Vĩnh Long',
    mapUrl:
      'https://www.google.com/maps/search/?api=1&query=15C+Ph%E1%BA%A1m+H%C3%B9ng+Long+Ch%C3%A2u+V%C4%A9nh+Long',
    openingHours: '7:30–17:00 · T2–T7',
    order: 3,
  },
  {
    name: 'Phú Quới',
    slug: 'phu-quoi',
    officeName: 'VP4 — Phú Quới',
    address: 'Ấp Long Hòa, xã Phú Quới, T. Vĩnh Long',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Long+Ho%C3%A0+Ph%C3%BA+Qu%E1%BB%9Bi+V%C4%A9nh+Long',
    openingHours: '8:00–17:00 · T2–T6',
    order: 4,
  },
  {
    name: 'Vũng Liêm',
    slug: 'vung-liem',
    officeName: 'VP Vũng Liêm',
    address: 'TT GDTX Vũng Liêm, QL 53, xã Trung Thành, T. Vĩnh Long',
    openingHours: '7:30–17:30 · T2–T7',
    order: 5,
  },
];

export const seedSettings: Required<SettingsValues> = {
  hotline: '0779 666 664',
  zaloOa: 'Gia Thịnh Vĩnh Long',
  supportEmail: 'support@giathinh.vn',
  socials: [],
  supportContacts: [
    { label: 'Hotline tư vấn', value: '0779 666 664', note: '8:00–17:30 hằng ngày, kể cả thứ 7' },
    { label: 'Zalo OA', value: 'Gia Thịnh Vĩnh Long', note: 'Dùng để gửi thông báo lịch ôn và lịch thi' },
    { label: 'Email vận hành', value: 'support@giathinh.vn', note: 'Báo sai lệch dữ liệu, cấp lại tài khoản' },
  ],
  supportPlaybook: [
    {
      title: 'Tiếp nhận hồ sơ mới',
      steps: 'Đối chiếu CCCD, ảnh thẻ và giấy khám sức khỏe, sau đó xếp lịch tư vấn trong Lịch đăng ký.',
      href: '/admin/lich-dang-ky',
      linkLabel: 'Mở lịch đăng ký',
    },
    {
      title: 'Mở lớp khi sắp hết chỗ',
      steps: 'Theo dõi tỷ lệ lấp chỗ ở màn hình Lớp học; lớp còn dưới 10 chỗ thì tạo lớp kế tiếp cùng hạng.',
      href: '/admin/lop-hoc',
      linkLabel: 'Mở danh sách lớp',
    },
    {
      title: 'Đối soát học phí còn nợ',
      steps: 'Lọc hồ sơ quá hạn ở màn hình Học phí, gọi nhắc trước ngày thi tốt nghiệp.',
      href: '/admin/hoc-phi',
      linkLabel: 'Mở sổ học phí',
    },
    {
      title: 'Xử lý bài viết chờ duyệt',
      steps: 'Duyệt tin khai giảng và học phí trước khi xuất bản; bài quá 3 ngày chưa duyệt thì nhắc người phụ trách.',
      href: '/admin/bai-viet',
      linkLabel: 'Mở danh sách bài viết',
    },
  ],
  registerNotes: [
    'Học phí công khai giá gốc — nên đến trực tiếp văn phòng Gia Thịnh để đăng ký.',
    'Đã có GPLX trước đây phải trình báo cho nhân viên tư vấn khi đăng ký.',
    'Đăng ký xong nhớ lấy biên lai và liên hệ Gia Thịnh để vào nhóm Zalo nhận lịch ôn, thi.',
    'Có hỗ trợ ôn kèm luật 1:1 (phí riêng) nếu có nhu cầu.',
  ],
  consultationContactTimes: [
    { label: 'Buổi sáng, 07:00–11:30', value: 'Buổi sáng (07:00–11:30)' },
    { label: 'Buổi chiều, 13:00–17:30', value: 'Buổi chiều (13:00–17:30)' },
    { label: 'Buổi tối, 18:00–21:00', value: 'Buổi tối (18:00–21:00)' },
    { label: 'Liên hệ lúc nào cũng được', value: 'Bất kỳ thời gian nào' },
  ],
};
