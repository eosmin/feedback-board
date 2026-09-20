// RFC 4122 shape check only — a fail-closed guard against a malformed caller, not a full UUID
// validator. orgId is always resolved server-side (OrgGuard, or a Zod-validated job payload)
// and never taken from raw client input, so this is a second gate, not the primary one (TDD
// §3.3). Shared by TenantRunner (packages/core) and TenantPrismaService (apps/api) so the check
// exists in exactly one place.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
