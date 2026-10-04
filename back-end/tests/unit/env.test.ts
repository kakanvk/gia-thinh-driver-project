import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../src/config/env';

const base = {
  MONGODB_URL: 'mongodb://localhost:27017/gt',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  CORS_ORIGINS: 'http://a.vn, http://b.vn',
};

describe('parseEnv', () => {
  it('áp dụng giá trị mặc định và tách CORS_ORIGINS', () => {
    const env = parseEnv(base);
    expect(env.PORT).toBe(4000);
    expect(env.APP_TIMEZONE).toBe('Asia/Ho_Chi_Minh');
    expect(env.JWT_ACCESS_EXPIRES_MIN).toBe(15);
    expect(env.CORS_ORIGINS).toEqual(['http://a.vn', 'http://b.vn']);
    expect(env.STORAGE_DRIVER).toBe('local');
  });

  it('báo lỗi khi secret quá ngắn', () => {
    expect(() => parseEnv({ ...base, JWT_ACCESS_SECRET: 'short' })).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('bắt buộc GCS_BUCKET khi STORAGE_DRIVER=gcs', () => {
    expect(() => parseEnv({ ...base, STORAGE_DRIVER: 'gcs' })).toThrow(/GCS_BUCKET/);
  });

  it('coi chuỗi rỗng là không khai báo', () => {
    const env = parseEnv({ ...base, SEED_ADMIN_USERNAME: '', COOKIE_DOMAIN: '' });
    expect(env.SEED_ADMIN_USERNAME).toBeUndefined();
    expect(env.COOKIE_DOMAIN).toBeUndefined();
  });
});
