import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { ZodError } from 'zod';
import { logger } from '../config/logger';
import { ApiError } from '../utils/ApiError';

function isDuplicateKey(err: unknown): err is { code: number; keyValue?: Record<string, unknown> } {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;
}

function isBodyParseError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { type?: unknown }).type === 'entity.parse.failed';
}

function isClientError(err: unknown): err is { status?: number; statusCode?: number; type?: string } {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { status?: unknown; statusCode?: unknown };
  const statusCode = typeof e.status === 'number' ? e.status : typeof e.statusCode === 'number' ? e.statusCode : null;
  return statusCode !== null && statusCode >= 400 && statusCode < 500;
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof ZodError) {
    return ApiError.badRequest(
      'Dữ liệu không hợp lệ',
      err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }
  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Giá trị không hợp lệ cho trường ${err.path}`, [
      { path: err.path, message: 'Sai định dạng' },
    ]);
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return ApiError.badRequest(
      'Dữ liệu không hợp lệ',
      Object.values(err.errors).map((item) => ({ path: item.path, message: item.message })),
    );
  }
  if (isDuplicateKey(err)) {
    return ApiError.conflict(
      'Dữ liệu đã tồn tại',
      Object.keys(err.keyValue ?? {}).map((key) => ({ path: key, message: 'Đã tồn tại' })),
    );
  }
  if (err instanceof multer.MulterError) {
    return ApiError.badRequest(
      err.code === 'LIMIT_FILE_SIZE' ? 'File vượt quá dung lượng cho phép (5MB)' : 'File tải lên không hợp lệ',
    );
  }
  if (isBodyParseError(err)) return ApiError.badRequest('JSON không hợp lệ');
  if (isClientError(err)) {
    const e = err as { type?: string; status?: number; statusCode?: number };
    const message =
      e.type === 'entity.too.large' || e.status === 413 || e.statusCode === 413
        ? 'Dữ liệu gửi lên quá lớn'
        : 'Yêu cầu không hợp lệ';
    return ApiError.badRequest(message);
  }
  return new ApiError(500, 'INTERNAL_ERROR', 'Đã có lỗi xảy ra, vui lòng thử lại sau');
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`Không tìm thấy ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const apiError = toApiError(err);
  if (apiError.status >= 500) (req.log ?? logger).error({ err }, 'Lỗi không xử lý được');
  res.status(apiError.status).json({
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details ? { details: apiError.details } : {}),
    },
  });
};
