import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../shared/zod';
import { listByClass } from '../students/students.controller';
import * as controller from './classes.controller';
import { createClassSchema, listClassesQuerySchema, updateClassSchema } from './classes.validation';

export function createClassesRouter(): Router {
  const router = Router();
  const can = (permission: string) => authorize(permission, { branchScoped: true });
  router.use(authenticate);
  router.get('/', can('class.read'), validate({ query: listClassesQuerySchema }), controller.list);
  router.post('/', can('class.create'), validate({ body: createClassSchema }), controller.create);
  router.get('/:id', can('class.read'), validate({ params: idParamsSchema }), controller.get);
  router.patch(
    '/:id',
    can('class.update'),
    validate({ params: idParamsSchema, body: updateClassSchema }),
    controller.update,
  );
  router.get('/:id/students', can('student.read'), validate({ params: idParamsSchema }), listByClass);
  router.delete('/:id', can('class.delete'), validate({ params: idParamsSchema }), controller.remove);
  return router;
}
