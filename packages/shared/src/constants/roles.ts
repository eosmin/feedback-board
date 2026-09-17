/** Membership roles. A role is always per org — a user may be OWNER of one and MEMBER of another. */
export const ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const;

export type Role = (typeof ROLES)[number];
