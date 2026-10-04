import type { RequestHandler } from 'express';
import { User } from '../modules/users/user.model';
import { ApiError } from '../utils/ApiError';
import { verifyAccessToken, type AccessPayload } from '../utils/jwt';

export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(ApiError.unauthorized());

  let payload: AccessPayload;
  try {
    payload = verifyAccessToken(header.slice('Bearer '.length));
  } catch {
    return next(ApiError.unauthorized('Phiên đăng nhập đã hết hạn'));
  }

  const user = await User.findById(payload.sub).select('role branchIds status');
  if (!user || user.status !== 'active') return next(ApiError.unauthorized('Tài khoản không còn hiệu lực'));

  req.user = { id: user.id, role: user.role, branchIds: user.branchIds.map(String) };
  next();
};
