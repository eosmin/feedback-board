import { Prisma } from '@feedback-board/core';

/**
 * Prisma's error code for a violated unique constraint — checked by code rather than by message
 * text, which is not part of Prisma's stable API surface.
 */
const PRISMA_UNIQUE_CONSTRAINT_CODE = 'P2002';

/** `true` when `error` is a unique-constraint violation (a duplicate slug, a duplicate customer). */
export function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === PRISMA_UNIQUE_CONSTRAINT_CODE
  );
}
