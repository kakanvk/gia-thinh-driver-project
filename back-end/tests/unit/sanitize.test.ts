import { describe, expect, it } from 'vitest';
import { stripMongoOperators } from '../../src/middlewares/sanitize.middleware';

describe('stripMongoOperators', () => {
  it('bỏ key bắt đầu bằng $ hoặc chứa dấu chấm, kể cả lồng nhau', () => {
    const input = { email: { $ne: null }, 'a.b': 1, ok: [{ $where: 'x', text: 'giữ' }], name: 'An' };
    expect(stripMongoOperators(input)).toEqual({ email: {}, ok: [{ text: 'giữ' }], name: 'An' });
  });
});
