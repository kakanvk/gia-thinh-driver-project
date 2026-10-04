import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../shared/zod';
import * as controller from './courses.controller';
import {
  createCourseSchema,
  listCoursesQuerySchema,
  reorderCoursesSchema,
  updateCourseSchema,
} from './courses.validation';

export function createCoursesRouter(): Router {
  const router = Router();
  router.use(authenticate);
  router.get('/', authorize('course.read'), validate({ query: listCoursesQuerySchema }), controller.list);
  router.post('/', authorize('course.manage'), validate({ body: createCourseSchema }), controller.create);
  router.patch('/reorder', authorize('course.manage'), validate({ body: reorderCoursesSchema }), controller.reorder);
  router.get('/:id', authorize('course.read'), validate({ params: idParamsSchema }), controller.get);
  router.patch(
    '/:id',
    authorize('course.manage'),
    validate({ params: idParamsSchema, body: updateCourseSchema }),
    controller.update,
  );
  router.delete('/:id', authorize('course.manage'), validate({ params: idParamsSchema }), controller.remove);
  return router;
}
