import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../shared/zod';
import * as controller from './instructors.controller';
import { createInstructorSchema, listInstructorsQuerySchema, updateInstructorSchema } from './instructors.validation';

export function createInstructorsRouter(): Router {
  const router = Router();
  const can = (permission: string) => authorize(permission, { branchScoped: true });
  router.use(authenticate);
  router.get('/', can('instructor.read'), validate({ query: listInstructorsQuerySchema }), controller.list);
  router.post('/', can('instructor.create'), validate({ body: createInstructorSchema }), controller.create);
  router.get('/:id', can('instructor.read'), validate({ params: idParamsSchema }), controller.get);
  router.get('/:id/stats', can('instructor.read'), validate({ params: idParamsSchema }), controller.stats);
  router.patch(
    '/:id',
    can('instructor.update'),
    validate({ params: idParamsSchema, body: updateInstructorSchema }),
    controller.update,
  );
  router.delete('/:id', can('instructor.delete'), validate({ params: idParamsSchema }), controller.remove);
  return router;
}
