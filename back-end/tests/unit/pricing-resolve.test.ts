import { describe, expect, it } from 'vitest';
import {
  resolveBranchPricing,
  type ResolverCourse,
  type ResolverItem,
} from '../../src/modules/pricing/pricing.resolve';

const A = 'branch-a';
const B = 'branch-b';

const courses: ResolverCourse[] = [
  { id: 'a', code: 'A', name: 'Hạng A', vehicleType: 'moto', defaultPrice: 1_750_000, priceNote: 'Gồm lệ phí', order: 2 },
  { id: 'a1', code: 'A1', name: 'Hạng A1', vehicleType: 'moto', defaultPrice: 620_000, order: 1 },
];

let seq = 0;
function item(overrides: Partial<ResolverItem>): ResolverItem {
  seq += 1;
  return {
    id: `i${seq}`,
    kind: 'fee',
    key: 'k',
    courseId: null,
    branchId: null,
    label: 'Mục',
    hidden: false,
    order: 0,
    ...overrides,
  };
}

describe('resolveBranchPricing', () => {
  it('đủ mọi gói, sắp theo order, mặc định dùng giá gốc', () => {
    const result = resolveBranchPricing(A, courses, [], []);
    expect(result.map((c) => c.code)).toEqual(['A1', 'A']);
    expect(result[1]).toMatchObject({ price: 1_750_000, priceNote: 'Gồm lệ phí', priceSource: 'default', defaultPrice: 1_750_000 });
    expect(result[0]?.priceNote).toBeNull();
  });

  it('giá ghi đè thay giá gốc; priceNote ghi đè nếu có, không thì giữ của gói', () => {
    const result = resolveBranchPricing(A, courses, [{ courseId: 'a', price: 1_595_000 }, { courseId: 'a1', price: 790_000, priceNote: 'Riêng' }], []);
    expect(result.find((c) => c.code === 'A')).toMatchObject({ price: 1_595_000, priceSource: 'override', priceNote: 'Gồm lệ phí' });
    expect(result.find((c) => c.code === 'A1')).toMatchObject({ price: 790_000, priceNote: 'Riêng' });
  });

  it('mục của chi nhánh cùng key thay mục chung; chi nhánh khác vẫn thấy mục chung', () => {
    const items = [
      item({ key: 'cam-bien-a', courseId: 'a', label: 'Xe cảm biến A', amount: 70_000, unit: 'vòng' }),
      item({ key: 'cam-bien-a', courseId: 'a', branchId: B, label: 'Cảm biến A tay ga Vespa', amount: 50_000, unit: 'vòng' }),
    ];
    const atA = resolveBranchPricing(A, courses, [], items).find((c) => c.code === 'A')!;
    const atB = resolveBranchPricing(B, courses, [], items).find((c) => c.code === 'A')!;
    expect(atA.fees).toEqual([
      { id: expect.any(String), key: 'cam-bien-a', label: 'Xe cảm biến A', amount: 70_000, amountMax: null, unit: 'vòng', note: null, source: 'global' },
    ]);
    expect(atB.fees).toMatchObject([{ label: 'Cảm biến A tay ga Vespa', amount: 50_000, source: 'branch' }]);
  });

  it('hidden ở chi nhánh ẩn mục chung chỉ ở chi nhánh đó', () => {
    const items = [
      item({ key: 'thi-thu', label: 'Thi thử máy tính', amount: 10_000 }),
      item({ key: 'thi-thu', branchId: B, label: 'Thi thử máy tính', hidden: true }),
    ];
    expect(resolveBranchPricing(A, courses, [], items)[0]?.fees).toHaveLength(1);
    expect(resolveBranchPricing(B, courses, [], items)[0]?.fees).toHaveLength(0);
  });

  it('mục chỉ áp dụng cho gói khác không xuất hiện; mục courseId null áp dụng mọi gói', () => {
    const items = [item({ key: 'chung', label: 'Chung' }), item({ key: 'rieng-a', courseId: 'a', label: 'Riêng A' })];
    const result = resolveBranchPricing(A, courses, [], items);
    expect(result.find((c) => c.code === 'A1')?.fees.map((f) => f.label)).toEqual(['Chung']);
    expect(result.find((c) => c.code === 'A')?.fees.map((f) => f.label).sort()).toEqual(['Chung', 'Riêng A']);
  });

  it('ưu tiên: chi nhánh+gói > chi nhánh+mọi gói > chung+gói > chung+mọi gói', () => {
    const items = [
      item({ key: 'x', label: 'chung-moi-goi' }),
      item({ key: 'x', courseId: 'a', label: 'chung-goi' }),
      item({ key: 'x', branchId: A, label: 'cn-moi-goi' }),
    ];
    expect(resolveBranchPricing(A, courses, [], items).find((c) => c.code === 'A')?.fees[0]?.label).toBe('cn-moi-goi');
    items.push(item({ key: 'x', courseId: 'a', branchId: A, label: 'cn-goi' }));
    expect(resolveBranchPricing(A, courses, [], items).find((c) => c.code === 'A')?.fees[0]?.label).toBe('cn-goi');
    expect(resolveBranchPricing(B, courses, [], items).find((c) => c.code === 'A')?.fees[0]?.label).toBe('chung-goi');
  });

  it('tách fee và discount, sắp theo order rồi label', () => {
    const items = [
      item({ key: 'z', kind: 'discount', label: 'Giảm Z', order: 2 }),
      item({ key: 'y', kind: 'discount', label: 'Giảm Y', order: 1 }),
      item({ key: 'f', kind: 'fee', label: 'Phí' }),
    ];
    const course = resolveBranchPricing(A, courses, [], items)[0]!;
    expect(course.fees.map((f) => f.label)).toEqual(['Phí']);
    expect(course.discounts.map((d) => d.label)).toEqual(['Giảm Y', 'Giảm Z']);
  });
});
