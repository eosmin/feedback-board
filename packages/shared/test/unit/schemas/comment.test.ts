import { describe, expect, it } from 'vitest';

import { commentSchema, createCommentSchema } from '../../../src/schemas/comment';

const UUID = '3f1a7c2e-9b4d-4f8a-9c1e-7d5b2a6e0f43';
const CREATED_AT = '2026-09-07T10:15:00.000Z';

describe('createCommentSchema', () => {
  it('accepts a comment', () => {
    expect(createCommentSchema.safeParse({ body: 'Agreed.' }).success).toBe(true);
  });

  it('trims the body', () => {
    const result = createCommentSchema.safeParse({ body: '  Agreed.  ' });

    expect(result.success && result.data.body).toBe('Agreed.');
  });

  it('rejects a whitespace-only body', () => {
    expect(createCommentSchema.safeParse({ body: '   ' }).success).toBe(false);
  });

  it('rejects a body beyond five thousand characters', () => {
    expect(createCommentSchema.safeParse({ body: 'a'.repeat(5_001) }).success).toBe(false);
  });
});

describe('commentSchema', () => {
  const comment = {
    id: UUID,
    postId: UUID,
    orgId: UUID,
    authorId: UUID,
    body: 'Agreed.',
    createdAt: CREATED_AT,
  };

  it('accepts a persisted comment', () => {
    expect(commentSchema.safeParse(comment).success).toBe(true);
  });

  it('rejects a missing author', () => {
    const { authorId: _authorId, ...withoutAuthor } = comment;

    expect(commentSchema.safeParse(withoutAuthor).success).toBe(false);
  });

  it('rejects a non-ISO timestamp', () => {
    expect(commentSchema.safeParse({ ...comment, createdAt: 'yesterday' }).success).toBe(false);
  });
});
