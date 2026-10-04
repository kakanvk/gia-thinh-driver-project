import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendData, sendList } from '../../utils/response';
import * as service from './vehicles.service';
import type { CreateVehicleInput, ListVehiclesQuery, UpdateVehicleInput } from './vehicles.validation';

const idOf = (req: Request) => validated<{ id: string }>(req, 'params').id;

export async function list(req: Request, res: Response): Promise<void> {
  sendList(res, await service.listVehicles(req.scope, validated<ListVehiclesQuery>(req, 'query')));
}

export async function alerts(req: Request, res: Response): Promise<void> {
  sendData(res, await service.listVehicleAlerts(req.scope, validated<{ days: number }>(req, 'query').days));
}

export async function get(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getVehicle(req.scope, idOf(req)));
}

export async function create(req: Request, res: Response): Promise<void> {
  sendData(res, await service.createVehicle(req.user!, req.scope, validated<CreateVehicleInput>(req, 'body')), 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  sendData(res, await service.updateVehicle(req.user!, req.scope, idOf(req), validated<UpdateVehicleInput>(req, 'body')));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.removeVehicle(req.user!, req.scope, idOf(req));
  res.status(204).end();
}
