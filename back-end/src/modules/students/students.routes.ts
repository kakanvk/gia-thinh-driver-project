import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../shared/zod';
import * as controller from './students.controller';
import { assignClassSchema, createStudentSchema, listStudentsQuerySchema, updateStudentSchema } from './students.validation';

export function createStudentsRouter(): Router {
  const router = Router();
  const can = (permission: string) => authorize(permission, { branchScoped: true });
  router.use(authenticate);
  router.get('/', can('student.read'), validate({ query: listStudentsQuerySchema }), controller.list);
  router.post('/', can('student.create'), validate({ body: createStudentSchema }), controller.create);
  router.get('/:id', can('student.read'), validate({ params: idParamsSchema }), controller.get);
  router.patch(
    '/:id',
    can('student.update'),
    validate({ params: idParamsSchema, body: updateStudentSchema }),
    controller.update,
  );
  router.patch(
    '/:id/class',
    can('student.update'),
    validate({ params: idParamsSchema, body: assignClassSchema }),
    controller.assignClass,
  );
  router.delete('/:id', can('student.delete'), validate({ params: idParamsSchema }), controller.remove);
  return router;
}
