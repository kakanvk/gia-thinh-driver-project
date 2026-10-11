import { createApp } from './app';
import { connectDb, disconnectDb } from './config/db';
import { env } from './config/env';
import { logger } from './config/logger';
import { startJobs, stopJobs } from './jobs';

async function main(): Promise<void> {
  await connectDb();
  const server = createApp().listen(env.PORT, () => {
    logger.info(`API chạy tại http://localhost:${env.PORT}/api/v1`);
    startJobs();
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Đang tắt server');
    const jobsStopped = stopJobs();
    server.close(async () => {
      await jobsStopped;
      await disconnectDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err: unknown) => {
  logger.fatal({ err }, 'Không khởi động được server');
  process.exit(1);
});
