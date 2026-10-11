import { describe, expect, it } from 'vitest';
import { startOfVnDay } from '../../src/shared/time';

describe('startOfVnDay', () => {
  it('00:00 giờ VN của ngày chứa thời điểm', () => {
    expect(startOfVnDay(new Date('2026-10-04T18:30:00Z')).toISOString()).toBe('2026-10-04T17:00:00.000Z');
    expect(startOfVnDay(new Date('2026-10-04T16:59:59Z')).toISOString()).toBe('2026-10-03T17:00:00.000Z');
  });
});
