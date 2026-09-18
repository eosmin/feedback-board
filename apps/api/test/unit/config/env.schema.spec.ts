import { validateEnv } from '../../../src/config/env.schema';

function validEnv(): Record<string, unknown> {
  return {
    NODE_ENV: 'test',
    PORT: '3001',
    WEB_ORIGIN: 'http://localhost:3000',
    SUPABASE_URL: 'http://127.0.0.1:54321',
    DATABASE_URL: 'postgresql://app:pw@localhost:5432/postgres',
    ADMIN_DATABASE_URL: 'postgresql://owner:pw@localhost:5432/postgres',
    STRIPE_SECRET_KEY: 'sk_test_x',
    STRIPE_WEBHOOK_SECRET: 'whsec_x',
    STRIPE_PRO_PRICE_ID: 'price_x',
    AI_GATEWAY_API_KEY: 'gw_x',
    AI_DIGEST_MODEL: 'anthropic/claude-sonnet-5',
    REDIS_URL: 'redis://localhost:6379',
  };
}

describe('validateEnv', () => {
  it('parses a valid environment and applies defaults', () => {
    const env = validateEnv(validEnv());

    expect(env.PORT).toBe(3001);
    expect(env.BULL_BOARD_ENABLED).toBe(false);
    expect(env.BULL_BOARD_ADMIN_EMAILS).toBe('');
    expect(env.AI_CUSTOM_SUPPORTS_STRUCTURED_OUTPUTS).toBe(true);
  });

  it('reads "false" as false rather than as a truthy string', () => {
    const env = validateEnv({ ...validEnv(), AI_CUSTOM_SUPPORTS_STRUCTURED_OUTPUTS: 'false' });

    expect(env.AI_CUSTOM_SUPPORTS_STRUCTURED_OUTPUTS).toBe(false);
  });

  it('enables the Bull Board flag only on the exact string "true"', () => {
    expect(validateEnv({ ...validEnv(), BULL_BOARD_ENABLED: 'true' }).BULL_BOARD_ENABLED).toBe(
      true,
    );
    expect(() => validateEnv({ ...validEnv(), BULL_BOARD_ENABLED: 'yes' })).toThrow(
      /Invalid environment/,
    );
  });

  it('refuses to boot when a required variable is missing', () => {
    const raw = validEnv();
    delete raw.DATABASE_URL;

    expect(() => validateEnv(raw)).toThrow(/DATABASE_URL/);
  });

  it('refuses to boot when a required variable is malformed', () => {
    expect(() => validateEnv({ ...validEnv(), WEB_ORIGIN: 'not-a-url' })).toThrow(
      /Invalid environment/,
    );
  });

  it('requires the Gateway credential only when no custom base URL is configured', () => {
    const raw = validEnv();
    delete raw.AI_GATEWAY_API_KEY;

    expect(() => validateEnv(raw)).toThrow(/AI_GATEWAY_API_KEY/);
    expect(
      validateEnv({ ...raw, AI_CUSTOM_BASE_URL: 'http://localhost:11434/v1' }).AI_CUSTOM_BASE_URL,
    ).toBe('http://localhost:11434/v1');
  });

  it('rejects the migration role and the app-role password', () => {
    expect(() =>
      validateEnv({ ...validEnv(), DIRECT_URL: 'postgresql://owner:pw@localhost:5432/postgres' }),
    ).toThrow(/DIRECT_URL/);
    expect(() => validateEnv({ ...validEnv(), APP_DB_PASSWORD: 'pw' })).toThrow(/APP_DB_PASSWORD/);
  });

  it('rejects browser-prefixed variables', () => {
    expect(() => validateEnv({ ...validEnv(), NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon' })).toThrow(
      /NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });
});
