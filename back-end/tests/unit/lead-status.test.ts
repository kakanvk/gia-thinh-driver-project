import { describe, expect, it } from 'vitest';
import { canTransition, OPEN_STATUSES, STATUS_LABELS } from '../../src/modules/leads/lead.status';

describe('canTransition', () => {
  it.each([
    ['new', 'contacted'],
    ['new', 'consulted'],
    ['contacted', 'docs_completed'],
    ['deposited', 'docs_completed'],
    ['new', 'lost'],
    ['docs_completed', 'lost'],
    ['lost', 'contacted'],
  ] as const)('%s → %s được phép', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    ['consulted', 'new'],
    ['docs_completed', 'deposited'],
    ['new', 'new'],
    ['lost', 'lost'],
    ['lost', 'consulted'],
    ['docs_completed', 'enrolled'],
    ['enrolled', 'lost'],
  ] as const)('%s → %s bị chặn', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it('OPEN_STATUSES là 5 bước pipeline; mọi trạng thái có nhãn tiếng Việt', () => {
    expect(OPEN_STATUSES).toEqual(['new', 'contacted', 'consulted', 'deposited', 'docs_completed']);
    expect(STATUS_LABELS.lost).toBe('Không thành công');
    expect(Object.keys(STATUS_LABELS)).toHaveLength(7);
  });
});
