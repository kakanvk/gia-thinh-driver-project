import { describe, expect, it } from 'vitest';
import { escapeRegex } from '../../src/utils/regex';
import { slugify } from '../../src/utils/slugify';

describe('slugify', () => {
  it.each([
    ['Tân Ngãi', 'tan-ngai'],
    ['VP Vũng Liêm', 'vp-vung-liem'],
    ['Đức Hòa  —  Long An', 'duc-hoa-long-an'],
    ['  Hạng B (số sàn) ', 'hang-b-so-san'],
  ])('%s → %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

describe('escapeRegex', () => {
  it('thoát ký tự đặc biệt', () => {
    expect(new RegExp(escapeRegex('a.b(c)')).test('a.b(c)')).toBe(true);
    expect(new RegExp(escapeRegex('a.b')).test('axb')).toBe(false);
  });
});
