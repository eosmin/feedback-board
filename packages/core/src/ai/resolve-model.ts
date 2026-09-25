import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';

/**
 * `packages/core` reads no `process.env` of its own (TDD §2.2a) — the app that boots
 * `AiService` (`apps/api` for the digest, `apps/worker` for classification) passes this object,
 * built from that app's own validated env (§16).
 */
export interface AiTransportConfig {
  readonly customBaseUrl?: string;
  readonly customApiKey?: string;
  readonly customProviderName?: string;
  readonly customSupportsStructuredOutputs: boolean;
}

/**
 * The subset of each app's own validated env this function needs — a structural shape, not an
 * import of either `apps/api/src/config/env.schema.ts` or `apps/worker/src/config/env.schema.ts`
 * (`packages/core` cannot depend on either app, TDD §3.10, §17). `?: string` matches exactly
 * what Zod's `.optional()` infers for these three keys under `exactOptionalPropertyTypes: true`
 * (tsconfig.base.json): an optional key whose value, when present, may still be `undefined`.
 */
export interface AiCustomTransportEnv {
  readonly AI_CUSTOM_BASE_URL?: string | undefined;
  readonly AI_CUSTOM_API_KEY?: string | undefined;
  readonly AI_CUSTOM_PROVIDER_NAME?: string | undefined;
  readonly AI_CUSTOM_SUPPORTS_STRUCTURED_OUTPUTS: boolean;
}

/**
 * Builds an `AiTransportConfig` from the four `AI_CUSTOM_*` env vars both `apps/api`
 * (`boards.module.ts`) and `apps/worker` (`worker.module.ts`) read from their own validated env
 * (TDD §3.8's second flow). Extracted here rather than duplicated in each module file (§7.1):
 * the conditional-spread shape below exists solely to satisfy `exactOptionalPropertyTypes` —
 * an explicit `customBaseUrl: undefined` is a distinct, rejected value from "key absent" on
 * `AiTransportConfig`'s own `?:` fields.
 */
export function buildAiTransportConfig(env: AiCustomTransportEnv): AiTransportConfig {
  return {
    ...(env.AI_CUSTOM_BASE_URL !== undefined && { customBaseUrl: env.AI_CUSTOM_BASE_URL }),
    ...(env.AI_CUSTOM_API_KEY !== undefined && { customApiKey: env.AI_CUSTOM_API_KEY }),
    ...(env.AI_CUSTOM_PROVIDER_NAME !== undefined && {
      customProviderName: env.AI_CUSTOM_PROVIDER_NAME,
    }),
    customSupportsStructuredOutputs: env.AI_CUSTOM_SUPPORTS_STRUCTURED_OUTPUTS,
  };
}

/**
 * Gateway string vs `createOpenAICompatible` (TDD §2.6.8b). Which transport is active is
 * presence-based, not a separate mode flag: `cfg.customBaseUrl` set switches both AI features to
 * the custom endpoint; unset falls through to the AI Gateway's default global provider, which
 * accepts the bare `"provider/model"` string form directly.
 *
 * Return type is `LanguageModel` alone, not `string | LanguageModel` as TDD §2.6.8b's
 * illustrative snippet has it: `ai@7.0.93`'s `LanguageModel` already includes an open
 * `(string & {})` constituent (via `GatewayModelId`), so a bare string is already structurally
 * assignable to it — adding `string` to the union is redundant and
 * `@typescript-eslint/no-redundant-type-constituents` (build-blocking, §7.2) rejects it.
 *
 * `fetchImpl` defaults to `globalThis.fetch` and exists solely so the custom-transport unit test
 * can inject a mock without a network call (§14, §17) — production never supplies it.
 */
export function resolveModel(
  modelId: string,
  cfg: AiTransportConfig,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): LanguageModel {
  if (cfg.customBaseUrl !== undefined) {
    const provider = createOpenAICompatible({
      name: cfg.customProviderName ?? 'custom',
      baseURL: cfg.customBaseUrl,
      // exactOptionalPropertyTypes treats an explicit `undefined` as distinct from "key
      // absent" — spreading only assigns the key when there is a real value.
      ...(cfg.customApiKey !== undefined && { apiKey: cfg.customApiKey }),
      // Already a boolean by the time it reaches here (the app's Zod schema parses it, §16).
      supportsStructuredOutputs: cfg.customSupportsStructuredOutputs,
      fetch: fetchImpl,
    });
    return provider(modelId);
  }

  return modelId;
}
