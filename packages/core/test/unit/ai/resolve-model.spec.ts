import { resolveModel } from '../../../src/ai/resolve-model';

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
