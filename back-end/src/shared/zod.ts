import { z } from 'zod';
import { parseDateOnly, parseDateTime } from './time';

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'ID không hợp lệ');

export const idParamsSchema = z.object({ id: objectIdSchema });

export const zDateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có dạng YYYY-MM-DD')
  .transform((value, ctx) => {
    try {
      return parseDateOnly(value);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Ngày không tồn tại' });
      return z.NEVER;
    }
  });

export const zDateTime = z.string().transform((value, ctx) => {
  try {
    return parseDateTime(value);
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Thời gian không hợp lệ' });
    return z.NEVER;
  }
});
