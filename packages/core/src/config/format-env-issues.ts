import type { z } from 'zod';

/**
 * Renders a failed env parse for the startup error, shared by `apps/api` and `apps/worker`.
 *
 * Only `custom` issues (raised by a `superRefine`) print their message; every other code prints
 * the code alone, so a rejected value can never be echoed into a log. That makes the message of
 * a `custom` issue part of the log surface: it must be a constant written in the source, never
 * interpolated from `env` (no `` `bad ${env.X}` ``).
 */
export function formatEnvIssues(error: z.ZodError): string {
  return error.issues
    .map(
      (issue) => `${issue.path.join('.')}: ${issue.code === 'custom' ? issue.message : issue.code}`,
    )
    .join('; ');
}
