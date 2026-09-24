import { describe, expect, it } from 'vitest';

import {
  boardDetailSchema,
  boardSchema,
  createBoardSchema,
  publicBoardSchema,
} from '../../../src/schemas/board';

const UUID = '3f1a7c2e-9b4d-4f8a-9c1e-7d5b2a6e0f43';
const CREATED_AT = '2026-09-07T10:15:00.000Z';

describe('createBoardSchema', () => {
  it('defaults a board to public', () => {
    const result = createBoardSchema.safeParse({ name: 'Roadmap', slug: 'roadmap' });

    expect(result.success).toBe(true);
    expect(result.success && result.data.isPublic).toBe(true);
  });

  it('honours an explicit private flag', () => {
    const result = createBoardSchema.safeParse({
      name: 'Internal',
      slug: 'internal',
      isPublic: false,
    });

    expect(result.success && result.data.isPublic).toBe(false);
  });

  it('accepts a slug that an org may not use, since board slugs are nested', () => {
    expect(createBoardSchema.safeParse({ name: 'API', slug: 'api' }).success).toBe(true);
  });

  it('rejects a malformed slug', () => {
    expect(createBoardSchema.safeParse({ name: 'Roadmap', slug: 'Road Map' }).success).toBe(false);
  });

  it('rejects a non-boolean visibility flag', () => {
    const result = createBoardSchema.safeParse({
      name: 'Roadmap',
      slug: 'roadmap',
      isPublic: 'yes',
    });

    expect(result.success).toBe(false);
  });
});

describe('boardSchema', () => {
  const board = {
    id: UUID,
    orgId: UUID,
    name: 'Roadmap',
    slug: 'roadmap',
    isPublic: true,
    createdAt: CREATED_AT,
  };

  it('accepts a persisted board', () => {
    expect(boardSchema.safeParse(board).success).toBe(true);
  });

  it('rejects a non-ISO timestamp', () => {
    expect(boardSchema.safeParse({ ...board, createdAt: '07/09/2026' }).success).toBe(false);
  });

  it('rejects an id that is not a uuid', () => {
    expect(boardSchema.safeParse({ ...board, id: 'board-1' }).success).toBe(false);
  });

  it('requires a post count on the detail shape', () => {
    expect(boardDetailSchema.safeParse(board).success).toBe(false);
    expect(boardDetailSchema.safeParse({ ...board, postCount: 0 }).success).toBe(true);
  });
});

describe('publicBoardSchema', () => {
  const board = {
    id: UUID,
    orgId: UUID,
    name: 'Roadmap',
    slug: 'roadmap',
    isPublic: true,
    createdAt: CREATED_AT,
  };

  it('drops the org id from the public shape', () => {
    const result = publicBoardSchema.safeParse(board);

    expect(result.success).toBe(true);
    expect(result.success && 'orgId' in result.data).toBe(false);
  });

  it('still requires the fields a public board renders', () => {
    const { orgId: _orgId, name: _name, ...withoutName } = board;

    expect(publicBoardSchema.safeParse(withoutName).success).toBe(false);
  });
});
