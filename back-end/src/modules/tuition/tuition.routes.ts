import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../shared/zod';
import * as controller from './tuition.controller';
import {
  addPaymentSchema,
  backfillSchema,
  listAccountsQuerySchema,
  paymentParamsSchema,
  updateAccountSchema,
  voidPaymentSchema,
} from './tuition.validation';

export function createTuitionRouter(): Router {
  const router = Router();
  const can = (permission: string) => authorize(permission, { branchScoped: true });
  router.use(authenticate);
  router.get('/', can('tuition.read'), validate({ query: listAccountsQuerySchema }), controller.list);
  router.post('/', can('tuition.create'), validate({ body: backfillSchema }), controller.backfill);
  router.get('/:id', can('tuition.read'), validate({ params: idParamsSchema }), controller.get);
  router.patch(
    '/:id',
    can('tuition.update'),
    validate({ params: idParamsSchema, body: updateAccountSchema }),
    controller.update,
  );
  router.post(
    '/:id/payments',
    can('tuition.collect'),
    validate({ params: idParamsSchema, body: addPaymentSchema }),
    controller.addPayment,
  );
  router.delete(
    '/:id/payments/:paymentId',
    can('payment.void'),
    validate({ params: paymentParamsSchema, body: voidPaymentSchema }),
    controller.voidPayment,
  );
  return router;
}
