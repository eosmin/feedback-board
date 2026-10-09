import { Logger } from '@nestjs/common';
import { APICallError, generateText, NoObjectGeneratedError, RetryError } from 'ai';

import { AiService } from '../../../src/ai/ai.service';
import type { DigestPostInput } from '../../../src/ai/ai.service';

jest.mock('ai', () => ({
  // Explicit generic — `jest.requireActual`'s default type parameter is `any` (@types/jest),
  // which would make this factory's return an unsafe `any` under `no-unsafe-return` (§7.2).
  ...jest.requireActual<typeof import('ai')>('ai'),
  generateText: jest.fn(),
}));

const mockGenerateText = generateText as jest.MockedFunction<typeof generateText>;

let warn: jest.SpyInstance;

beforeEach(() => {
  mockGenerateText.mockReset();
  warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  warn.mockRestore();
});

const baseOptions = {
  classifyModel: 'anthropic/claude-haiku-4.5',
  digestModel: 'anthropic/claude-sonnet-5',
  transport: { customSupportsStructuredOutputs: true },
};

/**
 * `expect.stringContaining()` is typed `(str: string): any` in `@types/jest`, so assigning its
 * result directly as an object-literal property value trips `no-unsafe-assignment` (§7.2). An
 * explicitly `unknown`-typed return here is an any-to-unknown assignment, which the rule allows.
 */
function promptContaining(substring: string): { prompt: unknown } {
  return { prompt: expect.stringContaining(substring) };
}

