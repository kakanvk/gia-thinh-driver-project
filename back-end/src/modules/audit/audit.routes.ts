import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as controller from './audit.controller';
import { listAuditQuerySchema } from './audit.service';

export function createAuditRouter(): Router {
  const router = Router();
  router.get('/', authenticate, authorize('audit.read'), validate({ query: listAuditQuerySchema }), controller.list);
  return router;
}
