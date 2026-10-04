import { describe, expect, it } from 'vitest';
import { formatVn, vnMonthRange } from '../../src/shared/time';

describe('formatVn / vnMonthRange', () => {
  it('formatVn hiển thị theo giờ VN', () => {
    expect(formatVn(new Date('2026-10-04T18:30:00Z'), 'dd/MM/yyyy HH:mm')).toBe('05/10/2026 01:30');
    expect(formatVn(new Date('2026-09-23T17:00:00Z'), 'yyMMdd')).toBe('260924');
  });

  it('vnMonthRange: đầu tháng tới đầu tháng sau theo giờ VN, qua năm đúng', () => {
    const oct = vnMonthRange('2026-10');
    expect(oct.start.toISOString()).toBe('2026-09-30T17:00:00.000Z');
    expect(oct.end.toISOString()).toBe('2026-10-31T17:00:00.000Z');
    expect(vnMonthRange('2026-12').end.toISOString()).toBe('2026-12-31T17:00:00.000Z');
  });
});
