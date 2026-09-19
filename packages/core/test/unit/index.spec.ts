import * as core from '../../src/index';

// Exercises the barrel apps/api and apps/worker actually import from
// (`@feedback-board/core`, §2.2a) — a re-export file with no test never runs its own line.
describe('package entry point', () => {
  it('re-exports the queue and job-name constants', () => {
    expect(core.QUEUES.WEBHOOKS).toBe('webhooks');
    expect(core.QUEUES.AI_CLASSIFY).toBe('ai-classify');
    expect(core.JOBS.DELIVER).toBe('deliver');
    expect(core.JOBS.CLASSIFY).toBe('classify');
  });

  it('re-exports the job payload schemas', () => {
    expect(core.deliverWebhookJobSchema).toBeDefined();
    expect(core.classifyPostJobSchema).toBeDefined();
  });

  it('re-exports the AI classification schema', () => {
    expect(core.postClassificationSchema).toBeDefined();
  });
});
