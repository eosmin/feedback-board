/**
 * Reads a required environment variable, throwing a descriptive error instead of letting a
 * missing value surface later as an obscure `undefined` somewhere downstream. Shared by every
 * test fixture and e2e suite that reads test-only env vars directly from `process.env` (§16 —
 * these vars have no runtime schema entry because they belong to no booted app, only to the
 * test process). Previously duplicated verbatim in `sign-in.ts` and `orgs.e2e-spec.ts`; a third
 * copy in a future e2e suite is exactly the drift this file exists to prevent.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`test fixture: missing required env var ${name}`);
  }
  return value;
}
