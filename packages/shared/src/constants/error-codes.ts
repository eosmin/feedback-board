/**
 * Every code the API may return. The API emits codes and the web owns the copy, so no response
 * body ever carries a sentence and e2e tests assert on these values rather than on message
 * text (TDD §7.8).
 */
export const ERROR_CODES = {
  /** The global filter also attaches `fields: [{ field, rule }]`. */
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  /** Accompanied by `{ limit, plan, cap }` so the dashboard can render an upgrade prompt. */
  PLAN_LIMIT: 'PLAN_LIMIT',
  UNAUTHORIZED: 'UNAUTHORIZED',
  /** Authenticated but not entitled: no membership, or the wrong role. */
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  /** The filter's fallback, so an unhandled failure still answers with a code. */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
