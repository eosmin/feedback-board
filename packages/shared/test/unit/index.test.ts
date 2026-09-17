import { describe, expect, it } from 'vitest';

import * as shared from '../../src/index';

describe('package barrel', () => {
  it('re-exports the constants both the API and the web consume', () => {
    expect(shared.PLAN_LIMITS.FREE.boards).toBe(1);
    expect(shared.ERROR_CODES.PLAN_LIMIT).toBe('PLAN_LIMIT');
    expect(shared.ROLES).toContain('OWNER');
    expect(shared.POST_STATUSES).toContain('OPEN');
    expect(shared.WEBHOOK_EVENTS).toContain('post.created');
  });

  it('re-exports every schema module', () => {
    expect(shared.createOrgSchema).toBeDefined();
    expect(shared.createBoardSchema).toBeDefined();
    expect(shared.createPostSchema).toBeDefined();
    expect(shared.voteToggleResultSchema).toBeDefined();
    expect(shared.createCommentSchema).toBeDefined();
    expect(shared.createWebhookSchema).toBeDefined();
    expect(shared.subscriptionSchema).toBeDefined();
  });

  it('exports no name twice, which a star re-export would silently drop', () => {
    const names = Object.keys(shared);

    expect(new Set(names).size).toBe(names.length);
  });
});
