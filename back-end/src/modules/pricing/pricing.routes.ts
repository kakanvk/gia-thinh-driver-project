import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../shared/zod';
import * as controller from './pricing.controller';
import {
  branchCourseParamsSchema,
  branchParamsSchema,
  createPriceItemSchema,
  listPriceItemsQuerySchema,
  setOverrideSchema,
  updatePriceItemSchema,
} from './pricing.validation';

export function createPricingRouter(): Router {
  const router = Router();
  const manage = authorize('pricing.manage', { branchScoped: true });
  router.use(authenticate);
  router.get('/branches/:branchId', authorize('course.read'), validate({ params: branchParamsSchema }), controller.getBranch);
  router.put(
    '/branches/:branchId/courses/:courseId',
    manage,
    validate({ params: branchCourseParamsSchema, body: setOverrideSchema }),
    controller.setOverride,
  );
  router.delete(
    '/branches/:branchId/courses/:courseId',
    manage,
    validate({ params: branchCourseParamsSchema }),
    controller.removeOverride,
  );
  router.get('/items', authorize('course.read'), validate({ query: listPriceItemsQuerySchema }), controller.listItems);
  router.post('/items', manage, validate({ body: createPriceItemSchema }), controller.createItem);
  router.patch('/items/:id', manage, validate({ params: idParamsSchema, body: updatePriceItemSchema }), controller.updateItem);
  router.delete('/items/:id', manage, validate({ params: idParamsSchema }), controller.removeItem);
  return router;
}
