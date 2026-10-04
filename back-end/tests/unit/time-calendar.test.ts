import { describe, expect, it } from 'vitest';
import { shiftMonth, vnMonthKey, vnWeekRange } from '../../src/shared/time';

describe('lịch VN', () => {
  it('vnMonthKey theo giờ VN', () => {
    expect(vnMonthKey(new Date('2026-09-30T16:30:00Z'))).toBe('2026-09');
    expect(vnMonthKey(new Date('2026-09-30T17:00:00Z'))).toBe('2026-10');
  });

  it('shiftMonth qua năm', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-10', -11)).toBe('2025-11');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('vnWeekRange: Thứ 2 → Thứ 2 tuần sau, giờ VN', () => {
    const sunday = vnWeekRange(new Date('2026-10-04T10:00:00Z')); // CN 04/10 17:00 VN
    expect(sunday.start.toISOString()).toBe('2026-09-27T17:00:00.000Z'); // T2 28/09 00:00 VN
    expect(sunday.end.toISOString()).toBe('2026-10-04T17:00:00.000Z');
    const monday = vnWeekRange(new Date('2026-10-04T17:30:00Z')); // T2 05/10 00:30 VN
    expect(monday.start.toISOString()).toBe('2026-10-04T17:00:00.000Z');
  });
});
