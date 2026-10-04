import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { createRateLimiter } from '../../middlewares/rateLimit.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as controller from './auth.controller';
import { changePasswordSchema, loginSchema, updateMeSchema } from './auth.validation';

export function createAuthRouter(): Router {
  const router = Router();
  const loginLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    skipSuccessfulRequests: true,
    message: 'Bạn đã thử đăng nhập quá nhiều lần, vui lòng thử lại sau 15 phút',
  });

  router.post('/login', loginLimiter, validate({ body: loginSchema }), controller.login);
  router.post('/refresh', controller.refresh);
  router.post('/logout', controller.logout);
  router.get('/me', authenticate, controller.me);
  router.patch('/me', authenticate, validate({ body: updateMeSchema }), controller.updateMe);
  router.post('/change-password', authenticate, validate({ body: changePasswordSchema }), controller.changePassword);
  return router;
}
