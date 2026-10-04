type Op = {
  tags: string[];
  summary: string;
  security?: Record<string, string[]>[];
  parameters?: Record<string, unknown>[];
  requestBody?: Record<string, unknown>;
  responses: Record<string, { description: string }>;
};

const bearer = [{ bearerAuth: [] }];
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string' } };
const listParams = ['page', 'limit', 'sort', 'q'].map((name) => ({ name, in: 'query', schema: { type: 'string' } }));

function json(example: Record<string, unknown>) {
  return { required: true, content: { 'application/json': { example } } };
}

function op(tag: string, summary: string, extra: Partial<Op> = {}, auth = true): Op {
  return {
    tags: [tag],
    summary,
    ...(auth ? { security: bearer } : {}),
    responses: { '200': { description: 'Thành công' }, '4XX': { description: 'Lỗi, xem schema Error' } },
    ...extra,
  };
}

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Gia Thịnh API',
    version: '0.1.0',
    description:
      'Đợt 1 — nền tảng. Thời gian trả về theo giờ Việt Nam (+07:00). Lỗi có dạng { error: { code, message, details? } }.',
  },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
    },
  },
  paths: {
    '/health': { get: op('Hệ thống', 'Kiểm tra trạng thái', {}, false) },
    '/auth/login': {
      post: op(
        'Auth',
        'Đăng nhập bằng SĐT hoặc username',
        { requestBody: json({ identifier: '0779666664', password: 'Matkhau123' }) },
        false,
      ),
    },
    '/auth/refresh': { post: op('Auth', 'Cấp lại access token (cookie gt_refresh)', {}, false) },
    '/auth/logout': { post: op('Auth', 'Đăng xuất', {}, false) },
    '/auth/me': {
      get: op('Auth', 'Thông tin tài khoản và quyền'),
      patch: op('Auth', 'Sửa hồ sơ', { requestBody: json({ name: 'Mỹ Duyên', phone: '0779666664' }) }),
    },
    '/auth/change-password': {
      post: op('Auth', 'Đổi mật khẩu', {
        requestBody: json({ currentPassword: 'Matkhau123', newPassword: 'Moimatkhau1' }),
      }),
    },
    '/users': {
      get: op('Người dùng', 'Danh sách nhân viên', {
        parameters: [...listParams, { name: 'role', in: 'query', schema: { type: 'string' } }],
      }),
      post: op('Người dùng', 'Tạo nhân viên', {
        requestBody: json({
          name: 'Trần Mỹ Duyên',
          username: 'duyen.tran',
          phone: '0779666664',
          password: 'Matkhau123',
          role: 'consultant',
          branchIds: ['<branchId>'],
        }),
      }),
    },
    '/users/{id}': {
      get: op('Người dùng', 'Chi tiết nhân viên', { parameters: [idParam] }),
      patch: op('Người dùng', 'Sửa nhân viên', { parameters: [idParam], requestBody: json({ name: 'Tên mới' }) }),
      delete: op('Người dùng', 'Xóa (mềm) nhân viên', { parameters: [idParam] }),
    },
    '/users/{id}/status': {
      patch: op('Người dùng', 'Khóa/mở khóa', { parameters: [idParam], requestBody: json({ status: 'suspended' }) }),
    },
    '/users/{id}/reset-password': {
      post: op('Người dùng', 'Cấp mật khẩu tạm', { parameters: [idParam] }),
    },
    '/branches': {
      get: op('Chi nhánh', 'Danh sách chi nhánh', { parameters: listParams }),
      post: op('Chi nhánh', 'Tạo chi nhánh', {
        requestBody: json({
          name: 'Tân Ngãi',
          officeName: 'VP1 — Tân Ngãi',
          address: 'Số 331A, P. Tân Ngãi, T. Vĩnh Long',
        }),
      }),
    },
    '/branches/{id}': {
      get: op('Chi nhánh', 'Chi tiết chi nhánh', { parameters: [idParam] }),
      patch: op('Chi nhánh', 'Sửa chi nhánh', {
        parameters: [idParam],
        requestBody: json({ openingHours: '7:30–17:30 · T2–T7' }),
      }),
      delete: op('Chi nhánh', 'Xóa (mềm) chi nhánh', { parameters: [idParam] }),
    },
    '/settings': {
      get: op('Cài đặt', 'Đọc cài đặt'),
      patch: op('Cài đặt', 'Cập nhật cài đặt (super_admin)', { requestBody: json({ hotline: '0779 666 664' }) }),
    },
    '/media': {
      get: op('Media', 'Danh sách ảnh', { parameters: listParams }),
      post: op('Media', 'Upload ảnh (multipart: file, alt)', {
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: { file: { type: 'string', format: 'binary' }, alt: { type: 'string' } },
              },
            },
          },
        },
      }),
    },
    '/audit': {
      get: op('Audit', 'Lịch sử thao tác (super_admin)', {
        parameters: [
          ...listParams,
          ...['entity', 'entityId', 'actor', 'from', 'to'].map((name) => ({
            name,
            in: 'query',
            schema: { type: 'string' },
          })),
        ],
      }),
    },
    '/courses': {
      get: op('Gói học', 'Danh sách gói học', {
        parameters: [...listParams, { name: 'active', in: 'query', schema: { type: 'string' } }],
      }),
      post: op('Gói học', 'Tạo gói học (super_admin)', {
        requestBody: json({ code: 'B', name: 'Hạng B', vehicleType: 'car', defaultPrice: 16_500_000 }),
      }),
    },
    '/courses/reorder': { patch: op('Gói học', 'Sắp xếp gói học', { requestBody: json({ ids: ['<courseId>'] }) }) },
    '/courses/{id}': {
      get: op('Gói học', 'Chi tiết gói học', { parameters: [idParam] }),
      patch: op('Gói học', 'Sửa gói học / giá mặc định (super_admin)', {
        parameters: [idParam],
        requestBody: json({ defaultPrice: 17_000_000 }),
      }),
      delete: op('Gói học', 'Xóa (mềm) gói học', { parameters: [idParam] }),
    },
    '/pricing/branches/{branchId}': {
      get: op('Bảng giá', 'Bảng giá đầy đủ của chi nhánh (có nguồn giá)', {
        parameters: [{ name: 'branchId', in: 'path', required: true, schema: { type: 'string' } }],
      }),
    },
    '/pricing/branches/{branchId}/courses/{courseId}': {
      put: op('Bảng giá', 'Đặt giá riêng cho chi nhánh', {
        parameters: ['branchId', 'courseId'].map((name) => ({
          name,
          in: 'path',
          required: true,
          schema: { type: 'string' },
        })),
        requestBody: json({ price: 1_595_000 }),
      }),
      delete: op('Bảng giá', 'Bỏ giá riêng, về giá mặc định', {
        parameters: ['branchId', 'courseId'].map((name) => ({
          name,
          in: 'path',
          required: true,
          schema: { type: 'string' },
        })),
      }),
    },
    '/pricing/items': {
      get: op('Bảng giá', 'Danh sách phụ phí / ưu đãi', {
        parameters: [
          ...listParams,
          ...['kind', 'branchId', 'courseId'].map((name) => ({ name, in: 'query', schema: { type: 'string' } })),
        ],
      }),
      post: op('Bảng giá', 'Tạo phụ phí / ưu đãi', {
        requestBody: json({
          kind: 'fee',
          key: 'cam-bien-a',
          courseId: '<courseId>',
          branchId: null,
          label: 'Xe cảm biến A',
          amount: 70_000,
          unit: 'vòng',
        }),
      }),
    },
    '/pricing/items/{id}': {
      patch: op('Bảng giá', 'Sửa phụ phí / ưu đãi', { parameters: [idParam], requestBody: json({ amount: 50_000 }) }),
      delete: op('Bảng giá', 'Xóa phụ phí / ưu đãi', { parameters: [idParam] }),
    },
    '/categories': {
      get: op('Bài viết', 'Danh sách chuyên mục'),
      post: op('Bài viết', 'Tạo chuyên mục', { requestBody: json({ name: 'Kinh nghiệm thi' }) }),
    },
    '/categories/reorder': { patch: op('Bài viết', 'Sắp xếp chuyên mục', { requestBody: json({ ids: ['<categoryId>'] }) }) },
    '/categories/{id}': {
      get: op('Bài viết', 'Chi tiết chuyên mục', { parameters: [idParam] }),
      patch: op('Bài viết', 'Sửa chuyên mục', { parameters: [idParam], requestBody: json({ name: 'Mẹo học' }) }),
      delete: op('Bài viết', 'Xóa chuyên mục (409 nếu còn bài)', { parameters: [idParam] }),
    },
    '/posts': {
      get: op('Bài viết', 'Danh sách bài viết (không kèm nội dung)', {
        parameters: [
          ...listParams,
          ...['status', 'categoryId', 'tag'].map((name) => ({ name, in: 'query', schema: { type: 'string' } })),
        ],
      }),
      post: op('Bài viết', 'Tạo bản nháp', {
        requestBody: json({
          title: '5 lưu ý trước ngày thi A1',
          categoryId: '<categoryId>',
          content: [{ type: 'p', children: [{ text: '...' }] }],
        }),
      }),
    },
    '/posts/{id}': {
      get: op('Bài viết', 'Chi tiết bài viết', { parameters: [idParam] }),
      patch: op('Bài viết', 'Sửa bài viết', { parameters: [idParam], requestBody: json({ title: 'Tiêu đề mới' }) }),
      delete: op('Bài viết', 'Xóa (mềm) bài viết', { parameters: [idParam] }),
    },
    '/posts/{id}/submit': { post: op('Bài viết', 'Gửi duyệt', { parameters: [idParam] }) },
    '/posts/{id}/publish': {
      post: op('Bài viết', 'Xuất bản (có thể hẹn giờ)', {
        parameters: [idParam],
        requestBody: json({ publishedAt: '2026-10-10T08:00' }),
      }),
    },
    '/posts/{id}/unpublish': { post: op('Bài viết', 'Gỡ xuất bản', { parameters: [idParam] }) },
    '/posts/{id}/archive': { post: op('Bài viết', 'Lưu trữ', { parameters: [idParam] }) },
    '/posts/{id}/restore': { post: op('Bài viết', 'Khôi phục bài lưu trữ về bản nháp', { parameters: [idParam] }) },
    '/posts/{id}/duplicate': { post: op('Bài viết', 'Nhân bản thành bản nháp', { parameters: [idParam] }) },
    '/leads': {
      get: op('CRM', 'Danh sách khách (theo chi nhánh của nhân viên)', {
        parameters: [
          ...listParams,
          ...['status', 'branchId', 'assigneeId', 'source', 'courseId', 'followUpDue', 'from', 'to'].map((name) => ({
            name,
            in: 'query',
            schema: { type: 'string' },
          })),
        ],
      }),
      post: op('CRM', 'Tạo khách (tại quầy/điện thoại)', {
        requestBody: json({
          name: 'Nguyễn Văn An',
          phone: '0903412869',
          branchId: '<branchId>',
          courseId: '<courseId>',
          source: 'walk_in',
        }),
      }),
    },
    '/leads/export': {
      get: op('CRM', 'Xuất CSV (quản lý)', {
        parameters: ['status', 'branchId', 'from', 'to'].map((name) => ({ name, in: 'query', schema: { type: 'string' } })),
      }),
    },
    '/leads/{id}': {
      get: op('CRM', 'Chi tiết khách', { parameters: [idParam] }),
      patch: op('CRM', 'Sửa thông tin khách', { parameters: [idParam], requestBody: json({ note: 'Hỏi lịch cuối tuần' }) }),
      delete: op('CRM', 'Xóa (mềm) khách (quản lý)', { parameters: [idParam] }),
    },
    '/leads/{id}/status': {
      patch: op('CRM', 'Chuyển trạng thái', {
        parameters: [idParam],
        requestBody: json({ status: 'lost', lostReason: 'Chọn trung tâm khác' }),
      }),
    },
    '/leads/{id}/assign': {
      patch: op('CRM', 'Phân công người phụ trách', {
        parameters: [idParam],
        requestBody: json({ assigneeId: '<userId>' }),
      }),
    },
    '/leads/{id}/activities': {
      get: op('CRM', 'Lịch sử chăm sóc', {
        parameters: [idParam, ...['page', 'limit'].map((name) => ({ name, in: 'query', schema: { type: 'string' } }))],
      }),
      post: op('CRM', 'Ghi cuộc gọi / ghi chú', {
        parameters: [idParam],
        requestBody: json({ type: 'call', content: 'Khách hẹn gọi lại', nextFollowUpAt: '2026-10-10T09:00' }),
      }),
    },
    '/appointments': {
      get: op('Lịch hẹn', 'Danh sách lịch hẹn', {
        parameters: [
          ...listParams,
          ...['from', 'to', 'branchId', 'assigneeId', 'leadId', 'status'].map((name) => ({
            name,
            in: 'query',
            schema: { type: 'string' },
          })),
        ],
      }),
      post: op('Lịch hẹn', 'Đặt lịch hẹn', {
        requestBody: json({ leadId: '<leadId>', startAt: '2026-10-24T08:00', type: 'consult', assigneeId: '<userId>' }),
      }),
    },
    '/appointments/calendar': {
      get: op('Lịch hẹn', 'Lịch theo tháng', {
        parameters: ['month', 'branchId', 'assigneeId'].map((name) => ({ name, in: 'query', schema: { type: 'string' } })),
      }),
    },
    '/appointments/{id}': {
      get: op('Lịch hẹn', 'Chi tiết lịch hẹn', { parameters: [idParam] }),
      patch: op('Lịch hẹn', 'Dời lịch / đổi người phụ trách', {
        parameters: [idParam],
        requestBody: json({ startAt: '2026-10-25T14:00' }),
      }),
      delete: op('Lịch hẹn', 'Xóa (mềm) lịch hẹn', { parameters: [idParam] }),
    },
    '/appointments/{id}/status': {
      patch: op('Lịch hẹn', 'Đổi trạng thái lịch hẹn', {
        parameters: [idParam],
        requestBody: json({ status: 'done', note: 'Khách đã đặt cọc' }),
      }),
    },
    '/public/leads': {
      post: op(
        'Công khai',
        'Gửi form tư vấn',
        {
          requestBody: json({
            name: 'Nguyễn Văn An',
            phone: '0779666664',
            branch: 'tan-ngai',
            courseCode: 'B',
            preferredContactTime: 'Buổi chiều (13:00–17:30)',
            consent: true,
          }),
        },
        false,
      ),
    },
    '/public/pricing': {
      get: op(
        'Công khai',
        'Bảng giá theo chi nhánh',
        { parameters: [{ name: 'branch', in: 'query', schema: { type: 'string' } }] },
        false,
      ),
    },
    '/public/categories': { get: op('Công khai', 'Chuyên mục kèm số bài', {}, false) },
    '/public/posts': {
      get: op(
        'Công khai',
        'Tin đã xuất bản',
        {
          parameters: ['page', 'limit', 'category', 'q'].map((name) => ({ name, in: 'query', schema: { type: 'string' } })),
        },
        false,
      ),
    },
    '/public/posts/{slug}': {
      get: op(
        'Công khai',
        'Chi tiết tin (+1 lượt xem)',
        {
          parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        },
        false,
      ),
    },
    '/public/branches': { get: op('Công khai', 'Văn phòng/chi nhánh đang hoạt động', {}, false) },
    '/public/settings': { get: op('Công khai', 'Hotline, Zalo, mạng xã hội, lưu ý đăng ký', {}, false) },
  },
};
