import { Prisma } from '@feedback-board/core';

/** Prisma's error code for a write that matched no row, checked by code rather than message. */
const PRISMA_RECORD_NOT_FOUND_CODE = 'P2025';

/** `true` when `error` is an `update`/`delete` that found no row to act on. */
export function isRecordNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === PRISMA_RECORD_NOT_FOUND_CODE
  );
}
