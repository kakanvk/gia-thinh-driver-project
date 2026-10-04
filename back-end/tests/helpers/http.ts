import type { Response } from 'supertest';

export function refreshCookieFrom(res: Response): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.map((cookie) => cookie.split(';')[0]!).find((cookie) => cookie.startsWith('gt_refresh=') && cookie !== 'gt_refresh=');
}
