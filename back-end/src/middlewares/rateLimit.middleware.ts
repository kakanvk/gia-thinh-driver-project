import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { ApiError } from '../utils/ApiError';

export function createRateLimiter(opts: {
  windowMs: number;
  limit: number;
  message: string;
  skipSuccessfulRequests?: boolean;
}): RequestHandler {
  return rateLimit({
    windowMs: opts.windowMs,
    limit: opts.limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: opts.skipSuccessfulRequests ?? false,
    handler: (_req, _res, next) => next(new ApiError(429, 'RATE_LIMITED', opts.message)),
  });
}
