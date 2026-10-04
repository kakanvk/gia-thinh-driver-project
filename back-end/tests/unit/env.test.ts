import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../src/config/env';

const base = {
  MONGODB_URL: 'mongodb://localhost:27017/gt',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  CORS_ORIGINS: 'http://a.vn, http://b.vn',
};

describe('parseEnv', () => {
  it('áp dụng giá trị mặc định và tách CORS_ORIGINS', () => {
    const env = parseEnv({ ...base, GCS_BUCKET: 'gt-media' });
    expect(env.PORT).toBe(4000);
    expect(env.APP_TIMEZONE).toBe('Asia/Ho_Chi_Minh');
    expect(env.JWT_ACCESS_EXPIRES_MIN).toBe(15);
    expect(env.CORS_ORIGINS).toEqual(['http://a.vn', 'http://b.vn']);
    expect(env.STORAGE_DRIVER).toBe('gcs');
    expect(env.ALLOW_LOCAL_STORAGE).toBe(false);
    expect(env.MAX_VIDEO_BYTES).toBe(524288000);
  });

  it('báo lỗi khi secret quá ngắn', () => {
    expect(() => parseEnv({ ...base, JWT_ACCESS_SECRET: 'short' })).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('bắt buộc GCS_BUCKET khi STORAGE_DRIVER=gcs (kể cả mặc định)', () => {
    expect(() => parseEnv({ ...base, STORAGE_DRIVER: 'gcs' })).toThrow(/GCS_BUCKET/);
    expect(() => parseEnv(base)).toThrow(/GCS_BUCKET/);
  });

  it('chặn STORAGE_DRIVER=local ngoài môi trường test nếu không có ALLOW_LOCAL_STORAGE', () => {
    expect(() => parseEnv({ ...base, NODE_ENV: 'development', STORAGE_DRIVER: 'local' })).toThrow(/Media phải lưu trên GCS/);
    expect(() =>
      parseEnv({ ...base, NODE_ENV: 'production', STORAGE_DRIVER: 'local', ALLOW_LOCAL_STORAGE: 'false' }),
    ).toThrow(/Media phải lưu trên GCS/);
    const env = parseEnv({ ...base, NODE_ENV: 'development', STORAGE_DRIVER: 'local', ALLOW_LOCAL_STORAGE: 'true' });
    expect(env.STORAGE_DRIVER).toBe('local');
    expect(env.ALLOW_LOCAL_STORAGE).toBe(true);
    expect(parseEnv({ ...base, NODE_ENV: 'test', STORAGE_DRIVER: 'local' }).STORAGE_DRIVER).toBe('local');
  });

  it('đọc MAX_VIDEO_BYTES dạng số', () => {
    expect(parseEnv({ ...base, GCS_BUCKET: 'b', MAX_VIDEO_BYTES: '1000' }).MAX_VIDEO_BYTES).toBe(1000);
    expect(() => parseEnv({ ...base, GCS_BUCKET: 'b', MAX_VIDEO_BYTES: 'abc' })).toThrow(/MAX_VIDEO_BYTES/);
  });

  it('coi chuỗi rỗng là không khai báo', () => {
    const env = parseEnv({ ...base, GCS_BUCKET: 'b', SEED_ADMIN_USERNAME: '', COOKIE_DOMAIN: '' });
    expect(env.SEED_ADMIN_USERNAME).toBeUndefined();
    expect(env.COOKIE_DOMAIN).toBeUndefined();
  });
});
