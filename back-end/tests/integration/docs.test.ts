import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

describe('tài liệu API', () => {
  it('/api/docs.json liệt kê endpoint đợt 1–5', async () => {
    const res = await request(createApp()).get('/api/docs.json');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining([
        '/health',
        '/tuition',
        '/tuition/{id}/payments',
        '/tuition/{id}/payments/{paymentId}',
        '/dashboard/summary',
        '/dashboard/funnel',
        '/dashboard/revenue',
        '/dashboard/pass-rate',
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
        '/instructors',
        '/vehicles/alerts',
        '/classes',
        '/students',
        '/students/{id}/class',
        '/leads/{id}/convert',
        '/exams/{id}/candidates',
        '/public/classes/upcoming',
        '/public/exams/upcoming',
      ]),
    );
  });

  it('/api/docs/ trả trang Swagger UI', async () => {
    const res = await request(createApp()).get('/api/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger');
  });
});
