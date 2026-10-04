import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { addDays } from 'date-fns';
import { env } from '../../config/env';
import { permissionsFor } from '../../config/roles';
import { ApiError } from '../../utils/ApiError';
import { randomToken, sha256 } from '../../utils/crypto';
import { signAccessToken } from '../../utils/jwt';
import { normalizePhone } from '../../utils/phone';
import { hashPassword, User, type UserDoc } from '../users/user.model';
import { Token } from './token.model';
import type { UpdateMeInput } from './auth.validation';

export type Session = { user: UserDoc; accessToken: string; refreshToken: string };

const REUSE_GRACE_MS = 10_000;
const DUMMY_HASH = hashPassword(randomUUID());

const SESSION_EXPIRED = 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại';

async function issueRefreshToken(userId: string, family: string): Promise<string> {
  const raw = randomToken();
  await Token.create({
    userId,
    tokenHash: sha256(raw),
    type: 'refresh',
    family,
    expiresAt: addDays(new Date(), env.JWT_REFRESH_EXPIRES_DAYS),
    revokedAt: null,
  });
  return raw;
}

function accessTokenFor(user: UserDoc): string {
  return signAccessToken({ id: user.id, role: user.role });
}

export async function login(identifier: string, password: string): Promise<Session> {
  const user = await User.findOne({
    $or: [{ username: identifier.toLowerCase() }, { phone: normalizePhone(identifier) }],
  });
  if (!user) {
    await bcrypt.compare(password, await DUMMY_HASH);
    throw ApiError.unauthorized('Tài khoản hoặc mật khẩu không đúng');
  }
  if (!(await user.verifyPassword(password))) {
    throw ApiError.unauthorized('Tài khoản hoặc mật khẩu không đúng');
  }
  if (user.status !== 'active') throw ApiError.forbidden('Tài khoản đã bị khóa, vui lòng liên hệ quản trị viên');

  user.lastLoginAt = new Date();
  await user.save();
  const refreshToken = await issueRefreshToken(user.id, randomUUID());
  return { user, accessToken: accessTokenFor(user), refreshToken };
}

export async function refresh(raw: string | undefined): Promise<Session> {
  if (!raw) throw ApiError.unauthorized(SESSION_EXPIRED);
  const tokenHash = sha256(raw);
  const now = new Date();

  const record = await Token.findOneAndUpdate(
    { tokenHash, type: 'refresh', revokedAt: null, expiresAt: { $gt: now } },
    { revokedAt: now },
  );

  if (!record) {
    const reused = await Token.findOne({ tokenHash, type: 'refresh' });
    if (reused?.revokedAt && now.getTime() - reused.revokedAt.getTime() > REUSE_GRACE_MS) {
      await Token.updateMany({ family: reused.family, revokedAt: null }, { revokedAt: now });
    }
    throw ApiError.unauthorized(SESSION_EXPIRED);
  }

  const user = await User.findById(record.userId);
  if (!user || user.status !== 'active') throw ApiError.unauthorized(SESSION_EXPIRED);

  const refreshToken = await issueRefreshToken(user.id, record.family);
  return { user, accessToken: accessTokenFor(user), refreshToken };
}

export async function logout(raw: string | undefined): Promise<void> {
  if (!raw) return;
  await Token.updateOne({ tokenHash: sha256(raw), type: 'refresh', revokedAt: null }, { revokedAt: new Date() });
}

export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await Token.updateMany({ userId, type: 'refresh', revokedAt: null }, { revokedAt: new Date() });
}

export async function getMe(userId: string): Promise<{ user: UserDoc; permissions: string[] }> {
  const user = await User.findById(userId);
  if (!user) throw ApiError.unauthorized();
  return { user, permissions: permissionsFor(user.role) };
}

export async function updateMe(userId: string, input: UpdateMeInput): Promise<{ user: UserDoc; permissions: string[] }> {
  const user = await User.findById(userId);
  if (!user) throw ApiError.unauthorized();
  user.set(input);
  await user.save();
  return { user, permissions: permissionsFor(user.role) };
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user) throw ApiError.unauthorized();
  if (!(await user.verifyPassword(currentPassword))) {
    throw ApiError.badRequest('Mật khẩu hiện tại không đúng', [{ path: 'body.currentPassword', message: 'Không đúng' }]);
  }
  user.passwordHash = await hashPassword(newPassword);
  await user.save();
  await revokeAllRefreshTokens(user.id);
}
