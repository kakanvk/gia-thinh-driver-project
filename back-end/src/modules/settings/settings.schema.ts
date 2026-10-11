import { z } from 'zod';

const labelValue = z.object({
  label: z.string().trim().min(1).max(100),
  value: z.string().trim().min(1).max(100),
});

export const settingSchemas = {
  hotline: z.string().trim().min(8).max(20),
  zaloOa: z.string().trim().min(1).max(100),
  supportEmail: z.email(),
  socials: z.array(z.object({ label: z.string().trim().min(1).max(50), url: z.url() })).max(10),
  supportContacts: z.array(labelValue.extend({ note: z.string().trim().max(255).default('') })).max(20),
  supportPlaybook: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(150),
        steps: z.string().trim().min(1).max(1000),
        href: z.string().regex(/^\/admin(\/[a-z0-9-]*)*$/, 'Đường dẫn phải bắt đầu bằng /admin'),
        linkLabel: z.string().trim().min(1).max(100),
      }),
    )
    .max(20),
  registerNotes: z.array(z.string().trim().min(1).max(500)).max(20),
  consultationContactTimes: z.array(labelValue).max(10),
} as const;

export type SettingKey = keyof typeof settingSchemas;
export type SettingsValues = { [K in SettingKey]?: z.infer<(typeof settingSchemas)[K]> };

export const SETTING_KEYS = Object.keys(settingSchemas) as SettingKey[];

export const PUBLIC_SETTING_KEYS: readonly SettingKey[] = [
  'hotline',
  'zaloOa',
  'supportEmail',
  'socials',
  'registerNotes',
  'consultationContactTimes',
];

export const updateSettingsSchema = z.object(settingSchemas).partial().strict();
