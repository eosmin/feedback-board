import { UnrecoverableError } from 'bullmq';
import type { Job } from 'bullmq';
import type { AiService, PinoLogger, TenantRunner } from '@feedback-board/core';

import { AiClassifyProcessor } from '../../../src/processors/ai-classify.processor';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const POST_ID = '22222222-2222-4222-8222-222222222222';

function buildRunner(overrides: { findFirst?: jest.Mock; update?: jest.Mock }): {
  runner: TenantRunner;
  runAs: jest.Mock;
} {
  const runAs = jest.fn(async (_orgId: string, fn: (tx: unknown) => unknown) => {
    const tx = {
      post: {
        findFirst: overrides.findFirst ?? jest.fn(),
        update: overrides.update ?? jest.fn(),
      },
    };
    return fn(tx);
  });
  return { runner: { runAs } as unknown as TenantRunner, runAs };
}

/**
 * `runInContext` runs its callback inside an `AsyncLocalStorage` context in the real
 * `nestjs-pino` implementation (TDD §2.6.16) — this mock must actually invoke and await `fn`,
 * not just record the call, or `process()`'s own logic (the code under test) never runs.
 */
function buildLogger(): { logger: PinoLogger; warn: jest.Mock; runInContext: jest.Mock } {
  const warn = jest.fn();
  const setContext = jest.fn();
  const runInContext = jest.fn(
    async (fn: () => Promise<void>, _options: { bindings: Record<string, unknown> }) => fn(),
  );
  const logger = { warn, setContext, runInContext } as unknown as PinoLogger;
  return { logger, warn, runInContext };
}

function buildJob(data: unknown): Job {
  return { id: 'job-1', data } as Job;
}

describe('AiClassifyProcessor', () => {
  it('sets the PinoLogger context to its own class name on construction', () => {
    const { runner } = buildRunner({});
    const aiService = { classifyPost: jest.fn() } as unknown as AiService;
    const { logger } = buildLogger();

    new AiClassifyProcessor(runner, aiService, logger);

    expect(logger.setContext).toHaveBeenCalledWith('AiClassifyProcessor');
  });

  it('runs the job inside a PinoLogger context bound to the queue and job id', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const { runner } = buildRunner({ findFirst });
    const aiService = { classifyPost: jest.fn() } as unknown as AiService;
    const { logger, runInContext } = buildLogger();
    const processor = new AiClassifyProcessor(runner, aiService, logger);

    await processor.process(buildJob({ orgId: ORG_ID, postId: POST_ID }));

    expect(runInContext).toHaveBeenCalledWith(expect.any(Function), {
      bindings: { queue: 'ai-classify', jobId: 'job-1' },
    });
  });

  it('throws UnrecoverableError and never opens a transaction when the payload fails validation', async () => {
    const { runner, runAs } = buildRunner({});
    const aiService = { classifyPost: jest.fn() } as unknown as AiService;
    const { logger } = buildLogger();
    const processor = new AiClassifyProcessor(runner, aiService, logger);

    await expect(processor.process(buildJob({ orgId: 'not-a-uuid' }))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(runAs).not.toHaveBeenCalled();
  });

  it('skips classification and logs when the post no longer exists under the org', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const { runner } = buildRunner({ findFirst });
    const classifyPost = jest.fn();
    const aiService = { classifyPost } as unknown as AiService;
    const { logger, warn } = buildLogger();
    const processor = new AiClassifyProcessor(runner, aiService, logger);

    await processor.process(buildJob({ orgId: ORG_ID, postId: POST_ID }));

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: POST_ID },
      select: { title: true, body: true },
    });
    expect(classifyPost).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      `ai-classify: post ${POST_ID} not found in org ${ORG_ID}, skipping`,
    );
  });

  it('writes the classification back through runAs when it succeeds', async () => {
    const findFirst = jest.fn().mockResolvedValue({ title: 'Crash on save', body: 'It crashes' });
    const update = jest.fn().mockResolvedValue(undefined);
    const { runner, runAs } = buildRunner({ findFirst, update });
    const classifyPost = jest.fn().mockResolvedValue({ category: 'BUG', priority: 'HIGH' });
    const aiService = { classifyPost } as unknown as AiService;
    const { logger } = buildLogger();
    const processor = new AiClassifyProcessor(runner, aiService, logger);

    await processor.process(buildJob({ orgId: ORG_ID, postId: POST_ID }));

    expect(runAs).toHaveBeenCalledWith(ORG_ID, expect.any(Function));
    expect(classifyPost).toHaveBeenCalledWith('Crash on save', 'It crashes');
    expect(update).toHaveBeenCalledWith({
      where: { id: POST_ID },
      data: { aiCategory: 'BUG', aiPriority: 'HIGH' },
    });
  });

  it('leaves the post untouched and logs when classification fails — AI is an enhancement, never blocking', async () => {
    const findFirst = jest.fn().mockResolvedValue({ title: 'Title', body: 'Body' });
    const update = jest.fn();
    const { runner } = buildRunner({ findFirst, update });
    const classifyPost = jest.fn().mockResolvedValue(null);
    const aiService = { classifyPost } as unknown as AiService;
    const { logger, warn } = buildLogger();
    const processor = new AiClassifyProcessor(runner, aiService, logger);

    await processor.process(buildJob({ orgId: ORG_ID, postId: POST_ID }));

    expect(update).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      `ai-classify: classification failed for post ${POST_ID}, leaving null`,
    );
  });
});
