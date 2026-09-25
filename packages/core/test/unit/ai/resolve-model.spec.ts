import { buildAiTransportConfig, resolveModel } from '../../../src/ai/resolve-model';

describe('resolveModel', () => {
  it('returns the bare model id string when no custom base URL is configured', () => {
    const result = resolveModel('anthropic/claude-haiku-4.5', {
      customSupportsStructuredOutputs: true,
    });

    expect(result).toBe('anthropic/claude-haiku-4.5');
  });

  it('returns a LanguageModel built from createOpenAICompatible when a custom base URL is set', () => {
    const fetchImpl = jest.fn() as unknown as typeof globalThis.fetch;

    const result = resolveModel(
      'llama3',
      {
        customBaseUrl: 'http://localhost:11434/v1',
        customApiKey: 'unused',
        customProviderName: 'ollama',
        customSupportsStructuredOutputs: false,
      },
      fetchImpl,
    );

    // createOpenAICompatible(...)('llama3') returns a LanguageModel, not the bare string.
    expect(result).not.toBe('llama3');
    expect(typeof result).toBe('object');
  });

  it('defaults the custom provider name to "custom" when none is given', () => {
    const fetchImpl = jest.fn() as unknown as typeof globalThis.fetch;

    const result = resolveModel(
      'some-model',
      { customBaseUrl: 'http://localhost:8080/v1', customSupportsStructuredOutputs: true },
      fetchImpl,
    );

    expect(result).not.toBe('some-model');
  });
});

describe('buildAiTransportConfig', () => {
  it('omits every custom key when the three optional env vars are undefined', () => {
    // Every field is required-but-possibly-undefined on AiCustomTransportEnv, matching how
    // Zod's `.optional()` actually infers under exactOptionalPropertyTypes: true (the key is
    // always present; only the value can be undefined) — so this call passes all four keys
    // explicitly, the same shape `apps/worker`'s and `apps/api`'s real `Env` objects have.
    const result = buildAiTransportConfig({
      AI_CUSTOM_BASE_URL: undefined,
      AI_CUSTOM_API_KEY: undefined,
      AI_CUSTOM_PROVIDER_NAME: undefined,
      AI_CUSTOM_SUPPORTS_STRUCTURED_OUTPUTS: true,
    });

    expect(result).toEqual({ customSupportsStructuredOutputs: true });
    expect('customBaseUrl' in result).toBe(false);
    expect('customApiKey' in result).toBe(false);
    expect('customProviderName' in result).toBe(false);
  });

  it('carries every custom key through when all four env vars are set', () => {
    const result = buildAiTransportConfig({
      AI_CUSTOM_BASE_URL: 'http://localhost:11434/v1',
      AI_CUSTOM_API_KEY: 'key-1',
      AI_CUSTOM_PROVIDER_NAME: 'ollama',
      AI_CUSTOM_SUPPORTS_STRUCTURED_OUTPUTS: false,
    });

    expect(result).toEqual({
      customBaseUrl: 'http://localhost:11434/v1',
      customApiKey: 'key-1',
      customProviderName: 'ollama',
      customSupportsStructuredOutputs: false,
    });
  });
});
