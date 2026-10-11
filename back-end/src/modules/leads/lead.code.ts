import { nextSequence } from '../../shared/mongoose/counter';
import { formatVn } from '../../shared/time';

export async function nextLeadCode(now: Date = new Date()): Promise<string> {
  const day = formatVn(now, 'yyMMdd');
  const seq = await nextSequence(`lead:${day}`);
  return `GT-${day}-${String(seq).padStart(2, '0')}`;
}
