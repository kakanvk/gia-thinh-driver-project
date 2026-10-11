import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../shared/zod';
import * as controller from './exams.controller';
import {
  addCandidatesSchema,
  candidateParamsSchema,
  candidateResultSchema,
  createExamSchema,
  listExamsQuerySchema,
  updateExamSchema,
} from './exams.validation';

export function createExamsRouter(): Router {
  const router = Router();
  const can = (permission: string) => authorize(permission, { branchScoped: true });
  router.use(authenticate);
  router.get('/', can('exam.read'), validate({ query: listExamsQuerySchema }), controller.list);
  router.post('/', can('exam.create'), validate({ body: createExamSchema }), controller.create);
  router.get('/:id', can('exam.read'), validate({ params: idParamsSchema }), controller.get);
  router.patch('/:id', can('exam.update'), validate({ params: idParamsSchema, body: updateExamSchema }), controller.update);
  router.delete('/:id', can('exam.delete'), validate({ params: idParamsSchema }), controller.remove);
  router.get('/:id/candidates', can('exam.read'), validate({ params: idParamsSchema }), controller.listCandidates);
  router.post(
    '/:id/candidates',
    can('exam.update'),
    validate({ params: idParamsSchema, body: addCandidatesSchema }),
    controller.addCandidates,
  );
  router.patch(
    '/:id/candidates/:candidateId',
    can('exam.update'),
    validate({ params: candidateParamsSchema, body: candidateResultSchema }),
    controller.setResult,
  );
  router.delete(
    '/:id/candidates/:candidateId',
    can('exam.update'),
    validate({ params: candidateParamsSchema }),
    controller.removeCandidate,
  );
  return router;
}
