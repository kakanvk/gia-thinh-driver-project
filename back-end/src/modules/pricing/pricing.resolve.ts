export type ResolverCourse = {
  id: string;
  code: string;
  name: string;
  vehicleType: string;
  description?: string;
  duration?: string;
  defaultPrice: number;
  priceNote?: string;
  image?: { url: string; alt: string } | null;
  order: number;
};

export type ResolverOverride = { courseId: string; price: number; priceNote?: string | null };

export type ResolverItem = {
  id: string;
  kind: 'fee' | 'discount';
  key: string;
  courseId: string | null;
  branchId: string | null;
  label: string;
  amount?: number | null;
  amountMax?: number | null;
  unit?: string | null;
  note?: string | null;
  hidden: boolean;
  order: number;
};

export type ResolvedItem = {
  id: string;
  key: string;
  label: string;
  amount: number | null;
  amountMax: number | null;
  unit: string | null;
  note: string | null;
  source: 'global' | 'branch';
};

export type ResolvedCourse = {
  id: string;
  code: string;
  name: string;
  vehicleType: string;
  description: string | null;
  duration: string | null;
  image: { url: string; alt: string } | null;
  defaultPrice: number;
  price: number;
  priceNote: string | null;
  priceSource: 'default' | 'override';
  fees: ResolvedItem[];
  discounts: ResolvedItem[];
};

function rank(item: ResolverItem, branchId: string): number {
  return (item.branchId === branchId ? 2 : 0) + (item.courseId ? 1 : 0);
}

function pickItems(items: ResolverItem[], kind: ResolverItem['kind'], branchId: string): ResolvedItem[] {
  const winners = new Map<string, ResolverItem>();
  for (const item of items) {
    if (item.kind !== kind) continue;
    const current = winners.get(item.key);
    if (!current || rank(item, branchId) > rank(current, branchId)) winners.set(item.key, item);
  }
  return [...winners.values()]
    .filter((item) => !item.hidden)
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'vi'))
    .map((item) => ({
      id: item.id,
      key: item.key,
      label: item.label,
      amount: item.amount ?? null,
      amountMax: item.amountMax ?? null,
      unit: item.unit ?? null,
      note: item.note ?? null,
      source: item.branchId ? 'branch' : 'global',
    }));
}

export function resolveBranchPricing(
  branchId: string,
  courses: ResolverCourse[],
  overrides: ResolverOverride[],
  items: ResolverItem[],
): ResolvedCourse[] {
  const overrideByCourse = new Map(overrides.map((override) => [override.courseId, override]));
  const inScope = items.filter((item) => item.branchId === null || item.branchId === branchId);

  return [...courses]
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'vi'))
    .map((course) => {
      const override = overrideByCourse.get(course.id);
      const applicable = inScope.filter((item) => item.courseId === null || item.courseId === course.id);
      return {
        id: course.id,
        code: course.code,
        name: course.name,
        vehicleType: course.vehicleType,
        description: course.description ?? null,
        duration: course.duration ?? null,
        image: course.image ?? null,
        defaultPrice: course.defaultPrice,
        price: override?.price ?? course.defaultPrice,
        priceNote: override?.priceNote ?? course.priceNote ?? null,
        priceSource: override ? 'override' : 'default',
        fees: pickItems(applicable, 'fee', branchId),
        discounts: pickItems(applicable, 'discount', branchId),
      };
    });
}
