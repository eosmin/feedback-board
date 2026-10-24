import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BOARD_FILTERS,
  applyBoardFilters,
  hasActiveFilters,
  parseBoardFilters,
  writeBoardFilters,
} from '../../../lib/board-filters';
import { makeBoardPost } from '../support/board-fixtures';

describe('parseBoardFilters', () => {
  it('reads every filter from the query string', () => {
    const filters = parseBoardFilters(
      new URLSearchParams('q=dark&sort=votes&status=PLANNED&category=UX&priority=HIGH'),
    );

    expect(filters).toEqual({
      query: 'dark',
      sort: 'votes',
      status: 'PLANNED',
      category: 'UX',
      priority: 'HIGH',
    });
  });

  it('falls back to the defaults for an empty query string', () => {
    expect(parseBoardFilters(new URLSearchParams())).toEqual(DEFAULT_BOARD_FILTERS);
  });

  it('ignores values that are not allowed, such as a stale or hand-edited URL', () => {
    const filters = parseBoardFilters(
      new URLSearchParams('sort=oldest&status=ARCHIVED&category=bug&priority=URGENT'),
    );

    expect(filters).toEqual(DEFAULT_BOARD_FILTERS);
  });
});

describe('writeBoardFilters', () => {
  it('writes only what differs from the defaults', () => {
    const params = new URLSearchParams();

    writeBoardFilters(params, { ...DEFAULT_BOARD_FILTERS, query: 'dark', status: 'DONE' });

    expect(params.toString()).toBe('q=dark&status=DONE');
  });

  it('removes a key that goes back to its default and keeps keys it does not own', () => {
    const params = new URLSearchParams('post=abc&q=dark&sort=votes&priority=LOW');

    writeBoardFilters(params, DEFAULT_BOARD_FILTERS);

    expect(params.toString()).toBe('post=abc');
  });

  it('round-trips through parse', () => {
    const filters = {
      query: 'a b&c',
      sort: 'votes' as const,
      status: 'IN_PROGRESS' as const,
      category: 'FEATURE_REQUEST' as const,
      priority: 'MEDIUM' as const,
    };
    const params = new URLSearchParams();

    writeBoardFilters(params, filters);

    expect(parseBoardFilters(new URLSearchParams(params.toString()))).toEqual(filters);
  });
});

describe('hasActiveFilters', () => {
  it('is false for the defaults and for a changed sort alone', () => {
    expect(hasActiveFilters(DEFAULT_BOARD_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_BOARD_FILTERS, sort: 'votes' })).toBe(false);
  });

  it('is false for a whitespace-only search', () => {
    expect(hasActiveFilters({ ...DEFAULT_BOARD_FILTERS, query: '   ' })).toBe(false);
  });

  it.each([
    { query: 'dark' },
    { status: 'OPEN' as const },
    { category: 'BUG' as const },
    { priority: 'LOW' as const },
  ])('is true when %o is set', (override) => {
    expect(hasActiveFilters({ ...DEFAULT_BOARD_FILTERS, ...override })).toBe(true);
  });
});

describe('applyBoardFilters', () => {
  const older = makeBoardPost({
    id: 'a',
    title: 'Export to CSV',
    body: 'Let me download my data.',
    authorName: 'Ada',
    voteCount: 9,
    status: 'PLANNED',
    aiCategory: 'FEATURE_REQUEST',
    aiPriority: 'HIGH',
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  const newer = makeBoardPost({
    id: 'b',
    title: 'Button misaligned',
    body: 'On the settings page.',
    authorName: 'Grace',
    voteCount: 2,
    status: 'OPEN',
    aiCategory: 'BUG',
    aiPriority: 'LOW',
    createdAt: '2026-02-01T00:00:00.000Z',
  });
  const posts = [older, newer];

  it('sorts newest first by default and does not mutate its input', () => {
    expect(applyBoardFilters(posts, DEFAULT_BOARD_FILTERS).map((p) => p.id)).toEqual(['b', 'a']);
    expect(posts.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('sorts by votes, breaking ties by newest', () => {
    const tied = makeBoardPost({ id: 'c', voteCount: 9, createdAt: '2026-03-01T00:00:00.000Z' });

    const result = applyBoardFilters([older, newer, tied], {
      ...DEFAULT_BOARD_FILTERS,
      sort: 'votes',
    });

    expect(result.map((p) => p.id)).toEqual(['c', 'a', 'b']);
  });

  it('keeps a stable order for equal timestamps', () => {
    const one = makeBoardPost({ id: 'x', createdAt: '2026-01-01T00:00:00.000Z' });
    const two = makeBoardPost({ id: 'y', createdAt: '2026-01-01T00:00:00.000Z' });

    expect(applyBoardFilters([two, one], DEFAULT_BOARD_FILTERS).map((p) => p.id)).toEqual([
      'x',
      'y',
    ]);
    expect(applyBoardFilters([one, two], DEFAULT_BOARD_FILTERS).map((p) => p.id)).toEqual([
      'x',
      'y',
    ]);
  });

  it('searches title, body and author, ignoring case and surrounding spaces', () => {
    const run = (query: string): string[] =>
      applyBoardFilters(posts, { ...DEFAULT_BOARD_FILTERS, query }).map((p) => p.id);

    expect(run('  CSV ')).toEqual(['a']);
    expect(run('settings')).toEqual(['b']);
    expect(run('grace')).toEqual(['b']);
    expect(run('nothing like this')).toEqual([]);
  });

  it('filters by status, category and priority, and combines them', () => {
    const run = (override: Partial<typeof DEFAULT_BOARD_FILTERS>): string[] =>
      applyBoardFilters(posts, { ...DEFAULT_BOARD_FILTERS, ...override }).map((p) => p.id);

    expect(run({ status: 'PLANNED' })).toEqual(['a']);
    expect(run({ category: 'BUG' })).toEqual(['b']);
    expect(run({ priority: 'HIGH' })).toEqual(['a']);
    expect(run({ status: 'PLANNED', category: 'BUG' })).toEqual([]);
  });

  it('never matches an unclassified post against a category or priority filter', () => {
    const unclassified = makeBoardPost({ id: 'u', aiCategory: null, aiPriority: null });

    expect(
      applyBoardFilters([unclassified], { ...DEFAULT_BOARD_FILTERS, category: 'BUG' }),
    ).toEqual([]);
    expect(
      applyBoardFilters([unclassified], { ...DEFAULT_BOARD_FILTERS, priority: 'LOW' }),
    ).toEqual([]);
  });
});
