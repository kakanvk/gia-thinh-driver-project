import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import type { ListQuery } from '../../shared/mongoose/paginate';
import { sendData, sendList } from '../../utils/response';
import { listMedia, uploadMedia } from './media.service';

export async function upload(req: Request, res: Response): Promise<void> {
  const { alt } = validated<{ alt?: string }>(req, 'body');
  sendData(res, await uploadMedia(req.file, alt, req.user!.id), 201);
}

export async function list(req: Request, res: Response): Promise<void> {
  sendList(res, await listMedia(validated<ListQuery>(req, 'query')));
}
