import { describe, expect, it } from 'vitest';
import { resetRefusal } from '../../src/scripts/seed-reset';

describe('resetRefusal', () => {
  it('cho phép database dev/test/local khi không phải production', () => {
    expect(resetRefusal('development', 'gia-thinh-dev')).toBeNull();
    expect(resetRefusal('test', 'gia-thinh-test')).toBeNull();
    expect(resetRefusal('development', 'local-db')).toBeNull();
  });

  it('từ chối khi NODE_ENV=production dù tên database có dev', () => {
    expect(resetRefusal('production', 'gia-thinh-dev')).toMatch(/production/);
  });

  it('từ chối database không có dev/test/local (vd. production)', () => {
    expect(resetRefusal('development', 'gia-thinh')).toMatch(/gia-thinh/);
  });
});
