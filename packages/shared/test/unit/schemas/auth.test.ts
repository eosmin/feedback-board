import { describe, expect, it } from 'vitest';

import { magicLinkRequestSchema } from '../../../src/schemas/auth';

describe('magicLinkRequestSchema', () => {
  it('accepts a well-formed email', () => {
    const result = magicLinkRequestSchema.safeParse({ email: 'erick@example.com' });

    expect(result.success).toBe(true);
  });

  it('rejects a string with no @', () => {
    const result = magicLinkRequestSchema.safeParse({ email: 'not-an-email' });

    expect(result.success).toBe(false);
  });

  it('rejects a missing email field', () => {
    const result = magicLinkRequestSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it('rejects an empty string', () => {
    const result = magicLinkRequestSchema.safeParse({ email: '' });

    expect(result.success).toBe(false);
  });
});
