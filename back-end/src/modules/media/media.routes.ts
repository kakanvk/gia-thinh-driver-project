import { Router } from 'express';
import { env } from '../../config/env';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { uploadImage } from '../../middlewares/upload.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../shared/zod';
import * as controller from './media.controller';
import { directUpload } from './media.direct';
import {
  completeVideoBodySchema,
  listMediaQuerySchema,
  updateMediaBodySchema,
  uploadBodySchema,
  videoUploadBodySchema,
} from './media.service';

export function createMediaRouter(): Router {
  const router = Router();
  // Upload thẳng cho driver local (test/offline) — đặt trước authenticate vì PUT theo URL ký sẵn không kèm Bearer
  if (env.STORAGE_DRIVER === 'local') router.put('/direct/:token', directUpload);
  router.use(authenticate);
  const canUpload = authorize('media.upload');
  router.post('/', canUpload, uploadImage, validate({ body: uploadBodySchema }), controller.upload);
  router.get('/', authorize('media.read'), validate({ query: listMediaQuerySchema }), controller.list);
  router.post('/video-uploads', canUpload, validate({ body: videoUploadBodySchema }), controller.createVideoUpload);
  router.post(
    '/video-uploads/complete',
    canUpload,
    validate({ body: completeVideoBodySchema }),
    controller.completeVideoUpload,
  );
  router.patch('/:id', canUpload, validate({ params: idParamsSchema, body: updateMediaBodySchema }), controller.update);
  router.delete('/:id', canUpload, validate({ params: idParamsSchema }), controller.remove);
  return router;
}
