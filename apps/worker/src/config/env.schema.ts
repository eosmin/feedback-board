import { z } from 'zod';

/**
 * Variables this process must never hold (TDD §16, §3.10): `ADMIN_DATABASE_URL` is the admin
 * client's connection string, and the worker registers `DatabaseModule.forTenant` only — no
 * admin client provider exists in this container at all, so this schema is the second,
 * independent enforcement layer (the first is the absent provider itself). Rejecting beats
 * ignoring: a credential this process cannot read is a credential a compromised worker cannot
 * misuse. `DIRECT_URL`/`APP_DB_PASSWORD` belong to CI and `bootstrap-db.sh` only, never a
 * running process (§16); `WEB_ORIGIN`/`PORT`/`STRIPE_*`/`SUPABASE_*`/`BULL_BOARD_*` all belong to
 * `apps/api` alone (§16's ownership table).
 */
const FORBIDDEN_VARS = [
  'ADMIN_DATABASE_URL',
  'DIRECT_URL',
  'APP_DB_PASSWORD',
  'WEB_ORIGIN',
  'PORT',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRO_PRICE_ID',
  'SUPABASE_URL',
  'BULL_BOARD_ENABLED',
  'BULL_BOARD_ADMIN_EMAILS',
] as const;

const FORBIDDEN_PREFIX = 'NEXT_PUBLIC_';

/** `"true"`/`"false"` rather than a coerced boolean: `z.coerce.boolean()` turns `"false"` into `true`. */
const booleanFromString = z.enum(['true', 'false']).transform((value) => value === 'true');

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    DATABASE_URL: z.string().min(1),

    AI_GATEWAY_API_KEY: z.string().min(1).optional(),
    AI_CLASSIFY_MODEL: z.string().min(1),
    AI_CUSTOM_BASE_URL: z.url().optional(),
    AI_CUSTOM_API_KEY: z.string().min(1).optional(),
    AI_CUSTOM_PROVIDER_NAME: z.string().min(1).optional(),
    AI_CUSTOM_SUPPORTS_STRUCTURED_OUTPUTS: booleanFromString.default(true),

    REDIS_URL: z.string().min(1),
  })
  .superRefine((env, ctx) => {
    // Same rule as apps/api's schema (§2.6.8b): AI_CUSTOM_BASE_URL is the only transport
    // switch. Unset it and the Gateway is used, which then needs its credential.
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
    throw new Error(`Environment rejected by apps/worker: ${rejected.join(', ')}. `);
  }

  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.code}`)
      .join('; ');
    throw new Error(`Invalid environment for apps/worker: ${details}`);
  }

  // Same rationale as apps/api/src/config/env.schema.ts: NestJS's ConfigModule overwrites
  // process.env with exactly this function's return value, and Zod strips unknown keys by
  // default — spreading raw first preserves anything this schema doesn't declare (there is
  // none expected here, but the pattern must stay identical to the one apps/api relies on).
  return { ...raw, ...result.data };
}
