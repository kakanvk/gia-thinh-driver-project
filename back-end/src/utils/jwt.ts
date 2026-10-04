import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ROLES, type Role } from '../config/roles';

export type AccessPayload = { sub: string; role: Role };

export function signAccessToken(user: { id: string; role: Role }): string {
  return jwt.sign({ role: user.role }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    subject: user.id,
    expiresIn: env.JWT_ACCESS_EXPIRES_MIN * 60,
  });
}

export function verifyAccessToken(token: string): AccessPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
  if (typeof payload === 'string' || typeof payload.sub !== 'string' || !ROLES.includes(payload.role)) {
    throw new Error('Access token không hợp lệ');
  }
  return { sub: payload.sub, role: payload.role as Role };
}
