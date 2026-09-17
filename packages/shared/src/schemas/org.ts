import { z } from 'zod';

import { PLANS } from '../constants/plans';
import { ROLES } from '../constants/roles';

/**
 * Static Next.js segments win over the dynamic `/[orgSlug]` one, so an org holding any of these
 * slugs would be permanently unreachable at its own public URL (TDD §12).
 */
export const RESERVED_ORG_SLUGS = ['login', 'dashboard', 'auth', 'api'] as const;

/**
 * Lowercase, digits and single inner hyphens. The slug appears in public URLs and in the
 * `@@unique([orgId, slug])` keys, so the format is deliberately narrow.
 */
export const slugSchema = z
  .string()
  .min(2)
  .max(50)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const orgSlugSchema = slugSchema.refine(
  (slug) => !(RESERVED_ORG_SLUGS as readonly string[]).includes(slug),
  { error: 'reserved' },
);

export const createOrgSchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug: orgSlugSchema,
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>;

/** One entry of `GET /orgs`: the caller's role travels with the org (TDD §11). */
export const orgSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  plan: z.enum(PLANS),
  role: z.enum(ROLES),
});

export type OrgSummary = z.infer<typeof orgSummarySchema>;

const usageSchema = z.object({
  used: z.number().int().nonnegative(),
  /** `null` mirrors `PLAN_LIMITS`: no cap on this plan. */
  cap: z.number().int().positive().nullable(),
});

/**
 * `GET /orgs/:orgSlug`. Usage is computed server-side from the same `PLAN_LIMITS` record the
 * guard enforces, so the billing page never counts rows itself (TDD §11).
 */
export const orgDetailSchema = orgSummarySchema.extend({
  usage: z.object({
    boards: usageSchema,
    posts: usageSchema,
    webhooks: z.object({ available: z.boolean() }),
  }),
});

export type OrgDetail = z.infer<typeof orgDetailSchema>;
