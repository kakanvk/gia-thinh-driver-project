import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

describe('CORS', () => {
  it('preflight từ origin hợp lệ được cache 10 phút và cho gửi cookie', async () => {
    const res = await request(createApp())
      .options('/api/v1/auth/me')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-max-age']).toBe('600');
  });

  it('lộ Content-Disposition cho request khác origin để FE đọc được tên file tải xuống', async () => {
    const res = await request(createApp()).get('/api/v1/auth/me').set('Origin', 'http://localhost:3000');
    expect(res.headers['access-control-expose-headers']).toBe('Content-Disposition');
  });

  it('không trả allow-origin cho origin lạ', async () => {
    const res = await request(createApp())
      .options('/api/v1/auth/me')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
