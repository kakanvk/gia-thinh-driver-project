import { connectDb, disconnectDb } from '../config/db';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { Branch } from '../modules/branches/branch.model';
import { Setting } from '../modules/settings/setting.model';
import { settingSchemas, type SettingKey } from '../modules/settings/settings.schema';
import { hashPassword, User } from '../modules/users/user.model';
import { phoneSchema, usernameSchema } from '../modules/users/users.validation';
import { WITH_DELETED } from '../shared/mongoose/softDelete';
import { seedCatalog } from './seed-catalog';
import { seedBranches, seedSettings } from './seed-data';

type SeedAdmin = { adminUsername?: string; adminPhone?: string; adminPassword?: string };

export function missingAdminVars(opts: SeedAdmin): string[] {
  const adminVars = {
    SEED_ADMIN_USERNAME: opts.adminUsername,
    SEED_ADMIN_PHONE: opts.adminPhone,
    SEED_ADMIN_PASSWORD: opts.adminPassword,
  };
  return Object.entries(adminVars)
    .filter(([, value]) => !value)
    .map(([key]) => key);
}

export async function runSeed(opts: SeedAdmin = {}): Promise<void> {
  const missing = missingAdminVars(opts);
  if (missing.length > 0 && missing.length < 3) {
    throw new Error(`Thiếu ${missing.join(', ')} trong .env — cần đủ cả 3 biến SEED_ADMIN_* để tạo admin`);
  }

  for (const branch of seedBranches) {
    await Branch.updateOne({ slug: branch.slug, ...WITH_DELETED }, { $setOnInsert: branch }, { upsert: true });
  }

  await seedCatalog();

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
    if (!(await User.exists({ role: 'super_admin' }))) {
      logger.warn('Chưa có tài khoản super_admin: điền SEED_ADMIN_USERNAME, SEED_ADMIN_PHONE, SEED_ADMIN_PASSWORD rồi chạy lại');
    }
    logger.info('Seed xong');
    await disconnectDb();
  })().catch((err: unknown) => {
    logger.fatal({ err }, 'Seed thất bại');
    process.exit(1);
  });
}
