import { describe, expect, it } from 'vitest';
import { User } from '../../src/modules/users/user.model';
import { passwordSchema, phoneSchema, usernameSchema } from '../../src/modules/users/users.validation';
import { normalizePhone } from '../../src/utils/phone';
import { createUser } from '../helpers/factories';

describe('User model', () => {
  it('băm mật khẩu, verifyPassword đúng/sai', async () => {
    const { user, password } = await createUser();
    expect(user.passwordHash).not.toBe(password);
    expect(await user.verifyPassword(password)).toBe(true);
    expect(await user.verifyPassword('sai-mat-khau-1')).toBe(false);
  });

  it('toJSON không lộ passwordHash', async () => {
    const { user } = await createUser();
    expect(user.toJSON()).not.toHaveProperty('passwordHash');
  });

  it('username lưu chữ thường; username và SĐT duy nhất', async () => {
    await User.init();
    await createUser({ username: 'Duyen.Tran', phone: '0779666664' });
    expect(await User.findOne({ username: 'duyen.tran' })).not.toBeNull();
    await expect(createUser({ username: 'duyen.tran' })).rejects.toMatchObject({ code: 11000 });
    await expect(createUser({ phone: '0779666664' })).rejects.toMatchObject({ code: 11000 });
  });

  it('email là tùy chọn', async () => {
    const { user } = await createUser();
    expect(user.email).toBeUndefined();
  });
});

describe('normalizePhone / phoneSchema / usernameSchema', () => {
  it.each([
    ['0779 666 664', '0779666664'],
    ['+84 779.666.664', '0779666664'],
    ['84779666664', '0779666664'],
    ['(0779)-666-664', '0779666664'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
    expect(phoneSchema.parse(input)).toBe(expected);
  });

  it('phoneSchema từ chối số sai độ dài', () => {
    expect(phoneSchema.safeParse('07796666').success).toBe(false);
  });

  it('usernameSchema: chữ thường, cần ít nhất một chữ cái, ký tự hợp lệ', () => {
    expect(usernameSchema.parse(' Duyen.Tran ')).toBe('duyen.tran');
    expect(usernameSchema.safeParse('0779666664').success).toBe(false);
    expect(usernameSchema.safeParse('duyên').success).toBe(false);
    expect(usernameSchema.safeParse('ab').success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it('yêu cầu ≥ 8 ký tự, có chữ và số', () => {
    expect(passwordSchema.safeParse('abc12345').success).toBe(true);
    expect(passwordSchema.safeParse('abcdefgh').success).toBe(false);
    expect(passwordSchema.safeParse('12345678').success).toBe(false);
    expect(passwordSchema.safeParse('ab1').success).toBe(false);
  });
});
