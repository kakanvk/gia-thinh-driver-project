import { Router } from 'express';
import * as branches from '../branches/branches.controller';
import * as settings from '../settings/settings.controller';

export function createPublicRouter(): Router {
  const router = Router();
  router.get('/branches', branches.listPublic);
  router.get('/settings', settings.getPublic);
  return router;
}
