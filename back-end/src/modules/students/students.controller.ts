import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendData, sendList } from '../../utils/response';
import * as service from './students.service';
import type { CreateStudentInput, ListStudentsQuery, UpdateStudentInput } from './students.validation';

const idOf = (req: Request) => validated<{ id: string }>(req, 'params').id;

export async function list(req: Request, res: Response): Promise<void> {
  sendList(res, await service.listStudents(req.user!, req.scope, validated<ListStudentsQuery>(req, 'query')));
}

export async function get(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getStudent(req.user!, req.scope, idOf(req)));
}

export async function create(req: Request, res: Response): Promise<void> {
  const student = await service.createStudent(req.user!, req.scope, validated<CreateStudentInput>(req, 'body'));
  sendData(res, service.presentStudent(req.user!, student), 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  sendData(res, await service.updateStudent(req.user!, req.scope, idOf(req), validated<UpdateStudentInput>(req, 'body')));
}

export async function assignClass(req: Request, res: Response): Promise<void> {
  const { classId } = validated<{ classId: string | null }>(req, 'body');
  sendData(res, await service.assignStudentClass(req.user!, req.scope, idOf(req), classId));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.removeStudent(req.user!, req.scope, idOf(req));
  res.status(204).end();
}

export async function listByClass(req: Request, res: Response): Promise<void> {
  sendData(res, await service.listClassStudents(req.user!, req.scope, idOf(req)));
}
