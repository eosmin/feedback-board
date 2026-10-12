/**
 * Variables read only by the demo seed (`pnpm seed`). A running api or worker has no use for
 * them, so one set in a production environment means seed configuration leaked into a deploy.
 */
export const SEED_ONLY_VARS = ['SEED_OWNER_EMAIL'] as const;

/**
 * The seed-only variables that are set to a non-empty value while `NODE_ENV` is `production`.
 * Empty or blank counts as unset: `.env.example` ships `SEED_OWNER_EMAIL=` blank. Outside production
 * they are allowed, because the root `.env` is shared with the seed during development.
 */
export function findSeedVarsInProduction(raw: Record<string, unknown>): string[] {
  if (raw.NODE_ENV !== 'production') {
    return [];
  }
  return SEED_ONLY_VARS.filter((name) => {
    const value = raw[name];
    return typeof value === 'string' && value.trim() !== '';
  });
}
