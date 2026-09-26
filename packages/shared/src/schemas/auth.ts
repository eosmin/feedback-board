import { z } from 'zod';

/**
 * `/login`'s magic-link form (TDD §3.4, §12) — the only auth input this project has, since there
 * is no password flow and no OAuth (TDD §1.5, §18). `react-hook-form`'s `zodResolver` reads this
 * schema directly, so field-level errors come from the same shape as every other form in this
 * app, even though this particular request never reaches `apps/api` — it goes straight from the
 * browser to Supabase Auth (TDD §2.6.5).
 */
export const magicLinkRequestSchema = z.object({
  email: z.email(),
});

export type MagicLinkRequestInput = z.infer<typeof magicLinkRequestSchema>;
