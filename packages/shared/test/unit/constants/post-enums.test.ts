import { describe, expect, it } from 'vitest';

import {
  POST_CATEGORIES,
  POST_PRIORITIES,
  POST_STATUSES,
  type PostCategory,
  type PostPriority,
  type PostStatus,
} from '../../../src/constants/post-enums';

describe('post enums', () => {
  it('exposes the four categories', () => {
    expect(POST_CATEGORIES).toEqual(['BUG', 'FEATURE_REQUEST', 'UX', 'OTHER']);
  });

  it('exposes the three priorities', () => {
    expect(POST_PRIORITIES).toEqual(['LOW', 'MEDIUM', 'HIGH']);
  });

  it('exposes the five lifecycle statuses', () => {
    expect(POST_STATUSES).toEqual(['OPEN', 'PLANNED', 'IN_PROGRESS', 'DONE', 'CLOSED']);
  });

  it('keeps the AI enums disjoint from the lifecycle status', () => {
    const statuses: readonly string[] = POST_STATUSES;
    const aiValues: readonly string[] = [...POST_CATEGORIES, ...POST_PRIORITIES];

    expect(aiValues.some((value) => statuses.includes(value))).toBe(false);
  });

  it('infers each member type from its tuple', () => {
    const category: PostCategory = 'BUG';
    const priority: PostPriority = 'HIGH';
    const status: PostStatus = 'PLANNED';

    expect([category, priority, status]).toEqual(['BUG', 'HIGH', 'PLANNED']);
  });
});
