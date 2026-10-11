import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../shared/zod';
import { convert, convertLeadSchema } from './leads.convert';
import { exportCsv } from './leads.export';
import * as controller from './leads.controller';
import {
  activitiesQuerySchema,
  assignLeadSchema,
  createActivitySchema,
  createLeadSchema,
  leadFilterQuerySchema,
  leadStatusSchema,
  listLeadsQuerySchema,
  updateLeadSchema,
} from './leads.validation';

export function createLeadsRouter(): Router {
  const router = Router();
  const can = (permission: string) => authorize(permission, { branchScoped: true });
  const byId = validate({ params: idParamsSchema });
  router.use(authenticate);
  router.get('/', can('lead.read'), validate({ query: listLeadsQuerySchema }), controller.list);
  router.post('/', can('lead.create'), validate({ body: createLeadSchema }), controller.create);
  router.get('/export', can('lead.export'), validate({ query: leadFilterQuerySchema }), exportCsv);
  router.get('/:id', can('lead.read'), byId, controller.get);
  router.patch('/:id', can('lead.update'), validate({ params: idParamsSchema, body: updateLeadSchema }), controller.update);
  router.delete('/:id', can('lead.delete'), byId, controller.remove);
  router.patch(
    '/:id/status',
    can('lead.update'),
    validate({ params: idParamsSchema, body: leadStatusSchema }),
    controller.changeStatus,
  );
  router.patch(
    '/:id/assign',
    can('lead.update'),
    validate({ params: idParamsSchema, body: assignLeadSchema }),
    controller.assign,
  );
  router.get(
    '/:id/activities',
    can('lead.read'),
    validate({ params: idParamsSchema, query: activitiesQuerySchema }),
    controller.listActivities,
  );
  router.post(
    '/:id/activities',
    can('lead.update'),
    validate({ params: idParamsSchema, body: createActivitySchema }),
    controller.addActivity,
  );
  router.post(
    '/:id/convert',
    authorize('student.create', { branchScoped: true }),
    validate({ params: idParamsSchema, body: convertLeadSchema }),
    convert,
  );
  return router;
}
