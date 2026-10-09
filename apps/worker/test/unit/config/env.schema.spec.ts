import { validateEnv } from '../../../src/config/env.schema';

function validEnv(): Record<string, unknown> {
  return {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://app:pw@localhost:5432/postgres',
    AI_GATEWAY_API_KEY: 'gw_x',
    AI_CLASSIFY_MODEL: 'anthropic/claude-haiku-4.5',
    REDIS_URL: 'redis://localhost:6379',
  };
}

describe('validateEnv', () => {
  it('parses a valid environment and applies defaults', () => {
    const env = validateEnv(validEnv());

    expect(env.DATABASE_URL).toBe('postgresql://app:pw@localhost:5432/postgres');
    expect(env.AI_CUSTOM_SUPPORTS_STRUCTURED_OUTPUTS).toBe(true);
  });

  it('reads "false" as false rather than as a truthy string', () => {
    const env = validateEnv({ ...validEnv(), AI_CUSTOM_SUPPORTS_STRUCTURED_OUTPUTS: 'false' });

    expect(env.AI_CUSTOM_SUPPORTS_STRUCTURED_OUTPUTS).toBe(false);
  });

  it('refuses to boot when a required variable is missing', () => {
    const raw = validEnv();
    delete raw.DATABASE_URL;

    expect(() => validateEnv(raw)).toThrow(/DATABASE_URL/);
  });

  it('applies the AI transport rules: one credential per mode, the other mode’s is rejected', () => {
    const noGateway = validEnv();
    delete noGateway.AI_GATEWAY_API_KEY;
    const custom = { ...noGateway, AI_CUSTOM_BASE_URL: 'http://localhost:11434/v1' };

    expect(() => validateEnv(noGateway)).toThrow(/AI_GATEWAY_API_KEY/);
    expect(() => validateEnv(custom)).toThrow(
      /AI_CUSTOM_API_KEY: required when AI_CUSTOM_BASE_URL is set/,
    );
    expect(validateEnv({ ...custom, AI_CUSTOM_API_KEY: 'ck' }).AI_CUSTOM_API_KEY).toBe('ck');
    expect(() =>
      validateEnv({ ...custom, AI_CUSTOM_API_KEY: 'ck', AI_GATEWAY_API_KEY: 'gw_x' }),
    ).toThrow(/AI_GATEWAY_API_KEY: not used when AI_CUSTOM_BASE_URL is set/);
  });

  it('rejects ADMIN_DATABASE_URL — the worker has no admin caller (TDD §3.2, §3.10)', () => {
    expect(() =>
      validateEnv({
        ...validEnv(),
        ADMIN_DATABASE_URL: 'postgresql://owner:pw@localhost:5432/postgres',
      }),
    ).toThrow(/ADMIN_DATABASE_URL/);
  });

  it('rejects the migration role and the app-role password', () => {
    expect(() =>
      validateEnv({ ...validEnv(), DIRECT_URL: 'postgresql://owner:pw@localhost:5432/postgres' }),
    ).toThrow(/DIRECT_URL/);
    expect(() => validateEnv({ ...validEnv(), APP_DB_PASSWORD: 'pw' })).toThrow(/APP_DB_PASSWORD/);
  });

  it('rejects apps/api-only variables this process has no business holding', () => {
    expect(() => validateEnv({ ...validEnv(), STRIPE_SECRET_KEY: 'sk_test_x' })).toThrow(
      /STRIPE_SECRET_KEY/,
    );
    expect(() => validateEnv({ ...validEnv(), WEB_ORIGIN: 'http://localhost:3000' })).toThrow(
      /WEB_ORIGIN/,
    );
    expect(() => validateEnv({ ...validEnv(), BULL_BOARD_ENABLED: 'false' })).toThrow(
      /BULL_BOARD_ENABLED/,
    );
  });

  it('rejects browser-prefixed variables', () => {
    expect(() => validateEnv({ ...validEnv(), NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon' })).toThrow(
      /NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });
});
