import { createInterface } from 'node:readline/promises';
import mongoose from 'mongoose';
import { connectDb, disconnectDb } from '../config/db';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { missingAdminVars, runSeed } from './seed';

/** Chỉ cho xoá database dev/test, không bao giờ ở production. Trả về lý do từ chối, hoặc null nếu được phép. */
export function resetRefusal(nodeEnv: string, dbName: string): string | null {
  if (nodeEnv === 'production') return 'NODE_ENV=production — không được xoá dữ liệu';
  if (!/(dev|test|local)/i.test(dbName)) {
    return `Tên database "${dbName}" không chứa dev/test/local — chỉ reset database dev`;
  }
  return null;
}

async function confirm(dbName: string): Promise<boolean> {
  if (process.argv.includes('--yes')) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`Sẽ XOÁ TOÀN BỘ database "${dbName}" rồi seed lại. Gõ đúng tên database để xác nhận: `);
  rl.close();
  return answer.trim() === dbName;
}

if (require.main === module) {
  (async () => {
    await connectDb();
    const dbName = mongoose.connection.db?.databaseName ?? '';
    const admin = {
      adminUsername: env.SEED_ADMIN_USERNAME,
      adminPhone: env.SEED_ADMIN_PHONE,
      adminPassword: env.SEED_ADMIN_PASSWORD,
    };
    const missing = missingAdminVars(admin);
    const refusal =
      resetRefusal(env.NODE_ENV, dbName) ??
      (missing.length ? `Thiếu ${missing.join(', ')} trong .env — reset sẽ không còn tài khoản admin` : null);
    if (refusal) {
      logger.error(refusal);
      process.exitCode = 1;
    } else if (!(await confirm(dbName))) {
      logger.warn('Đã huỷ, không xoá gì');
      process.exitCode = 1;
    } else {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.syncIndexes();
      await runSeed(admin);
      logger.info({ dbName }, 'Đã xoá database và seed lại');
    }
    await disconnectDb();
  })().catch((err: unknown) => {
    logger.fatal({ err }, 'Reset seed thất bại');
    process.exit(1);
  });
}
