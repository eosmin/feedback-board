import { describe, expect, it } from 'vitest';

import { ROLES, type Role } from '../../../src/constants/roles';

describe('ROLES', () => {
  it('exposes the three roles', () => {
    expect(ROLES).toEqual(['OWNER', 'ADMIN', 'MEMBER']);
  });

  it('holds no duplicates', () => {
    expect(new Set(ROLES).size).toBe(ROLES.length);
  });

  it('infers its member type from the tuple', () => {
    const role: Role = 'ADMIN';

    expect(ROLES).toContain(role);
  });
});
