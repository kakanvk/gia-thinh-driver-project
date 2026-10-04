import { isValid } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const VN_OFFSET = '+07:00';

const HAS_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/i;

export function toVnIso(date: Date): string {
  return formatInTimeZone(date, VN_OFFSET, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

export function parseDateOnly(value: string): Date {
  const date = fromZonedTime(`${value}T00:00:00`, VN_OFFSET);
  if (!isValid(date) || formatInTimeZone(date, VN_OFFSET, 'yyyy-MM-dd') !== value) {
    throw new Error(`Ngày không hợp lệ: ${value}`);
  }
  return date;
}

export function parseDateTime(value: string): Date {
  const date = HAS_OFFSET.test(value) ? new Date(value) : fromZonedTime(value, VN_OFFSET);
  if (!isValid(date)) throw new Error(`Thời gian không hợp lệ: ${value}`);
  return date;
}

export function vnYearMonthPath(date: Date): string {
  return formatInTimeZone(date, VN_OFFSET, 'yyyy/MM');
}

export function jsonDateReplacer(this: unknown, key: string, value: unknown): unknown {
  const raw = (this as Record<string, unknown> | null)?.[key];
  return raw instanceof Date && isValid(raw) ? toVnIso(raw) : value;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Cộng n ngày theo mili-giây cố định (VN không có DST), không phụ thuộc múi giờ của process. */
export function addFixedDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function formatVn(date: Date, pattern: string): string {
  return formatInTimeZone(date, VN_OFFSET, pattern);
}

export function vnMonthRange(month: string): { start: Date; end: Date } {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7));
  const nextYear = monthIndex === 12 ? year + 1 : year;
  const nextMonth = monthIndex === 12 ? 1 : monthIndex + 1;
  return {
    start: parseDateOnly(`${month}-01`),
    end: parseDateOnly(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01`),
  };
}

export function startOfVnDay(date: Date = new Date()): Date {
  return parseDateOnly(formatInTimeZone(date, VN_OFFSET, 'yyyy-MM-dd'));
}
