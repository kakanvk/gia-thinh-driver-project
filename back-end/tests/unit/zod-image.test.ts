import { describe, expect, it } from 'vitest';
import { imageInputSchema } from '../../src/shared/zod';

describe('imageInputSchema url', () => {
  it.each(['/a.png', 'https://x.vn/a.png'])('chấp nhận %s', (url) => {
    expect(imageInputSchema.safeParse({ url }).success).toBe(true);
  });
  it.each(['//evil.com/a.png', '/\\evil.com/a.png', 'javascript:alert(1)'])('từ chối %s', (url) => {
    expect(imageInputSchema.safeParse({ url }).success).toBe(false);
  });
});
