import type { ERROR_CODES, ErrorCode } from '../constants/error-codes';
import type { Plan, PlanCapability, PlanLimitedResource } from '../constants/plans';

/**
 * Error response shapes. These have no Zod schema on purpose: nothing validates them at a
 * boundary — the API builds them and the web reads them — so a schema would be an unused
 * runtime artefact.
 */

/** One `class-validator` failure. `rule` is the validator name, never a sentence (TDD §2.6.13). */
export interface ValidationFieldError {
  field: string;
  rule: string;
}

export interface ValidationFailedResponse {
  error: typeof ERROR_CODES.VALIDATION_FAILED;
  fields: ValidationFieldError[];
}

/**
 * A PlanGuard refusal. The dashboard renders this as an upgrade prompt, which is why it carries
 * the offending limit and its cap rather than being a bare 403 (TDD §3.9).
 */
export interface PlanLimitResponse {
  error: typeof ERROR_CODES.PLAN_LIMIT;
  limit: PlanLimitedResource | PlanCapability;
  plan: Plan;
  /** `null` on an unlimited plan; `false` when the capability itself is unavailable. */
  cap: number | null | false;
}

/** Every other failure: a code and nothing else, since the web owns all copy (TDD §7.8). */
export interface ErrorResponse {
  error: ErrorCode;
}

export type ApiErrorResponse = ValidationFailedResponse | PlanLimitResponse | ErrorResponse;
