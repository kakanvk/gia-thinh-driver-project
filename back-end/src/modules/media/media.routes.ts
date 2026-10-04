import { Router } from 'express';
import { env } from '../../config/env';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { uploadImage } from '../../middlewares/upload.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as controller from './media.controller';
import { directUpload } from './media.direct';
import { listMediaQuerySchema, uploadBodySchema } from './media.service';

export function createMediaRouter(): Router {
  const router = Router();
  // Upload thẳng cho driver local (test/offline) — đặt trước authenticate vì PUT theo URL ký sẵn không kèm Bearer
  if (env.STORAGE_DRIVER === 'local') router.put('/direct/:token', directUpload);
  router.use(authenticate);
  router.post('/', authorize('media.upload'), uploadImage, validate({ body: uploadBodySchema }), controller.upload);
  router.get('/', authorize('media.read'), validate({ query: listMediaQuerySchema }), controller.list);
  return router;
}
