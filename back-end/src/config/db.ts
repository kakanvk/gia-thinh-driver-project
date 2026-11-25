import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

export async function connectDb(url: string = env.MONGODB_URL): Promise<void> {
  mongoose.set('strictQuery', true);
  // Mặc định pool 100 kết nối — quá nhiều cho VPS nhỏ và lượng truy cập của site.
  await mongoose.connect(url, { maxPoolSize: 10 });
  logger.info('Đã kết nối MongoDB');
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
