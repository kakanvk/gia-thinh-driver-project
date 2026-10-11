import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize, authorizeAny } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../shared/zod';
import * as controller from './users.controller';
import { options, USER_OPTIONS_PERMISSIONS, userOptionsQuerySchema } from './users.options';
import { createUserSchema, listUsersQuerySchema, updateUserSchema, userStatusSchema } from './users.validation';

export function createUsersRouter(): Router {
  const router = Router();
  // Khai báo trước router.use(authorize('user.manage')) để tư vấn viên/quản lý gọi được.
  // Handler kiểm tiếp quyền theo `role` (role=instructor cần instructor.create/update).
  router.get(
    '/options',
    authenticate,
    authorizeAny([...USER_OPTIONS_PERMISSIONS.staff, ...USER_OPTIONS_PERMISSIONS.instructor], { branchScoped: true }),
    validate({ query: userOptionsQuerySchema }),
    options,
  );
  router.use(authenticate, authorize('user.manage'));
  router.get('/', validate({ query: listUsersQuerySchema }), controller.list);
  router.post('/', validate({ body: createUserSchema }), controller.create);
  router.get('/:id', validate({ params: idParamsSchema }), controller.get);
  router.patch('/:id', validate({ params: idParamsSchema, body: updateUserSchema }), controller.update);
  router.patch('/:id/status', validate({ params: idParamsSchema, body: userStatusSchema }), controller.setStatus);
  router.post('/:id/reset-password', validate({ params: idParamsSchema }), controller.resetPassword);
  router.delete('/:id', validate({ params: idParamsSchema }), controller.remove);
  return router;
}
