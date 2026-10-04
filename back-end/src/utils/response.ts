import type { Response } from 'express';

export type PageMeta = { page: number; limit: number; total: number };

export function sendData(res: Response, data: unknown, status = 200): void {
  res.status(status).json({ data });
}

export function sendList(res: Response, result: { data: unknown[]; meta: PageMeta }): void {
  res.status(200).json(result);
}
