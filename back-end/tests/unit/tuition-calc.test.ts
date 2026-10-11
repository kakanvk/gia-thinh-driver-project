import { describe, expect, it } from 'vitest';
import {
  amountDueBefore,
  computeTotal,
  computeTuitionStatus,
  installmentsError,
  nextDue,
} from '../../src/modules/tuition/tuition.calc';
import { parseDateOnly } from '../../src/shared/time';

const d = parseDateOnly;
const plan = [
  { dueDate: d('2026-10-01'), amount: 5_500_000 },
  { dueDate: d('2026-10-15'), amount: 5_500_000 },
  { dueDate: d('2026-11-01'), amount: 5_500_000 },
];

describe('computeTotal', () => {
  it('trừ giảm trừ, không âm', () => {
    expect(computeTotal(16_500_000, [{ label: 'HSSV', amount: 1_000_000 }])).toBe(15_500_000);
    expect(computeTotal(500_000, [{ label: 'X', amount: 900_000 }])).toBe(0);
  });
});

describe('installmentsError', () => {
  it('hợp lệ khi tổng = total, số tiền > 0, ngày tăng dần', () => {
    expect(installmentsError(plan, 16_500_000)).toBeNull();
  });
  it.each([
    [[{ dueDate: d('2026-10-01'), amount: 1 }], 2, 'Tổng các đợt'],
    [
      [
        { dueDate: d('2026-10-01'), amount: 0 },
        { dueDate: d('2026-10-02'), amount: 2 },
      ],
      2,
      'lớn hơn 0',
    ],
    [
      [
        { dueDate: d('2026-10-02'), amount: 1 },
        { dueDate: d('2026-10-01'), amount: 1 },
      ],
      2,
      'tăng dần',
    ],
    [[], 0, 'ít nhất một đợt'],
  ])('báo lỗi %#', (items, total, message) => {
    expect(installmentsError(items, total)).toContain(message);
  });
});

describe('trạng thái', () => {
  it('paid khi thu đủ; partial khi chưa tới hạn; overdue khi đã qua hạn mà thiếu', () => {
    expect(computeTuitionStatus({ total: 16_500_000, paid: 16_500_000, installments: plan }, d('2026-12-01'))).toBe('paid');
    expect(computeTuitionStatus({ total: 16_500_000, paid: 0, installments: plan }, d('2026-10-01'))).toBe('partial');
    expect(computeTuitionStatus({ total: 16_500_000, paid: 0, installments: plan }, d('2026-10-02'))).toBe('overdue');
    expect(computeTuitionStatus({ total: 16_500_000, paid: 5_500_000, installments: plan }, d('2026-10-15'))).toBe(
      'partial',
    );
    expect(computeTuitionStatus({ total: 16_500_000, paid: 5_500_000, installments: plan }, d('2026-10-16'))).toBe(
      'overdue',
    );
  });

  it('amountDueBefore và nextDue', () => {
    expect(amountDueBefore(plan, d('2026-10-16'))).toBe(11_000_000);
    expect(nextDue(plan, 0)).toEqual({ dueDate: d('2026-10-01'), amount: 5_500_000 });
    expect(nextDue(plan, 7_000_000)).toEqual({ dueDate: d('2026-10-15'), amount: 4_000_000 });
    expect(nextDue(plan, 16_500_000)).toBeNull();
  });
});
