import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import type { ListQuery } from '../../shared/mongoose/paginate';
import { sendData, sendList } from '../../utils/response';
import * as service from './leads.service';
import type {
  CreateActivityInput,
  CreateLeadInput,
  LeadStatusInput,
  ListLeadsQuery,
  UpdateLeadInput,
} from './leads.validation';

type IdParams = { id: string };
const idOf = (req: Request) => validated<IdParams>(req, 'params').id;

export async function list(req: Request, res: Response): Promise<void> {
  sendList(res, await service.listLeads(req.scope, validated<ListLeadsQuery>(req, 'query')));
}

export async function get(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getLead(req.scope, idOf(req)));
}

export async function create(req: Request, res: Response): Promise<void> {
  sendData(res, await service.createLead(req.user!, req.scope, validated<CreateLeadInput>(req, 'body')), 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  sendData(res, await service.updateLead(req.user!, req.scope, idOf(req), validated<UpdateLeadInput>(req, 'body')));
}

export async function changeStatus(req: Request, res: Response): Promise<void> {
  sendData(res, await service.changeLeadStatus(req.user!, req.scope, idOf(req), validated<LeadStatusInput>(req, 'body')));
}

export async function assign(req: Request, res: Response): Promise<void> {
  const { assigneeId } = validated<{ assigneeId: string | null }>(req, 'body');
  sendData(res, await service.assignLead(req.user!, req.scope, idOf(req), assigneeId));
}

export async function listActivities(req: Request, res: Response): Promise<void> {
  sendList(
    res,
    await service.listLeadActivities(req.scope, idOf(req), validated<Pick<ListQuery, 'page' | 'limit'>>(req, 'query')),
  );
}

export async function addActivity(req: Request, res: Response): Promise<void> {
  sendData(
    res,
    await service.addManualActivity(req.user!, req.scope, idOf(req), validated<CreateActivityInput>(req, 'body')),
    201,
  );
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.removeLead(req.user!, req.scope, idOf(req));
  res.status(204).end();
}
