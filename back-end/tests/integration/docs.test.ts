import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

describe('tài liệu API', () => {
  it('/api/docs.json liệt kê endpoint đợt 1–3', async () => {
    const res = await request(createApp()).get('/api/docs.json');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining([
        '/health',
        '/auth/login',
        '/auth/refresh',
        '/users',
        '/users/{id}/status',
        '/branches',
        '/settings',
        '/media',
        '/audit',
        '/public/branches',
        '/public/settings',
        '/courses',
        '/pricing/items',
        '/pricing/branches/{branchId}/courses/{courseId}',
        '/categories',
        '/posts',
        '/posts/{id}/publish',
        '/posts/{id}/restore',
        '/public/pricing',
        '/public/categories',
        '/public/posts',
        '/public/posts/{slug}',
        '/leads',
        '/leads/export',
        '/leads/{id}/status',
        '/leads/{id}/activities',
        '/appointments',
        '/appointments/calendar',
        '/public/leads',
      ]),
    );
  });

  it('/api/docs/ trả trang Swagger UI', async () => {
    const res = await request(createApp()).get('/api/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger');
  });
});
