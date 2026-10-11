import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendData, sendList } from '../../utils/response';
import * as service from './media.service';

type IdParams = { id: string };

export async function upload(req: Request, res: Response): Promise<void> {
  const { alt } = validated<{ alt?: string }>(req, 'body');
  sendData(res, await service.uploadMedia(req.file, alt, req.user!.id), 201);
}

export async function list(req: Request, res: Response): Promise<void> {
  sendList(res, await service.listMedia(validated<service.ListMediaQuery>(req, 'query')));
}

export async function createVideoUpload(req: Request, res: Response): Promise<void> {
  sendData(res, await service.createVideoUpload(validated<service.VideoUploadInput>(req, 'body')), 201);
}

export async function completeVideoUpload(req: Request, res: Response): Promise<void> {
  const input = validated<service.CompleteVideoInput>(req, 'body');
  sendData(res, await service.completeVideoUpload(input, req.user!.id), 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = validated<IdParams>(req, 'params');
  sendData(res, await service.updateMedia(id, validated<service.UpdateMediaInput>(req, 'body')));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.deleteMedia(validated<IdParams>(req, 'params').id);
  res.status(204).end();
}
