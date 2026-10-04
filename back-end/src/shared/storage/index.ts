import path from 'node:path';
import { Storage } from '@google-cloud/storage';
import { env } from '../../config/env';
import { GcsStorageDriver } from './gcs';
import { LocalStorageDriver } from './local';
import type { StorageDriver } from './types';

let driver: StorageDriver | undefined;

function createDriver(): StorageDriver {
  if (env.STORAGE_DRIVER === 'gcs') {
    return new GcsStorageDriver(new Storage().bucket(env.GCS_BUCKET!), env.PUBLIC_MEDIA_BASE_URL);
  }
  return new LocalStorageDriver(
    path.resolve(env.UPLOAD_DIR),
    env.PUBLIC_MEDIA_BASE_URL ?? `http://localhost:${env.PORT}/uploads`,
  );
}

export function getStorage(): StorageDriver {
  driver ??= createDriver();
  return driver;
}

export function setStorage(next: StorageDriver | undefined): void {
  driver = next;
}

export type { StorageDriver } from './types';
