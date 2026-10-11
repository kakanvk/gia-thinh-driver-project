import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendData, sendList } from '../../utils/response';
import * as service from './courses.service';
import type { CreateCourseInput, ListCoursesQuery, UpdateCourseInput } from './courses.validation';

type IdParams = { id: string };

export async function list(req: Request, res: Response): Promise<void> {
  sendList(res, await service.listCourses(validated<ListCoursesQuery>(req, 'query')));
}

export async function get(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getCourse(validated<IdParams>(req, 'params').id));
}

export async function create(req: Request, res: Response): Promise<void> {
  sendData(res, await service.createCourse(req.user!, validated<CreateCourseInput>(req, 'body')), 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = validated<IdParams>(req, 'params');
  sendData(res, await service.updateCourse(req.user!, id, validated<UpdateCourseInput>(req, 'body')));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.removeCourse(req.user!, validated<IdParams>(req, 'params').id);
  res.status(204).end();
}

export async function reorder(req: Request, res: Response): Promise<void> {
  await service.reorderCourses(req.user!, validated<{ ids: string[] }>(req, 'body').ids);
  sendData(res, { ok: true });
}
