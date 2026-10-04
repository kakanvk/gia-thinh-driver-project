import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

describe('GET /api/v1/health', () => {
  it('trả trạng thái ok', async () => {
    const res = await request(createApp()).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.time).toMatch(/\+07:00$/);
  });

  it('trả 404 dạng lỗi chuẩn cho đường dẫn không tồn tại', async () => {
    const res = await request(createApp()).get('/khong-ton-tai');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('trả lỗi chuẩn khi body JSON sai cú pháp', async () => {
    const res = await request(createApp())
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{"a":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('trả 400 VALIDATION_ERROR khi body vượt quá 1mb', async () => {
    // Create a payload larger than 1mb
    const largePayload = JSON.stringify({ data: 'x'.repeat(2_000_000) });
    const res = await request(createApp())
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send(largePayload);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBe('Dữ liệu gửi lên quá lớn');
  });
});
