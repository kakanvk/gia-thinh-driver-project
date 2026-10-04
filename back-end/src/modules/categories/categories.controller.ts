import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendData } from '../../utils/response';
import * as service from './categories.service';
import type { CreateCategoryInput, UpdateCategoryInput } from './categories.validation';

type IdParams = { id: string };

export async function list(_req: Request, res: Response): Promise<void> {
  sendData(res, await service.listCategories());
}

export async function get(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getCategory(validated<IdParams>(req, 'params').id));
}

export async function create(req: Request, res: Response): Promise<void> {
  sendData(res, await service.createCategory(req.user!, validated<CreateCategoryInput>(req, 'body')), 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = validated<IdParams>(req, 'params');
  sendData(res, await service.updateCategory(req.user!, id, validated<UpdateCategoryInput>(req, 'body')));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.removeCategory(req.user!, validated<IdParams>(req, 'params').id);
  res.status(204).end();
}

export async function reorder(req: Request, res: Response): Promise<void> {
  await service.reorderCategories(req.user!, validated<{ ids: string[] }>(req, 'body').ids);
  sendData(res, { ok: true });
}
