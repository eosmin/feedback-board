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
        customSupportsStructuredOutputs: false,
      },
      fetchImpl,
    );

    // createOpenAICompatible(...)('llama3') returns a LanguageModel, not the bare string.
    expect(result).not.toBe('llama3');
    expect(typeof result).toBe('object');
  });

  it('labels the provider "custom" and sends the configured key as a Bearer token', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'x',
          created: 0,
          model: 'llama3',
          choices: [
            { index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const model = resolveModel(
      'llama3',
      {
        customBaseUrl: 'https://proxy.example.com/v1',
        customApiKey: 'ck_secret',
        customSupportsStructuredOutputs: false,
      },
      fetchImpl,
    );

    if (typeof model === 'string') throw new Error('expected a LanguageModel, got a string');
    expect(model.provider).toBe('custom.chat');

    await model.doGenerate({ prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] });

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://proxy.example.com/v1/chat/completions');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer ck_secret');
  });
});

describe('buildAiTransportConfig', () => {
  it('omits every custom key when the optional env vars are undefined', () => {
    // Every field is required-but-possibly-undefined on AiCustomTransportEnv, matching how
    // Zod's `.optional()` actually infers under exactOptionalPropertyTypes: true (the key is
    // always present; only the value can be undefined) — so this call passes all three keys
    // explicitly, the same shape `apps/worker`'s and `apps/api`'s real `Env` objects have.
    const result = buildAiTransportConfig({
      AI_CUSTOM_BASE_URL: undefined,
      AI_CUSTOM_API_KEY: undefined,
      AI_CUSTOM_SUPPORTS_STRUCTURED_OUTPUTS: true,
    });

    expect(result).toEqual({ customSupportsStructuredOutputs: true });
    expect('customBaseUrl' in result).toBe(false);
    expect('customApiKey' in result).toBe(false);
  });

  it('carries every custom key through when all three env vars are set', () => {
    const result = buildAiTransportConfig({
      AI_CUSTOM_BASE_URL: 'http://localhost:11434/v1',
      AI_CUSTOM_API_KEY: 'key-1',
      AI_CUSTOM_SUPPORTS_STRUCTURED_OUTPUTS: false,
    });

    expect(result).toEqual({
      customBaseUrl: 'http://localhost:11434/v1',
      customApiKey: 'key-1',
      customSupportsStructuredOutputs: false,
    });
  });
});
