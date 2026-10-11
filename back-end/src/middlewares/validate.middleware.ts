import type { Request, RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { ApiError, type ErrorDetail } from '../utils/ApiError';

type Part = 'body' | 'query' | 'params';
type Schemas = Partial<Record<Part, ZodType>>;

const PARTS: Part[] = ['params', 'query', 'body'];

export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    const output: NonNullable<Request['valid']> = { ...req.valid };
    const details: ErrorDetail[] = [];

    for (const part of PARTS) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (result.success) {
        output[part] = result.data;
      } else {
        for (const issue of result.error.issues) {
          details.push({ path: [part, ...issue.path].join('.'), message: issue.message });
        }
      }
    }

    if (details.length > 0) return next(ApiError.badRequest('Dữ liệu không hợp lệ', details));
    req.valid = output;
    next();
  };
}

export function validated<T>(req: Request, part: Part): T {
  return req.valid?.[part] as T;
}
