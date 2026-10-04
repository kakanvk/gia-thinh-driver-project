import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendData, sendList } from '../../utils/response';
import * as service from './instructors.service';
import type { CreateInstructorInput, ListInstructorsQuery, UpdateInstructorInput } from './instructors.validation';

const idOf = (req: Request) => validated<{ id: string }>(req, 'params').id;

export async function list(req: Request, res: Response): Promise<void> {
  sendList(res, await service.listInstructors(req.scope, validated<ListInstructorsQuery>(req, 'query')));
}

export async function get(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getInstructor(req.scope, idOf(req)));
}

export async function stats(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getInstructorStats(req.scope, idOf(req)));
}

export async function create(req: Request, res: Response): Promise<void> {
  sendData(res, await service.createInstructor(req.user!, req.scope, validated<CreateInstructorInput>(req, 'body')), 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  sendData(
    res,
    await service.updateInstructor(req.user!, req.scope, idOf(req), validated<UpdateInstructorInput>(req, 'body')),
  );
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.removeInstructor(req.user!, req.scope, idOf(req));
  res.status(204).end();
}
