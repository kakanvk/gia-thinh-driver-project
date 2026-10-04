import { connectDb, disconnectDb } from '../config/db';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { Branch } from '../modules/branches/branch.model';
import { Setting } from '../modules/settings/setting.model';
import { settingSchemas, type SettingKey } from '../modules/settings/settings.schema';
import { hashPassword, User } from '../modules/users/user.model';
import { phoneSchema, usernameSchema } from '../modules/users/users.validation';
import { WITH_DELETED } from '../shared/mongoose/softDelete';
import { seedBranches, seedSettings } from './seed-data';

export async function runSeed(
  opts: { adminUsername?: string; adminPhone?: string; adminPassword?: string } = {},
): Promise<void> {
  for (const branch of seedBranches) {
    await Branch.updateOne({ slug: branch.slug, ...WITH_DELETED }, { $setOnInsert: branch }, { upsert: true });
  }

  for (const key of Object.keys(seedSettings) as SettingKey[]) {
    const value = settingSchemas[key].parse(seedSettings[key]);
    await Setting.updateOne({ key }, { $setOnInsert: { key, value } }, { upsert: true });
  }

  if (opts.adminUsername && opts.adminPhone && opts.adminPassword) {
    const username = usernameSchema.parse(opts.adminUsername);
    const phone = phoneSchema.parse(opts.adminPhone);
    if (!(await User.exists({ $or: [{ username }, { phone }], ...WITH_DELETED }))) {
      await User.create({
        name: 'Quản trị viên',
        username,
        phone,
        role: 'super_admin',
        branchIds: [],
        passwordHash: await hashPassword(opts.adminPassword),
      });
      logger.info({ username }, 'Đã tạo tài khoản super_admin');
    }
  }
}

if (require.main === module) {
  (async () => {
    await connectDb();
    await runSeed({
      adminUsername: env.SEED_ADMIN_USERNAME,
      adminPhone: env.SEED_ADMIN_PHONE,
      adminPassword: env.SEED_ADMIN_PASSWORD,
    });
    logger.info('Seed xong');
    await disconnectDb();
  })().catch((err: unknown) => {
    logger.fatal({ err }, 'Seed thất bại');
    process.exit(1);
  });
}
