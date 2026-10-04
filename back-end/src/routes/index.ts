import { Router } from 'express';
import { createAuditRouter } from '../modules/audit/audit.routes';
import { createAuthRouter } from '../modules/auth/auth.routes';
import { createBranchesRouter } from '../modules/branches/branches.routes';
import { createMediaRouter } from '../modules/media/media.routes';
import { createPublicRouter } from '../modules/public/public.routes';
import { createSettingsRouter } from '../modules/settings/settings.routes';
import { createUsersRouter } from '../modules/users/users.routes';
import { sendData } from '../utils/response';

export function createApiRouter(): Router {
  const router = Router();
  router.get('/health', (_req, res) => sendData(res, { status: 'ok', time: new Date() }));
  router.use('/auth', createAuthRouter());
  router.use('/audit', createAuditRouter());
  router.use('/branches', createBranchesRouter());
  router.use('/media', createMediaRouter());
  router.use('/settings', createSettingsRouter());
  router.use('/users', createUsersRouter());
  router.use('/public', createPublicRouter());
  return router;
}
