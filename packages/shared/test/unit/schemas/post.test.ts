import { describe, expect, it } from 'vitest';

import {
  createPostSchema,
  postSchema,
  publicPostSchema,
  updatePostStatusSchema,
} from '../../../src/schemas/post';

const UUID = '3f1a7c2e-9b4d-4f8a-9c1e-7d5b2a6e0f43';
const CREATED_AT = '2026-09-07T10:15:00.000Z';

const post = {
  id: UUID,
  boardId: UUID,
  orgId: UUID,
  authorId: UUID,
  title: 'Dark mode',
  body: 'The board is hard to read at night.',
  status: 'OPEN',
  voteCount: 0,
  aiCategory: null,
  aiPriority: null,
  createdAt: CREATED_AT,
};

describe('createPostSchema', () => {
  it('accepts a well-formed post', () => {
    expect(createPostSchema.safeParse({ title: 'Dark mode', body: 'Please.' }).success).toBe(true);
  });

  it('trims both fields', () => {
    const result = createPostSchema.safeParse({ title: '  Dark mode  ', body: '  Please.  ' });

    expect(result.success && result.data).toEqual({ title: 'Dark mode', body: 'Please.' });
  });

  it('rejects a title shorter than three characters', () => {
    expect(createPostSchema.safeParse({ title: 'Hi', body: 'Please.' }).success).toBe(false);
  });

  it('rejects an empty body', () => {
    expect(createPostSchema.safeParse({ title: 'Dark mode', body: '   ' }).success).toBe(false);
  });

  it('rejects a body beyond ten thousand characters', () => {
    const result = createPostSchema.safeParse({ title: 'Dark mode', body: 'a'.repeat(10_001) });

    expect(result.success).toBe(false);
  });

  it('does not accept a client-supplied status', () => {
    const result = createPostSchema.safeParse({
      title: 'Dark mode',
      body: 'Please.',
      status: 'DONE',
    });

    expect(result.success && 'status' in result.data).toBe(false);
  });
});

describe('updatePostStatusSchema', () => {
  it('accepts a member of the lifecycle enum', () => {
    expect(updatePostStatusSchema.safeParse({ status: 'IN_PROGRESS' }).success).toBe(true);
  });

  it('rejects a category, which is a different enum', () => {
    expect(updatePostStatusSchema.safeParse({ status: 'BUG' }).success).toBe(false);
  });

  it('rejects a missing status', () => {
    expect(updatePostStatusSchema.safeParse({}).success).toBe(false);
  });
});

describe('postSchema', () => {
  it('accepts an unclassified post', () => {
    expect(postSchema.safeParse(post).success).toBe(true);
  });

  it('accepts a classified post', () => {
    const classified = { ...post, aiCategory: 'FEATURE_REQUEST', aiPriority: 'HIGH' };

    expect(postSchema.safeParse(classified).success).toBe(true);
  });

  it('rejects a category outside the enum', () => {
    expect(postSchema.safeParse({ ...post, aiCategory: 'URGENT' }).success).toBe(false);
  });

  it('rejects a negative vote count', () => {
    expect(postSchema.safeParse({ ...post, voteCount: -1 }).success).toBe(false);
  });

  it('rejects a fractional vote count', () => {
    expect(postSchema.safeParse({ ...post, voteCount: 1.5 }).success).toBe(false);
  });
});

describe('publicPostSchema', () => {
  it('drops the author and the org from the public shape', () => {
    const result = publicPostSchema.safeParse(post);

    expect(result.success).toBe(true);
    expect(result.success && 'authorId' in result.data).toBe(false);
    expect(result.success && 'orgId' in result.data).toBe(false);
  });

  it('still requires the fields a public board renders', () => {
    const { authorId: _authorId, orgId: _orgId, title: _title, ...withoutTitle } = post;

    expect(publicPostSchema.safeParse(withoutTitle).success).toBe(false);
  });
});
