import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendData, sendList } from '../../utils/response';
import * as service from './classes.service';
import type { CreateClassInput, ListClassesQuery, UpdateClassInput } from './classes.validation';

const idOf = (req: Request) => validated<{ id: string }>(req, 'params').id;

export async function list(req: Request, res: Response): Promise<void> {
  sendList(res, await service.listClasses(req.user!, req.scope, validated<ListClassesQuery>(req, 'query')));
}

export async function get(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getClass(req.user!, req.scope, idOf(req)));
}

export async function create(req: Request, res: Response): Promise<void> {
  sendData(res, await service.createClass(req.user!, req.scope, validated<CreateClassInput>(req, 'body')), 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  sendData(res, await service.updateClass(req.user!, req.scope, idOf(req), validated<UpdateClassInput>(req, 'body')));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.removeClass(req.user!, req.scope, idOf(req));
  res.status(204).end();
}
