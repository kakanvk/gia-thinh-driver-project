export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'BRANCH_FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export type ErrorDetail = { path: string; message: string };

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static badRequest(message = 'Dữ liệu không hợp lệ', details?: ErrorDetail[]) {
    return new ApiError(400, 'VALIDATION_ERROR', message, details);
  }

  static unauthorized(message = 'Bạn cần đăng nhập để tiếp tục') {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Bạn không có quyền thực hiện thao tác này') {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static branchForbidden(message = 'Bạn không có quyền với chi nhánh này') {
    return new ApiError(403, 'BRANCH_FORBIDDEN', message);
  }

  static notFound(message = 'Không tìm thấy dữ liệu') {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static conflict(message: string, details?: ErrorDetail[]) {
    return new ApiError(409, 'CONFLICT', message, details);
  }
}
