import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendData, sendList } from '../../utils/response';
import * as service from './appointments.service';
import type {
  AppointmentStatusInput,
  CalendarQuery,
  CreateAppointmentInput,
  ListAppointmentsQuery,
  UpdateAppointmentInput,
} from './appointments.validation';

const idOf = (req: Request) => validated<{ id: string }>(req, 'params').id;

export async function list(req: Request, res: Response): Promise<void> {
  sendList(res, await service.listAppointments(req.scope, validated<ListAppointmentsQuery>(req, 'query')));
}

export async function calendar(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getCalendar(req.scope, validated<CalendarQuery>(req, 'query')));
}

export async function get(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getAppointment(req.scope, idOf(req)));
}

export async function create(req: Request, res: Response): Promise<void> {
  sendData(res, await service.createAppointment(req.user!, req.scope, validated<CreateAppointmentInput>(req, 'body')), 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  sendData(
    res,
    await service.updateAppointment(req.user!, req.scope, idOf(req), validated<UpdateAppointmentInput>(req, 'body')),
  );
}

export async function changeStatus(req: Request, res: Response): Promise<void> {
  sendData(
    res,
    await service.changeAppointmentStatus(req.user!, req.scope, idOf(req), validated<AppointmentStatusInput>(req, 'body')),
  );
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.removeAppointment(req.user!, req.scope, idOf(req));
  res.status(204).end();
}
