import { describe, expect, it } from 'vitest';

import { voteToggleResultSchema } from '../../../src/schemas/vote';

const UUID = '3f1a7c2e-9b4d-4f8a-9c1e-7d5b2a6e0f43';

describe('voteToggleResultSchema', () => {
  it('accepts a vote that was added', () => {
    const result = voteToggleResultSchema.safeParse({ postId: UUID, voted: true, voteCount: 1 });

    expect(result.success).toBe(true);
  });

  it('accepts a vote that was withdrawn, leaving zero', () => {
    const result = voteToggleResultSchema.safeParse({ postId: UUID, voted: false, voteCount: 0 });

    expect(result.success).toBe(true);
  });

  it('rejects a negative count', () => {
    const result = voteToggleResultSchema.safeParse({ postId: UUID, voted: false, voteCount: -1 });

    expect(result.success).toBe(false);
  });

  it('rejects a missing toggle state', () => {
    expect(voteToggleResultSchema.safeParse({ postId: UUID, voteCount: 1 }).success).toBe(false);
  });
});
