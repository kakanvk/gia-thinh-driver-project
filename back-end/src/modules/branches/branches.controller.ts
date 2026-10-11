import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendData, sendList } from '../../utils/response';
import * as service from './branches.service';
import type { CreateBranchInput, ListBranchesQuery, UpdateBranchInput } from './branches.validation';

type IdParams = { id: string };

export async function list(req: Request, res: Response): Promise<void> {
  sendList(res, await service.listBranches(validated<ListBranchesQuery>(req, 'query')));
}

export async function get(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getBranch(validated<IdParams>(req, 'params').id));
}

export async function create(req: Request, res: Response): Promise<void> {
  sendData(res, await service.createBranch(req.user!, validated<CreateBranchInput>(req, 'body')), 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = validated<IdParams>(req, 'params');
  sendData(res, await service.updateBranch(req.user!, id, validated<UpdateBranchInput>(req, 'body')));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.removeBranch(req.user!, validated<IdParams>(req, 'params').id);
  res.status(204).end();
}

export async function listPublic(_req: Request, res: Response): Promise<void> {
  sendData(res, await service.listPublicBranches());
}