describe('AiService.classifyPost', () => {
  it('returns the parsed classification on success (Gateway / structured-output path)', async () => {
    mockGenerateText.mockResolvedValue({
      output: { category: 'BUG', priority: 'HIGH' },
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    const service = new AiService(baseOptions);
    const result = await service.classifyPost('Crash on save', 'App crashes when saving');

    expect(result).toEqual({ category: 'BUG', priority: 'HIGH' });
  });

  it('returns null when generateText throws (rate limit, network, refusal)', async () => {
    mockGenerateText.mockRejectedValue(new Error('rate limited'));

    const service = new AiService(baseOptions);
    const result = await service.classifyPost('Title', 'Body');

    expect(result).toBeNull();
  });

  it('falls back to a plain-JSON prompt when the custom transport lacks structured outputs', async () => {
    mockGenerateText.mockResolvedValue({
      text: '{"category":"UX","priority":"LOW"}',
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    const service = new AiService({
      ...baseOptions,
      transport: {
        customBaseUrl: 'http://localhost:11434/v1',
        customSupportsStructuredOutputs: false,
      },
    });

    const result = await service.classifyPost('Title', 'Body');

    expect(result).toEqual({ category: 'UX', priority: 'LOW' });
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining(promptContaining('ONLY a JSON object')),
    );
  });

  it('returns null when the plain-JSON fallback response fails schema validation', async () => {
    mockGenerateText.mockResolvedValue({
      text: '{"category":"NOT_A_CATEGORY","priority":"LOW"}',
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    const service = new AiService({
      ...baseOptions,
      transport: {
        customBaseUrl: 'http://localhost:11434/v1',
        customSupportsStructuredOutputs: false,
      },
    });

    const result = await service.classifyPost('Title', 'Body');

    expect(result).toBeNull();
  });

  it('returns null when the plain-JSON fallback response is not valid JSON', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'not json at all',
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    const service = new AiService({
      ...baseOptions,
      transport: {
        customBaseUrl: 'http://localhost:11434/v1',
        customSupportsStructuredOutputs: false,
      },
    });

    const result = await service.classifyPost('Title', 'Body');

    expect(result).toBeNull();
  });
});

describe('AiService.classifyPost failure logging', () => {
  const fallbackOptions = {
    ...baseOptions,
    transport: {
      customBaseUrl: 'http://localhost:11434/v1',
      customSupportsStructuredOutputs: false,
    },
  };
  const apiCallError = (message: string, statusCode: number): APICallError =>
    new APICallError({
      message,
      url: 'https://proxy.example.com/v1/chat/completions',
      requestBodyValues: {},
      statusCode,
    });

  it('unwraps the provider error behind a RetryError once retries run out', async () => {
    mockGenerateText.mockRejectedValue(
      new RetryError({
        message: 'Failed after 3 attempts',
        reason: 'maxRetriesExceeded',
        errors: [apiCallError('rate limit exceeded', 429)],
      }),
    );

    await new AiService(baseOptions).classifyPost('Title', 'Body');

    expect(warn).toHaveBeenCalledWith(
      'classification failed: AI_RetryError (maxRetriesExceeded): AI_APICallError (status 429): rate limit exceeded',
    );
  });

  it('truncates a long provider message', async () => {
    mockGenerateText.mockRejectedValue(apiCallError('x'.repeat(500), 400));

    await new AiService(baseOptions).classifyPost('Title', 'Body');

    expect(warn).toHaveBeenCalledWith(
      `classification failed: AI_APICallError (status 400): ${'x'.repeat(200)}...`,
    );
  });

  it('logs only the finish reason of a NoObjectGeneratedError, not its message or text', async () => {
    mockGenerateText.mockRejectedValue(
      new NoObjectGeneratedError({
        message: 'could not parse: secret post content',
        text: 'secret post content',
        response: { id: 'r', timestamp: new Date(0), modelId: 'm' },
        usage: {
          inputTokens: 1,
          inputTokenDetails: {
            noCacheTokens: undefined,
            cacheReadTokens: undefined,
            cacheWriteTokens: undefined,
          },
          outputTokens: 1,
          outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
          totalTokens: 2,
        },
        finishReason: 'length',
      }),
    );

    await new AiService(baseOptions).classifyPost('Title', 'Body');

    expect(warn).toHaveBeenCalledWith(
      'classification failed: AI_NoObjectGeneratedError (finish reason length)',
    );
  });

  it('logs the status and message of a provider error', async () => {
    mockGenerateText.mockRejectedValue(apiCallError('response_format is not supported', 400));

    await new AiService(baseOptions).classifyPost('Title', 'Body');

    expect(warn).toHaveBeenCalledWith(
      'classification failed: AI_APICallError (status 400): response_format is not supported',
    );
  });

  it('logs only the class name of any other error, never its message', async () => {
    mockGenerateText.mockRejectedValue(new Error('secret post content'));

    await new AiService(baseOptions).classifyPost('Title', 'Body');

    expect(warn).toHaveBeenCalledWith('classification failed: Error');
  });

  it('logs a generic label when the thrown value is not an Error', async () => {
    mockGenerateText.mockRejectedValue('boom');

    await new AiService(baseOptions).classifyPost('Title', 'Body');

    expect(warn).toHaveBeenCalledWith('classification failed: unknown error');
  });

  it('does not echo model output when the fallback response is not valid JSON', async () => {
    mockGenerateText.mockResolvedValue({
      text: '```json {"category":"UX"} ```',
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    await new AiService(fallbackOptions).classifyPost('Title', 'Body');

    expect(warn).toHaveBeenCalledWith('classification failed: SyntaxError');
  });

  it('logs a schema failure from the fallback response', async () => {
    mockGenerateText.mockResolvedValue({
      text: '{"category":"NOT_A_CATEGORY","priority":"LOW"}',
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    await new AiService(fallbackOptions).classifyPost('Title', 'Body');

    expect(warn).toHaveBeenCalledWith(
      'classification response failed schema validation (category:invalid_value)',
    );
  });
});

describe('AiService.generateDigest', () => {
  it('returns plain text built from the given posts', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'Users mostly want dark mode.',
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    const service = new AiService(baseOptions);
    const posts: DigestPostInput[] = [
      {
        title: 'Dark mode',
        body: 'Please add it',
        voteCount: 12,
        category: 'UX',
        priority: 'HIGH',
      },
      { title: 'Export CSV', body: 'For reports', voteCount: 3, category: null, priority: null },
    ];

    const result = await service.generateDigest(posts);

    expect(result).toBe('Users mostly want dark mode.');
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        maxOutputTokens: 1024,
        ...promptContaining('Dark mode'),
      }),
    );
  });

  it('propagates a generateText failure — the digest is user-triggered, not a background job', async () => {
    mockGenerateText.mockRejectedValue(new Error('model unavailable'));

    const service = new AiService(baseOptions);

    await expect(service.generateDigest([])).rejects.toThrow('model unavailable');
  });

  it('defaults to an English system prompt that forbids asking the caller for posts', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'Users mostly want dark mode.',
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    const service = new AiService(baseOptions);
    await service.generateDigest([]);

    const [call] = mockGenerateText.mock.calls[0] as [{ system: string }];
    expect(call.system).toContain('English');
    expect(call.system).toContain('never ask for');
  });

  it('asks the model to answer in the language mapped from the Accept-Language header', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'A los usuarios les gustaría el modo oscuro.',
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    const service = new AiService(baseOptions);
    await service.generateDigest([], 'es-MX,es;q=0.9,en;q=0.8');

    const [call] = mockGenerateText.mock.calls[0] as [{ system: string }];
    expect(call.system).toContain('Spanish');
  });

  it('falls back to English for an unrecognized or missing Accept-Language', async () => {
    mockGenerateText.mockResolvedValue({ text: 'Digest.' } as unknown as Awaited<
      ReturnType<typeof generateText>
    >);

    const service = new AiService(baseOptions);
    await service.generateDigest([], 'fr-FR');

    const [call] = mockGenerateText.mock.calls[0] as [{ system: string }];
    expect(call.system).toContain('English');
  });
});
