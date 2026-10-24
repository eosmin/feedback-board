import type { BoardPost, Comment } from '@feedback-board/shared';

export function makeBoardPost(overrides: Partial<BoardPost> = {}): BoardPost {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    boardId: '22222222-2222-4222-8222-222222222222',
    orgId: '33333333-3333-4333-8333-333333333333',
    authorId: '44444444-4444-4444-8444-444444444444',
    title: 'Add dark mode',
    body: 'Please add a dark theme.',
    status: 'OPEN',
    voteCount: 3,
    aiCategory: null,
    aiPriority: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    commentCount: 2,
    authorName: 'Ada Lovelace',
    ...overrides,
  };
}

export function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: '66666666-6666-4666-8666-666666666666',
    postId: '11111111-1111-4111-8111-111111111111',
    orgId: '33333333-3333-4333-8333-333333333333',
    authorId: '44444444-4444-4444-8444-444444444444',
    body: 'Great idea!',
    authorName: 'Grace Hopper',
    createdAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}
