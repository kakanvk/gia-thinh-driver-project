import { describe, expect, it } from 'vitest';
import { nextLeadCode } from '../../src/modules/leads/lead.code';

describe('nextLeadCode', () => {
  it('GT-yyMMdd-NN theo ngày VN, tăng dần, ngày mới đếm lại', async () => {
    const day1 = new Date('2026-09-23T17:30:00Z'); // 24/09 00:30 giờ VN
    expect(await nextLeadCode(day1)).toBe('GT-260924-01');
    expect(await nextLeadCode(day1)).toBe('GT-260924-02');
    expect(await nextLeadCode(new Date('2026-09-24T17:00:00Z'))).toBe('GT-260925-01');
  });

  it('gọi đồng thời không trùng mã', async () => {
    const now = new Date('2026-10-01T03:00:00Z');
    const codes = await Promise.all(Array.from({ length: 20 }, () => nextLeadCode(now)));
    expect(new Set(codes).size).toBe(20);
    expect(codes).toContain('GT-261001-20');
  });

  it('quá 99 vẫn tăng tiếp (3 chữ số)', async () => {
    const now = new Date('2026-10-02T03:00:00Z');
    for (let i = 0; i < 99; i += 1) await nextLeadCode(now);
    expect(await nextLeadCode(now)).toBe('GT-261002-100');
  });
});
