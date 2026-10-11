export function normalizePhone(input: string): string {
  const digits = input.trim().replace(/[\s.\-()]/g, '');
  if (digits.startsWith('+84')) return `0${digits.slice(3)}`;
  if (digits.startsWith('84') && digits.length === 11) return `0${digits.slice(2)}`;
  return digits;
}
