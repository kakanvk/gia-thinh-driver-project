import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendData, sendList } from '../../utils/response';
import * as service from './users.service';
import type { CreateUserInput, ListUsersQuery, UpdateUserInput, UserStatusInput } from './users.validation';

type IdParams = { id: string };

export async function list(req: Request, res: Response): Promise<void> {
  sendList(res, await service.listUsers(req.user!, validated<ListUsersQuery>(req, 'query')));
}

export async function get(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getUser(req.user!, validated<IdParams>(req, 'params').id));
}

export async function create(req: Request, res: Response): Promise<void> {
  sendData(res, await service.createUser(req.user!, validated<CreateUserInput>(req, 'body')), 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = validated<IdParams>(req, 'params');
  sendData(res, await service.updateUser(req.user!, id, validated<UpdateUserInput>(req, 'body')));
}

export async function setStatus(req: Request, res: Response): Promise<void> {
  const { id } = validated<IdParams>(req, 'params');
  sendData(res, await service.setUserStatus(req.user!, id, validated<UserStatusInput>(req, 'body').status));
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  sendData(res, await service.resetUserPassword(req.user!, validated<IdParams>(req, 'params').id));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.removeUser(req.user!, validated<IdParams>(req, 'params').id);
  res.status(204).end();
}
