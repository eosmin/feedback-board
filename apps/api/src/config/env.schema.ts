import { z } from 'zod';

/**
 * Variables this process must never hold (TDD §16): the migration role and the app-role password
 * belong to CI and to `bootstrap-db.sh`, and a `NEXT_PUBLIC_` name in a server process means a
 * secret was prefixed for the browser. Rejecting beats ignoring — a credential the API cannot
 * read is a credential a compromised API cannot hand over.
 */
const FORBIDDEN_VARS = ['DIRECT_URL', 'APP_DB_PASSWORD'] as const;

const FORBIDDEN_PREFIX = 'NEXT_PUBLIC_';

/** `"true"`/`"false"` rather than a coerced boolean: `z.coerce.boolean()` turns `"false"` into `true`. */
const booleanFromString = z.enum(['true', 'false']).transform((value) => value === 'true');

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    WEB_ORIGIN: z.url(),

    SUPABASE_URL: z.url(),

    DATABASE_URL: z.string().min(1),
    ADMIN_DATABASE_URL: z.string().min(1),

    STRIPE_SECRET_KEY: z.string().min(1),
    STRIPE_WEBHOOK_SECRET: z.string().min(1),
    STRIPE_PRO_PRICE_ID: z.string().min(1),

    AI_GATEWAY_API_KEY: z.string().min(1).optional(),
    AI_DIGEST_MODEL: z.string().min(1),
    AI_CUSTOM_BASE_URL: z.url().optional(),
    AI_CUSTOM_API_KEY: z.string().min(1).optional(),
    AI_CUSTOM_PROVIDER_NAME: z.string().min(1).optional(),
    AI_CUSTOM_SUPPORTS_STRUCTURED_OUTPUTS: booleanFromString.default(true),

    REDIS_URL: z.string().min(1),
    BULL_BOARD_ENABLED: booleanFromString.default(false),
    BULL_BOARD_ADMIN_EMAILS: z.string().default(''),
  })
  .superRefine((env, ctx) => {
    // AI_CUSTOM_BASE_URL is the only transport switch (§2.6.8b): unset it and the Gateway is
    // used, which then needs its credential. Requiring both unconditionally would make the
    // custom-endpoint deployment impossible to configure.
    if (env.AI_CUSTOM_BASE_URL === undefined && env.AI_GATEWAY_API_KEY === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['AI_GATEWAY_API_KEY'],
        message: 'required unless AI_CUSTOM_BASE_URL is set',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const present = FORBIDDEN_VARS.filter((name) => raw[name] !== undefined);
  const publicKeys = Object.keys(raw).filter((key) => key.startsWith(FORBIDDEN_PREFIX));
  const rejected = [...present, ...publicKeys];

  if (rejected.length > 0) {
    throw new Error(`Environment rejected by apps/api: ${rejected.join(', ')}. `);
  }

  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.code}`)
      .join('; ');
    throw new Error(`Invalid environment for apps/api: ${details}`);
  }

  // NestJS's ConfigModule writes this function's return value straight into process.env
  // (config.module.js's `validate` branch — unlike its own `validationSchema` branch, it does
  // NOT merge back the keys a schema doesn't declare). Zod's object mode strips unknown keys by
  // default, so returning `result.data` alone would silently drop any variable this schema
  // doesn't name — including test-only ones like `TEST_SUPABASE_ANON_KEY` that legitimately
  // belong in `apps/api/.env` (§16) but have no runtime schema entry. Spreading `raw` first
  // preserves them; the validated, coerced/defaulted fields from `result.data` still win for
  // every key this schema does declare.
  return { ...raw, ...result.data };
}
