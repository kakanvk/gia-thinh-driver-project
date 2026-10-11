import { recordAudit } from '../audit/audit.service';
import { Setting } from './setting.model';
import { SETTING_KEYS, type SettingKey, type SettingsValues } from './settings.schema';

export async function getSettings(keys: readonly SettingKey[] = SETTING_KEYS): Promise<SettingsValues> {
  const rows = await Setting.find({ key: { $in: keys } });
  return Object.fromEntries(rows.map((row) => [row.key, row.value])) as SettingsValues;
}

export async function updateSettings(actor: Express.AuthUser, patch: SettingsValues): Promise<SettingsValues> {
  for (const key of Object.keys(patch) as SettingKey[]) {
    const value = patch[key];
    const previous = await Setting.findOneAndUpdate(
      { key },
      { key, value, updatedBy: actor.id },
      { upsert: true, returnDocument: 'before' },
    );
    await recordAudit({
      actorId: actor.id,
      action: 'setting.update',
      entity: 'setting',
      entityId: key,
      before: previous?.value,
      after: value,
    });
  }
  return getSettings();
}
