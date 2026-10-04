import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as controller from './dashboard.controller';
import {
  dashboardScopeQuerySchema,
  monthQuerySchema,
  monthsQuerySchema,
  registrationsQuerySchema,
} from './dashboard.validation';

export function createDashboardRouter(): Router {
  const router = Router();
  router.use(authenticate, authorize('dashboard.read', { branchScoped: true }));
  router.get('/summary', validate({ query: dashboardScopeQuerySchema }), controller.summary);
  router.get('/registrations', validate({ query: registrationsQuerySchema }), controller.registrations);
  router.get('/sources', validate({ query: monthQuerySchema }), controller.sources);
  router.get('/funnel', validate({ query: monthQuerySchema }), controller.funnel);
  router.get('/revenue', validate({ query: monthsQuerySchema }), controller.revenue);
  router.get('/pass-rate', validate({ query: monthsQuerySchema }), controller.passRate);
  return router;
}
