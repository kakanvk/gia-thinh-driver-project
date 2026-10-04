import { Router } from 'express';
import { createAppointmentsRouter } from '../modules/appointments/appointments.routes';
import { createAuditRouter } from '../modules/audit/audit.routes';
import { createAuthRouter } from '../modules/auth/auth.routes';
import { createBranchesRouter } from '../modules/branches/branches.routes';
import { createCategoriesRouter } from '../modules/categories/categories.routes';
import { createCoursesRouter } from '../modules/courses/courses.routes';
import { createLeadsRouter } from '../modules/leads/leads.routes';
import { createMediaRouter } from '../modules/media/media.routes';
import { createPostsRouter } from '../modules/posts/posts.routes';
import { createPricingRouter } from '../modules/pricing/pricing.routes';
import { createPublicRouter } from '../modules/public/public.routes';
import { createSettingsRouter } from '../modules/settings/settings.routes';
import { createUsersRouter } from '../modules/users/users.routes';
import { sendData } from '../utils/response';

export function createApiRouter(): Router {
  const router = Router();
  router.get('/health', (_req, res) => sendData(res, { status: 'ok', time: new Date() }));
  router.use('/auth', createAuthRouter());
  router.use('/appointments', createAppointmentsRouter());
  router.use('/audit', createAuditRouter());
  router.use('/branches', createBranchesRouter());
  router.use('/categories', createCategoriesRouter());
  router.use('/courses', createCoursesRouter());
  router.use('/leads', createLeadsRouter());
  router.use('/media', createMediaRouter());
  router.use('/posts', createPostsRouter());
  router.use('/pricing', createPricingRouter());
  router.use('/settings', createSettingsRouter());
  router.use('/users', createUsersRouter());
  router.use('/public', createPublicRouter());
  return router;
}
