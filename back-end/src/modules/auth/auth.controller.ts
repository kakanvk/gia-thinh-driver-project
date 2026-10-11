import type { CookieOptions, Request, Response } from 'express';
import { env } from '../../config/env';
import { validated } from '../../middlewares/validate.middleware';
import { sendData } from '../../utils/response';
import * as authService from './auth.service';
import type { ChangePasswordInput, LoginInput, UpdateMeInput } from './auth.validation';

export const REFRESH_COOKIE = 'gt_refresh';

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

function sendSession(res: Response, session: authService.Session): void {
  res.cookie(REFRESH_COOKIE, session.refreshToken, {
    ...cookieOptions(),
    maxAge: env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
  });
  sendData(res, { accessToken: session.accessToken, user: session.user });
}

function readRefreshCookie(req: Request): string | undefined {
  const value = (req.cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE];
  return typeof value === 'string' ? value : undefined;
}

export async function login(req: Request, res: Response): Promise<void> {
  const { identifier, password } = validated<LoginInput>(req, 'body');
  sendSession(res, await authService.login(identifier, password));
}

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    sendSession(res, await authService.refresh(readRefreshCookie(req)));
  } catch (error) {
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
    throw error;
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  await authService.logout(readRefreshCookie(req));
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
  res.status(204).end();
}

export async function me(req: Request, res: Response): Promise<void> {
  sendData(res, await authService.getMe(req.user!.id));
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  sendData(res, await authService.updateMe(req.user!.id, validated<UpdateMeInput>(req, 'body')));
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const { currentPassword, newPassword } = validated<ChangePasswordInput>(req, 'body');
  await authService.changePassword(req.user!.id, currentPassword, newPassword);
  res.status(204).end();
}
