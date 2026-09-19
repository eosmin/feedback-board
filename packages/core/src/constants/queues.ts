/**
 * Exactly two queues, two job types (TDD §3.10). Adding a third is a design change, not a
 * detail (§1.5). No string literal for a queue or job name may appear anywhere else in the
 * codebase — every producer and every processor imports from here.
 */

export const QUEUES = {
  WEBHOOKS: 'webhooks',
  AI_CLASSIFY: 'ai-classify',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export const JOBS = {
  DELIVER: 'deliver',
  CLASSIFY: 'classify',
} as const;

export type JobName = (typeof JOBS)[keyof typeof JOBS];
