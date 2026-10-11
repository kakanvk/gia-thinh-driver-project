import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendData, sendList } from '../../utils/response';
import * as payments from './payments.service';
import * as service from './tuition.service';
import type { AddPaymentInput, ListAccountsQuery, UpdateAccountInput } from './tuition.validation';

const idOf = (req: Request) => validated<{ id: string }>(req, 'params').id;

export async function list(req: Request, res: Response): Promise<void> {
  sendList(res, await service.listAccounts(req.scope, validated<ListAccountsQuery>(req, 'query')));
}

export async function get(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getAccount(req.scope, idOf(req)));
}

export async function backfill(req: Request, res: Response): Promise<void> {
  sendData(
    res,
    await service.backfillAccount(req.user!, req.scope, validated<{ studentId: string }>(req, 'body').studentId),
    201,
  );
}

export async function update(req: Request, res: Response): Promise<void> {
  sendData(res, await service.updateAccount(req.user!, req.scope, idOf(req), validated<UpdateAccountInput>(req, 'body')));
}

export async function addPayment(req: Request, res: Response): Promise<void> {
  sendData(res, await payments.addPayment(req.user!, req.scope, idOf(req), validated<AddPaymentInput>(req, 'body')), 201);
}

export async function voidPayment(req: Request, res: Response): Promise<void> {
  const { id, paymentId } = validated<{ id: string; paymentId: string }>(req, 'params');
  sendData(
    res,
    await payments.voidPayment(req.user!, req.scope, id, paymentId, validated<{ reason: string }>(req, 'body').reason),
  );
}
