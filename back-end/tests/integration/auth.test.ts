import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { sha256 } from '../../src/utils/crypto';
import { Token } from '../../src/modules/auth/token.model';
import { authHeader, createUser } from '../helpers/factories';
import { refreshCookieFrom } from '../helpers/http';

let app: ReturnType<typeof createApp>;
beforeEach(() => {
  app = createApp();
});

async function login(identifier: string, password: string) {
  return request(app).post('/api/v1/auth/login').send({ identifier, password });
}

describe('POST /auth/login', () => {
  it('trả access token, user (không có passwordHash) và cookie refresh httpOnly', async () => {
    const { user, password } = await createUser({ username: 'admin' });
    const res = await login('admin', password);
    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(res.body.data.user.id).toBe(user.id);
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('gt_refresh='));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
  });

  it('đăng nhập bằng username (chữ hoa, khoảng trắng) hoặc SĐT (định dạng bất kỳ)', async () => {
    const { password } = await createUser({ username: 'admin', phone: '0779666664' });
    expect((await login('  Admin ', password)).status).toBe(200);
    expect((await login('0779666664', password)).status).toBe(200);
    expect((await login('+84 779.666.664', password)).status).toBe(200);
  });

  it('401 khi sai mật khẩu hoặc tài khoản không tồn tại, cùng một thông báo', async () => {
    await createUser({ username: 'nv_a' });
    const wrong = await login('nv_a', 'Saimatkhau1');
    const missing = await login('khongco', 'Saimatkhau1');
    expect(wrong.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(wrong.body.error.message).toBe(missing.body.error.message);
  });

  it('403 khi tài khoản bị khóa', async () => {
    const { password } = await createUser({ username: 'nv_b', status: 'suspended' });
    expect((await login('nv_b', password)).status).toBe(403);
  });

  it('429 RATE_LIMITED sau 5 lần sai trong 15 phút', async () => {
    await createUser({ username: 'nv_c' });
    for (let i = 0; i < 5; i += 1) expect((await login('nv_c', 'Saimatkhau1')).status).toBe(401);
    const res = await login('nv_c', 'Saimatkhau1');
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });

  it('400 khi thiếu identifier', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ password: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('body.identifier');
  });
});

describe('POST /auth/refresh', () => {
  it('xoay vòng token: cookie mới hoạt động, cookie cũ bị coi là tái sử dụng và thu hồi cả family', async () => {
    const { password } = await createUser({ username: 'nv_d' });
    const first = refreshCookieFrom(await login('nv_d', password))!;

    const r1 = await request(app).post('/api/v1/auth/refresh').set('Cookie', first);
    expect(r1.status).toBe(200);
    expect(typeof r1.body.data.accessToken).toBe('string');
    const second = refreshCookieFrom(r1)!;
    expect(second).not.toBe(first);

    await Token.updateOne(
      { tokenHash: sha256(first.slice('gt_refresh='.length)) },
      { revokedAt: new Date(Date.now() - 60_000) },
    );
    const reuse = await request(app).post('/api/v1/auth/refresh').set('Cookie', first);
    expect(reuse.status).toBe(401);

    const afterReuse = await request(app).post('/api/v1/auth/refresh').set('Cookie', second);
    expect(afterReuse.status).toBe(401);
  });

  it('replay cookie cũ trong cửa sổ ân hạn: 401 nhưng cookie mới vẫn dùng được', async () => {
    const { password } = await createUser({ username: 'nv_h' });
    const first = refreshCookieFrom(await login('nv_h', password))!;
    const r1 = await request(app).post('/api/v1/auth/refresh').set('Cookie', first);
    const second = refreshCookieFrom(r1)!;
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', first)).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', second)).status).toBe(200);
  });

  it('refresh thất bại thì xóa cookie gt_refresh', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', 'gt_refresh=bogus');
    expect(res.status).toBe(401);
    const raw = res.headers['set-cookie'] as unknown as string[];
    expect(raw.find((c) => c.startsWith('gt_refresh=;'))).toBeDefined();
  });

  it('hai request đồng thời cùng cookie: đúng một request thành công', async () => {
    const { password } = await createUser({ username: 'nv_e' });
    const cookie = refreshCookieFrom(await login('nv_e', password))!;
    const results = await Promise.all([
      request(app).post('/api/v1/auth/refresh').set('Cookie', cookie),
      request(app).post('/api/v1/auth/refresh').set('Cookie', cookie),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
    const winner = results.find((r) => r.status === 200)!;
    const next = await request(app).post('/api/v1/auth/refresh').set('Cookie', refreshCookieFrom(winner)!);
    expect(next.status).toBe(200);
  });

  it('401 khi không có cookie', async () => {
    expect((await request(app).post('/api/v1/auth/refresh')).status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('thu hồi refresh token và xóa cookie', async () => {
    const { password } = await createUser({ username: 'nv_f' });
    const cookie = refreshCookieFrom(await login('nv_f', password))!;
    const res = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);
    expect(res.status).toBe(204);
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie)).status).toBe(401);
  });
});

describe('/auth/me', () => {
  it('401 khi không có hoặc sai token', async () => {
    expect((await request(app).get('/api/v1/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer abc')).status).toBe(401);
  });

  it('trả user và danh sách quyền', async () => {
    const { user } = await createUser({ role: 'editor' });
    const res = await request(app).get('/api/v1/auth/me').set(authHeader(user));
    expect(res.status).toBe(200);
    expect(res.body.data.user.username).toBe(user.username);
    expect(res.body.data.permissions).toContain('post.manage');
  });

  it('401 khi tài khoản bị khóa sau khi đã cấp token', async () => {
    const { user } = await createUser();
    const headers = authHeader(user);
    user.status = 'suspended';
    await user.save();
    expect((await request(app).get('/api/v1/auth/me').set(headers)).status).toBe(401);
  });

  it('PATCH cập nhật tên/SĐT, không cho đổi role', async () => {
    const { user } = await createUser({ role: 'editor' });
    const res = await request(app)
      .patch('/api/v1/auth/me')
      .set(authHeader(user))
      .send({ name: 'Mỹ Duyên', phone: '0779666664', role: 'super_admin' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.name).toBe('Mỹ Duyên');
    expect(res.body.data.user.role).toBe('editor');
  });
});

describe('POST /auth/change-password', () => {
  it('400 khi mật khẩu hiện tại sai', async () => {
    const { user } = await createUser();
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set(authHeader(user))
      .send({ currentPassword: 'Saimatkhau1', newPassword: 'Moimatkhau1' });
    expect(res.status).toBe(400);
  });

  it('đổi thành công, đăng nhập bằng mật khẩu mới, mọi refresh token bị thu hồi', async () => {
    const { user, password } = await createUser({ username: 'nv_g' });
    const cookie = refreshCookieFrom(await login('nv_g', password))!;
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set(authHeader(user))
      .send({ currentPassword: password, newPassword: 'Moimatkhau1' });
    expect(res.status).toBe(204);
    expect((await login('nv_g', 'Moimatkhau1')).status).toBe(200);
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie)).status).toBe(401);
    expect(await Token.countDocuments({ userId: user._id, type: 'refresh', revokedAt: null })).toBe(1);
  });
});
