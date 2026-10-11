import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../shared/zod';
import * as controller from './posts.controller';
import { createPostSchema, listPostsQuerySchema, publishPostSchema, updatePostSchema } from './posts.validation';

export function createPostsRouter(): Router {
  const router = Router();
  const byId = validate({ params: idParamsSchema });
  router.use(authenticate, authorize('post.manage'));
  router.get('/', validate({ query: listPostsQuerySchema }), controller.list);
  router.post('/', validate({ body: createPostSchema }), controller.create);
  router.get('/:id', byId, controller.get);
  router.patch('/:id', validate({ params: idParamsSchema, body: updatePostSchema }), controller.update);
  router.delete('/:id', byId, controller.remove);
  router.post('/:id/submit', byId, controller.transition('submit'));
  router.post(
    '/:id/publish',
    validate({ params: idParamsSchema, body: publishPostSchema }),
    controller.transition('publish'),
  );
  router.post('/:id/unpublish', byId, controller.transition('unpublish'));
  router.post('/:id/archive', byId, controller.transition('archive'));
  router.post('/:id/restore', byId, controller.transition('restore'));
  router.post('/:id/duplicate', byId, controller.duplicate);
  return router;
}
