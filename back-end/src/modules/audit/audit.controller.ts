import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendList } from '../../utils/response';
import { listAudit, type ListAuditQuery } from './audit.service';

export async function list(req: Request, res: Response): Promise<void> {
  sendList(res, await listAudit(validated<ListAuditQuery>(req, 'query')));
}
