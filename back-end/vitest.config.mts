import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    env: {
      NODE_ENV: 'test',
      MONGODB_URL: 'mongodb://set-by-tests',
      JWT_ACCESS_SECRET: 'test-access-secret-at-least-32-characters',
      CORS_ORIGINS: 'http://localhost:3000',
      LOG_LEVEL: 'silent',
      STORAGE_DRIVER: 'local',
      UPLOAD_DIR: '.test-uploads',
    },
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
