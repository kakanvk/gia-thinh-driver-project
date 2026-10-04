import type { RequestHandler } from 'express';

export function stripMongoOperators(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripMongoOperators);
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !key.startsWith('$') && !key.includes('.'))
        .map(([key, nested]) => [key, stripMongoOperators(nested)]),
    );
  }
  return value;
}

export const sanitizeBody: RequestHandler = (req, _res, next) => {
  if (req.body && typeof req.body === 'object') req.body = stripMongoOperators(req.body);
  next();
};
