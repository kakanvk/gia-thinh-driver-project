import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendData } from '../../utils/response';
import { PUBLIC_SETTING_KEYS, type SettingsValues } from './settings.schema';
import { getSettings, updateSettings } from './settings.service';

export async function get(_req: Request, res: Response): Promise<void> {
  sendData(res, await getSettings());
}

export async function update(req: Request, res: Response): Promise<void> {
  sendData(res, await updateSettings(req.user!, validated<SettingsValues>(req, 'body')));
}

export async function getPublic(_req: Request, res: Response): Promise<void> {
  sendData(res, await getSettings(PUBLIC_SETTING_KEYS));
}
