import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { uploadImage } from '../../middlewares/upload.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as controller from './media.controller';
import { listMediaQuerySchema, uploadBodySchema } from './media.service';

export function createMediaRouter(): Router {
  const router = Router();
  router.use(authenticate);
  router.post('/', authorize('media.upload'), uploadImage, validate({ body: uploadBodySchema }), controller.upload);
  router.get('/', authorize('media.read'), validate({ query: listMediaQuerySchema }), controller.list);
  return router;
}
