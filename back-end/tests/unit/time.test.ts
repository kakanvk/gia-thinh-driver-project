import { afterEach, describe, expect, it } from 'vitest';
import { addFixedDays, jsonDateReplacer, parseDateOnly, parseDateTime, toVnIso, vnYearMonthPath } from '../../src/shared/time';
import { zDateOnly, zDateTime } from '../../src/shared/zod';

describe('giờ Việt Nam', () => {
  it('toVnIso đổi sang +07:00 (qua ngày)', () => {
    expect(toVnIso(new Date('2026-10-04T23:30:00Z'))).toBe('2026-10-05T06:30:00+07:00');
  });

  it('parseDateOnly là 00:00 giờ VN', () => {
    expect(parseDateOnly('2026-10-05').toISOString()).toBe('2026-10-04T17:00:00.000Z');
  });

  it('parseDateTime không offset → hiểu là giờ VN; có offset → giữ nguyên', () => {
    expect(parseDateTime('2026-10-05T08:00').toISOString()).toBe('2026-10-05T01:00:00.000Z');
    expect(parseDateTime('2026-10-05T08:00:00Z').toISOString()).toBe('2026-10-05T08:00:00.000Z');
  });

  it('parseDateTime ném lỗi với chuỗi không phải ngày', () => {
    expect(() => parseDateTime('hôm qua')).toThrow();
  });

  it('vnYearMonthPath theo tháng giờ VN', () => {
    expect(vnYearMonthPath(new Date('2026-09-30T18:00:00Z'))).toBe('2026/10');
  });

  it('jsonDateReplacer làm JSON.stringify xuất giờ VN, kể cả lồng nhau', () => {
    const json = JSON.stringify({ at: new Date('2026-10-04T23:30:00Z'), nested: [{ d: new Date(0) }] }, jsonDateReplacer);
    expect(json).toBe('{"at":"2026-10-05T06:30:00+07:00","nested":[{"d":"1970-01-01T07:00:00+07:00"}]}');
  });

  it('jsonDateReplacer xử lý Invalid Date bằng cách trả lại null', () => {
    const json = JSON.stringify({ d: new Date('x') }, jsonDateReplacer);
    expect(json).toBe('{"d":null}');
  });

  it('parseDateOnly ngày cũ round-trips qua toVnIso', () => {
    const date = parseDateOnly('1970-05-20');
    expect(toVnIso(date)).toBe('1970-05-20T00:00:00+07:00');
  });

  it('zDateOnly từ chối định dạng sai và ngày không tồn tại', () => {
    expect(zDateOnly.safeParse('05/10/2026').success).toBe(false);
    expect(zDateOnly.safeParse('2026-02-30').success).toBe(false);
    expect(zDateOnly.parse('2026-10-05').toISOString()).toBe('2026-10-04T17:00:00.000Z');
  });

  it('zDateTime chấp nhận datetime không offset', () => {
    const result = zDateTime.parse('2026-10-05T08:00');
    expect(result.toISOString()).toBe('2026-10-05T01:00:00.000Z');
  });

  it('zDateTime chấp nhận datetime có offset', () => {
    const result = zDateTime.parse('2026-10-05T08:00:00+07:00');
    expect(result.toISOString()).toBe('2026-10-05T01:00:00.000Z');
  });

  it('zDateTime từ chối chuỗi không phải datetime', () => {
    expect(zDateTime.safeParse('abc').success).toBe(false);
  });

  describe('addFixedDays', () => {
    const originalTz = process.env.TZ;
    afterEach(() => {
      if (originalTz === undefined) delete process.env.TZ;
      else process.env.TZ = originalTz;
    });

    it('cộng đúng 24h dù process chạy ở múi giờ có DST', () => {
      process.env.TZ = 'America/New_York';
      const start = new Date('2026-11-01T04:00:00Z'); // 00:00 NY, ngày kết thúc DST
      expect(addFixedDays(start, 1).toISOString()).toBe('2026-11-02T04:00:00.000Z');
      expect(addFixedDays(parseDateOnly('2026-10-05'), 1).toISOString()).toBe('2026-10-05T17:00:00.000Z');
    });
  });
});
