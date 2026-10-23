import { describe, expect, it } from 'vitest';

import { profileSchema, updateProfileSchema } from '../../../src/schemas/profile';

const UUID = '3f1a7c2e-9b4d-4f8a-9c1e-7d5b2a6e0f43';

describe('updateProfileSchema', () => {
  it('trims the name', () => {
    const result = updateProfileSchema.safeParse({ name: '  Ada  ' });

    expect(result.success && result.data).toEqual({ name: 'Ada' });
  });

  it('rejects a blank name', () => {
    expect(updateProfileSchema.safeParse({ name: '   ' }).success).toBe(false);
  });

  it('rejects a name beyond eighty characters', () => {
    expect(updateProfileSchema.safeParse({ name: 'a'.repeat(81) }).success).toBe(false);
  });
});

describe('profileSchema', () => {
  it('accepts a profile with no name yet', () => {
    expect(
      profileSchema.safeParse({ id: UUID, email: 'ada@example.com', name: null }).success,
    ).toBe(true);
  });

  it('rejects a profile without an email', () => {
    expect(profileSchema.safeParse({ id: UUID, name: 'Ada' }).success).toBe(false);
  });
});
