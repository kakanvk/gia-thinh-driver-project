import { nextSequence } from './mongoose/counter';
import { formatVn } from './time';

export async function nextDailyCode(prefix: string, now: Date = new Date()): Promise<string> {
  const day = formatVn(now, 'yyMMdd');
  const seq = await nextSequence(`${prefix.toLowerCase()}:${day}`);
  return `${prefix}-${day}-${String(seq).padStart(2, '0')}`;
}
