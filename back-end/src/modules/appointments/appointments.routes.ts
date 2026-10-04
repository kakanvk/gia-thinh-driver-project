import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../shared/zod';
import * as controller from './appointments.controller';
import {
  appointmentStatusSchema,
  calendarQuerySchema,
  createAppointmentSchema,
  listAppointmentsQuerySchema,
  updateAppointmentSchema,
} from './appointments.validation';

export function createAppointmentsRouter(): Router {
  const router = Router();
  const can = (permission: string) => authorize(permission, { branchScoped: true });
  router.use(authenticate);
  router.get('/', can('appointment.read'), validate({ query: listAppointmentsQuerySchema }), controller.list);
  router.get('/calendar', can('appointment.read'), validate({ query: calendarQuerySchema }), controller.calendar);
  router.post('/', can('appointment.create'), validate({ body: createAppointmentSchema }), controller.create);
  router.get('/:id', can('appointment.read'), validate({ params: idParamsSchema }), controller.get);
  router.patch(
    '/:id',
    can('appointment.update'),
    validate({ params: idParamsSchema, body: updateAppointmentSchema }),
    controller.update,
  );
  router.patch(
    '/:id/status',
    can('appointment.update'),
    validate({ params: idParamsSchema, body: appointmentStatusSchema }),
    controller.changeStatus,
  );
  router.delete('/:id', can('appointment.delete'), validate({ params: idParamsSchema }), controller.remove);
  return router;
}
