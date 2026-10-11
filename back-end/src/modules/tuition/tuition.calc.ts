export type Installment = { dueDate: Date; amount: number };
export type Discount = { label: string; amount: number };
export type TuitionStatus = 'paid' | 'partial' | 'overdue';

export function computeTotal(listPrice: number, discounts: Discount[]): number {
  return Math.max(0, listPrice - discounts.reduce((sum, discount) => sum + discount.amount, 0));
}

export function installmentsError(installments: Installment[], total: number): string | null {
  if (installments.length === 0) return 'Cần ít nhất một đợt đóng';
  if (installments.some((item) => item.amount <= 0)) return 'Số tiền mỗi đợt phải lớn hơn 0';
  for (let i = 1; i < installments.length; i += 1) {
    if (installments[i]!.dueDate.getTime() <= installments[i - 1]!.dueDate.getTime()) {
      return 'Ngày hạn các đợt phải tăng dần';
    }
  }
  const sum = installments.reduce((acc, item) => acc + item.amount, 0);
  if (sum !== total) return `Tổng các đợt (${sum}) phải bằng tổng học phí (${total})`;
  return null;
}

export function amountDueBefore(installments: Installment[], cutoff: Date): number {
  return installments
    .filter((item) => item.dueDate.getTime() < cutoff.getTime())
    .reduce((sum, item) => sum + item.amount, 0);
}

export function computeTuitionStatus(
  input: { total: number; paid: number; installments: Installment[] },
  today: Date,
): TuitionStatus {
  if (input.paid >= input.total) return 'paid';
  return input.paid < amountDueBefore(input.installments, today) ? 'overdue' : 'partial';
}

export function nextDue(installments: Installment[], paid: number): { dueDate: Date; amount: number } | null {
  let covered = paid;
  for (const item of installments) {
    if (covered >= item.amount) {
      covered -= item.amount;
      continue;
    }
    return { dueDate: item.dueDate, amount: item.amount - covered };
  }
  return null;
}
