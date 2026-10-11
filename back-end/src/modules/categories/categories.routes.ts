import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../shared/zod';
import * as controller from './categories.controller';
import { createCategorySchema, reorderCategoriesSchema, updateCategorySchema } from './categories.validation';

export function createCategoriesRouter(): Router {
  const router = Router();
  router.use(authenticate, authorize('category.manage'));
  router.get('/', controller.list);
  router.post('/', validate({ body: createCategorySchema }), controller.create);
  router.patch('/reorder', validate({ body: reorderCategoriesSchema }), controller.reorder);
  router.get('/:id', validate({ params: idParamsSchema }), controller.get);
  router.patch('/:id', validate({ params: idParamsSchema, body: updateCategorySchema }), controller.update);
  router.delete('/:id', validate({ params: idParamsSchema }), controller.remove);
  return router;
}
