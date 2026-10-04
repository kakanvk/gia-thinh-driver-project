import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as controller from './settings.controller';
import { updateSettingsSchema } from './settings.schema';

export function createSettingsRouter(): Router {
  const router = Router();
  router.use(authenticate);
  router.get('/', authorize('setting.read'), controller.get);
  router.patch('/', authorize('setting.manage'), validate({ body: updateSettingsSchema }), controller.update);
  return router;
}
