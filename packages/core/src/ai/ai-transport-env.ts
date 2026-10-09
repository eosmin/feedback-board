import type { z } from 'zod';

/**
 * The credential variables that decide which AI transport is active. A structural shape, not an
 * import of either app's `Env` (`packages/core` cannot depend on an app).
 */
export interface AiTransportCredentialEnv {
  readonly AI_GATEWAY_API_KEY?: string | undefined;
  readonly AI_CUSTOM_BASE_URL?: string | undefined;
  readonly AI_CUSTOM_API_KEY?: string | undefined;
}

/**
 * `superRefine` body shared by `apps/api` and `apps/worker`. The two transports are mutually
 * exclusive and `AI_CUSTOM_BASE_URL` is the switch (see `resolveModel`): each mode needs its own
 * credential, and the other mode's credential is rejected rather than ignored — a key set under
 * the wrong name would otherwise pass validation and only fail as a 401 at the first AI call.
 */
export function refineAiTransportEnv(env: AiTransportCredentialEnv, ctx: z.RefinementCtx): void {
  const issue = (key: keyof AiTransportCredentialEnv, message: string): void => {
    ctx.addIssue({ code: 'custom', path: [key], message });
  };

  if (env.AI_CUSTOM_BASE_URL !== undefined) {
    if (env.AI_CUSTOM_API_KEY === undefined) {
      issue('AI_CUSTOM_API_KEY', 'required when AI_CUSTOM_BASE_URL is set');
    }
    if (env.AI_GATEWAY_API_KEY !== undefined) {
      issue('AI_GATEWAY_API_KEY', 'not used when AI_CUSTOM_BASE_URL is set; use AI_CUSTOM_API_KEY');
    }
    return;
  }

  if (env.AI_GATEWAY_API_KEY === undefined) {
    issue('AI_GATEWAY_API_KEY', 'required unless AI_CUSTOM_BASE_URL is set');
  }
  if (env.AI_CUSTOM_API_KEY !== undefined) {
    issue('AI_CUSTOM_API_KEY', 'only used with AI_CUSTOM_BASE_URL; use AI_GATEWAY_API_KEY');
  }
}
