import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendData } from '../../utils/response';
import * as finance from './dashboard.finance';
import * as service from './dashboard.service';
import type { MonthQuery, MonthsQuery, RegistrationsQuery, ScopeQuery } from './dashboard.validation';

export async function summary(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getSummary(req.scope, validated<ScopeQuery>(req, 'query')));
}

export async function registrations(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getRegistrations(req.scope, validated<RegistrationsQuery>(req, 'query')));
}

export async function sources(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getSources(req.scope, validated<MonthQuery>(req, 'query')));
}

export async function funnel(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getFunnel(req.scope, validated<MonthQuery>(req, 'query')));
}

export async function revenue(req: Request, res: Response): Promise<void> {
  sendData(res, await finance.getRevenue(req.scope, validated<MonthsQuery>(req, 'query')));
}

export async function passRate(req: Request, res: Response): Promise<void> {
  sendData(res, await finance.getPassRate(req.scope, validated<MonthsQuery>(req, 'query')));
}
