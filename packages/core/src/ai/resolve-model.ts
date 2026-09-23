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
      // `exactOptionalPropertyTypes: true` (tsconfig.base.json) treats an explicit `undefined`
      // as a distinct value from "key absent" — spreading only assigns the key when there is a
      // real value, keeping `apiKey?: string` satisfied without a cast.
      ...(cfg.customApiKey !== undefined && { apiKey: cfg.customApiKey }),
      // A boolean by the time it reaches here (the app's Zod schema parses it, §16) — comparing
      // against a string ("!== 'false'") against an already-coerced value is always true and
      // would make this flag silently dead.
      supportsStructuredOutputs: cfg.customSupportsStructuredOutputs,
      fetch: fetchImpl,
    });
    return provider(modelId);
  }

  return modelId;
}
