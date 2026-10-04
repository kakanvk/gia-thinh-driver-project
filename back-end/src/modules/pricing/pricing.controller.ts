import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendData, sendList } from '../../utils/response';
import * as service from './pricing.service';
import type {
  CreatePriceItemInput,
  ListPriceItemsQuery,
  SetOverrideInput,
  UpdatePriceItemInput,
} from './pricing.validation';

type BranchParams = { branchId: string };
type BranchCourseParams = { branchId: string; courseId: string };
type IdParams = { id: string };

export async function getBranch(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getBranchPricing(validated<BranchParams>(req, 'params').branchId));
}

export async function setOverride(req: Request, res: Response): Promise<void> {
  const { branchId, courseId } = validated<BranchCourseParams>(req, 'params');
  sendData(res, await service.setOverride(req.user!, req.scope, branchId, courseId, validated<SetOverrideInput>(req, 'body')));
}

export async function removeOverride(req: Request, res: Response): Promise<void> {
  const { branchId, courseId } = validated<BranchCourseParams>(req, 'params');
  await service.removeOverride(req.user!, req.scope, branchId, courseId);
  res.status(204).end();
}

export async function listItems(req: Request, res: Response): Promise<void> {
  sendList(res, await service.listPriceItems(validated<ListPriceItemsQuery>(req, 'query')));
}

export async function createItem(req: Request, res: Response): Promise<void> {
  sendData(res, await service.createPriceItem(req.user!, req.scope, validated<CreatePriceItemInput>(req, 'body')), 201);
}

export async function updateItem(req: Request, res: Response): Promise<void> {
  const { id } = validated<IdParams>(req, 'params');
  sendData(res, await service.updatePriceItem(req.user!, req.scope, id, validated<UpdatePriceItemInput>(req, 'body')));
}

export async function removeItem(req: Request, res: Response): Promise<void> {
  await service.removePriceItem(req.user!, req.scope, validated<IdParams>(req, 'params').id);
  res.status(204).end();
}

export async function getPublic(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getPublicPricing(validated<{ branch?: string }>(req, 'query').branch));
}
