import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../shared/zod';
import * as controller from './gallery.controller';
import {
  createGalleryItemSchema,
  listGalleryQuerySchema,
  reorderGallerySchema,
  updateGalleryItemSchema,
} from './gallery.validation';

export function createGalleryRouter(): Router {
  const router = Router();
  router.use(authenticate, authorize('gallery.manage'));
  router.get('/', validate({ query: listGalleryQuerySchema }), controller.list);
  router.post('/', validate({ body: createGalleryItemSchema }), controller.create);
  router.patch('/reorder', validate({ body: reorderGallerySchema }), controller.reorder);
  router.patch('/:id', validate({ params: idParamsSchema, body: updateGalleryItemSchema }), controller.update);
  router.delete('/:id', validate({ params: idParamsSchema }), controller.remove);
  return router;
}
