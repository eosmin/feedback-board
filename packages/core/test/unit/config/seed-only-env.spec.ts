import { findSeedVarsInProduction } from '../../../src/config/seed-only-env';

describe('findSeedVarsInProduction', () => {
  it('reports a seed variable set in production', () => {
    expect(
      findSeedVarsInProduction({ NODE_ENV: 'production', SEED_OWNER_EMAIL: 'me@example.com' }),
    ).toEqual(['SEED_OWNER_EMAIL']);
  });

  it('treats an empty value as unset', () => {
    expect(findSeedVarsInProduction({ NODE_ENV: 'production', SEED_OWNER_EMAIL: '' })).toEqual([]);
  });

  it('treats a blank value as unset', () => {
    expect(findSeedVarsInProduction({ NODE_ENV: 'production', SEED_OWNER_EMAIL: '  ' })).toEqual(
      [],
    );
  });

  it('reports nothing when the variable is absent', () => {
    expect(findSeedVarsInProduction({ NODE_ENV: 'production' })).toEqual([]);
  });

  it.each(['development', 'test', undefined])('allows the variable when NODE_ENV is %s', (env) => {
    expect(findSeedVarsInProduction({ NODE_ENV: env, SEED_OWNER_EMAIL: 'me@example.com' })).toEqual(
      [],
    );
  });
});
