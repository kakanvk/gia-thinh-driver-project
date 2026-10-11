import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

export async function connectDb(url: string = env.MONGODB_URL): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(url);
  logger.info('Đã kết nối MongoDB');
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
