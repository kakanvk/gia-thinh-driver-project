import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { toApiError } from '../../src/middlewares/error.middleware';
import { ApiError } from '../../src/utils/ApiError';

describe('toApiError', () => {
  it('giữ nguyên ApiError', () => {
    const err = ApiError.forbidden();
    expect(toApiError(err)).toBe(err);
  });

  it('chuyển ZodError thành VALIDATION_ERROR có details', () => {
    const parsed = z.object({ name: z.string() }).safeParse({});
    const err = toApiError(parsed.error);
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details?.[0]?.path).toBe('name');
  });

  it('chuyển CastError thành 400', () => {
    const err = toApiError(new mongoose.Error.CastError('ObjectId', 'abc', '_id'));
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
  });

  it('chuyển lỗi trùng khóa 11000 thành 409 CONFLICT', () => {
    const err = toApiError({ code: 11000, keyValue: { email: 'a@b.vn' } });
    expect(err.status).toBe(409);
    expect(err.code).toBe('CONFLICT');
    expect(err.details).toEqual([{ path: 'email', message: 'Đã tồn tại' }]);
  });

  it('chuyển lỗi JSON sai cú pháp thành 400', () => {
    expect(toApiError({ type: 'entity.parse.failed' }).status).toBe(400);
  });

  it('chuyển entity.too.large (413) thành 400 VALIDATION_ERROR với message "Dữ liệu gửi lên quá lớn"', () => {
    const err = toApiError({ type: 'entity.too.large', status: 413 });
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Dữ liệu gửi lên quá lớn');
  });

  it('chuyển client error khác (400–499) thành VALIDATION_ERROR với generic message', () => {
    const err = toApiError({ status: 415, type: 'encoding.unsupported' });
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Yêu cầu không hợp lệ');
  });

  it('lỗi lạ thành 500 INTERNAL_ERROR, không lộ message gốc', () => {
    const err = toApiError(new Error('secret detail'));
    expect(err.status).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.message).not.toContain('secret');
  });
});
