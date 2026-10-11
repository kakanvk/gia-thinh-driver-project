import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendData, sendList } from '../../utils/response';
import * as service from './exams.service';
import type { CandidateResultInput, CreateExamInput, ListExamsQuery, UpdateExamInput } from './exams.validation';

const idOf = (req: Request) => validated<{ id: string }>(req, 'params').id;
const candidateParams = (req: Request) => validated<{ id: string; candidateId: string }>(req, 'params');

export async function list(req: Request, res: Response): Promise<void> {
  sendList(res, await service.listExams(req.scope, validated<ListExamsQuery>(req, 'query')));
}

export async function get(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getExam(req.scope, idOf(req)));
}

export async function create(req: Request, res: Response): Promise<void> {
  sendData(res, await service.createExam(req.user!, req.scope, validated<CreateExamInput>(req, 'body')), 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  sendData(res, await service.updateExam(req.user!, req.scope, idOf(req), validated<UpdateExamInput>(req, 'body')));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.removeExam(req.user!, req.scope, idOf(req));
  res.status(204).end();
}

export async function addCandidates(req: Request, res: Response): Promise<void> {
  const { studentIds } = validated<{ studentIds: string[] }>(req, 'body');
  sendData(res, await service.addCandidates(req.user!, req.scope, idOf(req), studentIds), 201);
}

export async function listCandidates(req: Request, res: Response): Promise<void> {
  sendData(res, await service.listCandidates(req.user!, req.scope, idOf(req)));
}

export async function setResult(req: Request, res: Response): Promise<void> {
  const { id, candidateId } = candidateParams(req);
  sendData(
    res,
    await service.setCandidateResult(req.user!, req.scope, id, candidateId, validated<CandidateResultInput>(req, 'body')),
  );
}

export async function removeCandidate(req: Request, res: Response): Promise<void> {
  const { id, candidateId } = candidateParams(req);
  await service.removeCandidate(req.user!, req.scope, id, candidateId);
  res.status(204).end();
}
