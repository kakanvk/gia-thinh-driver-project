import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../shared/zod';
import * as controller from './vehicles.controller';
import { alertsQuerySchema, createVehicleSchema, listVehiclesQuerySchema, updateVehicleSchema } from './vehicles.validation';

export function createVehiclesRouter(): Router {
  const router = Router();
  const can = (permission: string) => authorize(permission, { branchScoped: true });
  router.use(authenticate);
  router.get('/', can('vehicle.read'), validate({ query: listVehiclesQuerySchema }), controller.list);
  router.get('/alerts', can('vehicle.read'), validate({ query: alertsQuerySchema }), controller.alerts);
  router.post('/', can('vehicle.create'), validate({ body: createVehicleSchema }), controller.create);
  router.get('/:id', can('vehicle.read'), validate({ params: idParamsSchema }), controller.get);
  router.patch(
    '/:id',
    can('vehicle.update'),
    validate({ params: idParamsSchema, body: updateVehicleSchema }),
    controller.update,
  );
  router.delete('/:id', can('vehicle.delete'), validate({ params: idParamsSchema }), controller.remove);
  return router;
}
