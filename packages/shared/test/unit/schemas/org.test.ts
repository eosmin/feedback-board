import { describe, expect, it } from 'vitest';

import {
  createOrgSchema,
  orgDetailSchema,
  orgSlugSchema,
  orgSummarySchema,
  RESERVED_ORG_SLUGS,
  slugSchema,
} from '../../../src/schemas/org';

const UUID = '3f1a7c2e-9b4d-4f8a-9c1e-7d5b2a6e0f43';

describe('slugSchema', () => {
  it.each(['acme', 'acme-corp', 'a1-b2-c3'])('accepts %s', (slug) => {
    expect(slugSchema.safeParse(slug).success).toBe(true);
  });

  it.each(['A', 'Acme', 'acme_corp', '-acme', 'acme-', 'acme--corp', 'a', 'acme corp'])(
    'rejects %s',
    (slug) => {
      expect(slugSchema.safeParse(slug).success).toBe(false);
    },
  );

  it('rejects a slug beyond fifty characters', () => {
    expect(slugSchema.safeParse('a'.repeat(51)).success).toBe(false);
  });
});

describe('orgSlugSchema', () => {
  it.each(RESERVED_ORG_SLUGS)('rejects the reserved segment %s', (slug) => {
    const result = orgSlugSchema.safeParse(slug);

    expect(result.success).toBe(false);
  });

  it('accepts a slug that merely contains a reserved word', () => {
    expect(orgSlugSchema.safeParse('api-team').success).toBe(true);
  });

  it('lists exactly the static segments of the web app', () => {
    expect(RESERVED_ORG_SLUGS).toEqual(['login', 'dashboard', 'auth', 'api']);
  });
});

describe('createOrgSchema', () => {
  it('accepts a well-formed org', () => {
    const result = createOrgSchema.safeParse({ name: 'Acme Inc', slug: 'acme' });

    expect(result.success).toBe(true);
  });

  it('trims the name before measuring it', () => {
    const result = createOrgSchema.safeParse({ name: '  Acme  ', slug: 'acme' });

    expect(result.success).toBe(true);
    expect(result.success && result.data.name).toBe('Acme');
  });

  it('rejects a whitespace-only name', () => {
    expect(createOrgSchema.safeParse({ name: '   ', slug: 'acme' }).success).toBe(false);
  });

  it('rejects a name beyond sixty characters', () => {
    expect(createOrgSchema.safeParse({ name: 'a'.repeat(61), slug: 'acme' }).success).toBe(false);
  });

  it('rejects an unknown shape', () => {
    expect(createOrgSchema.safeParse({ name: 'Acme' }).success).toBe(false);
  });
});

describe('org response schemas', () => {
  it('requires the caller role on a summary', () => {
    const summary = { id: UUID, name: 'Acme', slug: 'acme', plan: 'FREE', role: 'OWNER' };

    expect(orgSummarySchema.safeParse(summary).success).toBe(true);
    expect(orgSummarySchema.safeParse({ ...summary, role: undefined }).success).toBe(false);
  });

  it('rejects a role outside the enum', () => {
    const summary = { id: UUID, name: 'Acme', slug: 'acme', plan: 'FREE', role: 'SUPERUSER' };

    expect(orgSummarySchema.safeParse(summary).success).toBe(false);
  });

  it('accepts usage with a null cap for an unlimited plan', () => {
    const detail = {
      id: UUID,
      name: 'Acme',
      slug: 'acme',
      plan: 'PRO',
      role: 'ADMIN',
      usage: {
        boards: { used: 4, cap: null },
        posts: { used: 120, cap: null },
        webhooks: { available: true },
      },
    };

    expect(orgDetailSchema.safeParse(detail).success).toBe(true);
  });

  it('rejects a negative usage count', () => {
    const detail = {
      id: UUID,
      name: 'Acme',
      slug: 'acme',
      plan: 'FREE',
      role: 'MEMBER',
      usage: {
        boards: { used: -1, cap: 1 },
        posts: { used: 0, cap: 50 },
        webhooks: { available: false },
      },
    };

    expect(orgDetailSchema.safeParse(detail).success).toBe(false);
  });
});
