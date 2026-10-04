import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../shared/zod';
import * as controller from './branches.controller';
import { createBranchSchema, listBranchesQuerySchema, updateBranchSchema } from './branches.validation';

export function createBranchesRouter(): Router {
  const router = Router();
  router.use(authenticate);
  router.get('/', authorize('branch.read'), validate({ query: listBranchesQuerySchema }), controller.list);
  router.get('/:id', authorize('branch.read'), validate({ params: idParamsSchema }), controller.get);
  router.post('/', authorize('branch.manage'), validate({ body: createBranchSchema }), controller.create);
  router.patch(
    '/:id',
    authorize('branch.manage'),
    validate({ params: idParamsSchema, body: updateBranchSchema }),
    controller.update,
  );
  router.delete('/:id', authorize('branch.manage'), validate({ params: idParamsSchema }), controller.remove);
  return router;
}
