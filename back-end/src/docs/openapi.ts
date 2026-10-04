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
    '/public/branches': { get: op('Công khai', 'Văn phòng/chi nhánh đang hoạt động', {}, false) },
    '/public/settings': { get: op('Công khai', 'Hotline, Zalo, mạng xã hội, lưu ý đăng ký', {}, false) },
  },
};
