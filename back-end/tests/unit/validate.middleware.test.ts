import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { validate, validated } from '../../src/middlewares/validate.middleware';
import { ApiError } from '../../src/utils/ApiError';

function run(schema: Parameters<typeof validate>[0], req: Partial<Request>) {
  const next = vi.fn();
  validate(schema)(req as Request, {} as never, next);
  return next;
}

describe('validate', () => {
  it('ghi dữ liệu đã parse vào req.valid', () => {
    const req: Partial<Request> = { query: { page: '2' } as never, body: {}, params: {} };
    const next = run({ query: z.object({ page: z.coerce.number() }) }, req);
    expect(next).toHaveBeenCalledWith();
    expect(validated<{ page: number }>(req as Request, 'query').page).toBe(2);
  });

  it('trả VALIDATION_ERROR với path có tiền tố phần request', () => {
    const next = run({ body: z.object({ email: z.email() }) }, { body: { email: 'x' }, query: {}, params: {} });
    const err = next.mock.calls[0]?.[0] as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details?.[0]?.path).toBe('body.email');
  });
});
