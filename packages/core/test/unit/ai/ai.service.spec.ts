import { generateText } from 'ai';

import { AiService } from '../../../src/ai/ai.service';
import type { DigestPostInput } from '../../../src/ai/ai.service';

jest.mock('ai', () => ({
  // Explicit generic — `jest.requireActual`'s default type parameter is `any` (@types/jest),
  // which would make this factory's return an unsafe `any` under `no-unsafe-return` (§7.2).
  ...jest.requireActual<typeof import('ai')>('ai'),
  generateText: jest.fn(),
}));

const mockGenerateText = generateText as jest.MockedFunction<typeof generateText>;

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
  beforeEach(() => {
    mockGenerateText.mockReset();
  });

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

describe('AiService.generateDigest', () => {
  beforeEach(() => {
    mockGenerateText.mockReset();
  });

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
});
