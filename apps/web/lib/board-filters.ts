import {
  POST_CATEGORIES,
  POST_PRIORITIES,
  POST_STATUSES,
  type BoardPost,
  type PostCategory,
  type PostPriority,
  type PostStatus,
} from '@feedback-board/shared';

export const POST_SORTS = ['newest', 'votes'] as const;

export type PostSort = (typeof POST_SORTS)[number];

export interface BoardFilters {
  query: string;
  sort: PostSort;
  status: PostStatus | null;
  category: PostCategory | null;
  priority: PostPriority | null;
}

export const DEFAULT_BOARD_FILTERS: BoardFilters = {
  query: '',
  sort: 'newest',
  status: null,
  category: null,
  priority: null,
};

/** The patch that clears search and the three filters and leaves the sort as it is. */
export const NO_FILTERS = {
  query: '',
  status: null,
  category: null,
  priority: null,
} satisfies Partial<BoardFilters>;

/** Reads one value that must be a member of `allowed`; anything else (a stale or hand-edited URL) is "no filter". */
function pickOne<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return allowed.find((candidate) => candidate === value) ?? null;
}

export function parseBoardFilters(params: URLSearchParams): BoardFilters {
  return {
    query: params.get('q') ?? '',
    sort: pickOne(params.get('sort'), POST_SORTS) ?? DEFAULT_BOARD_FILTERS.sort,
    status: pickOne(params.get('status'), POST_STATUSES),
    category: pickOne(params.get('category'), POST_CATEGORIES),
    priority: pickOne(params.get('priority'), POST_PRIORITIES),
  };
}

/** Writes the filters into `params`, dropping every default so a clean board has a clean URL. Other keys are left alone. */
export function writeBoardFilters(params: URLSearchParams, filters: BoardFilters): void {
  const entries: Array<[string, string | null]> = [
    ['q', filters.query === '' ? null : filters.query],
    ['sort', filters.sort === DEFAULT_BOARD_FILTERS.sort ? null : filters.sort],
    ['status', filters.status],
    ['category', filters.category],
    ['priority', filters.priority],
  ];

  for (const [key, value] of entries) {
    if (value === null) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }
}

/** Sorting is a view choice, not a narrowing: only search and the three filters count. */
export function hasActiveFilters(filters: BoardFilters): boolean {
  return (
    filters.query.trim() !== '' ||
    filters.status !== null ||
    filters.category !== null ||
    filters.priority !== null
  );
}

function matchesQuery(post: BoardPost, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return true;
  }
  return [post.title, post.body, post.authorName].some((field) =>
    field.toLowerCase().includes(needle),
  );
}

// Newest first, with the id as the last tie-break so two posts with the same timestamp keep one
// order across renders and reloads.
function byNewest(a: BoardPost, b: BoardPost): number {
  return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
}

function byVotes(a: BoardPost, b: BoardPost): number {
  return b.voteCount - a.voteCount || byNewest(a, b);
}

export function applyBoardFilters(posts: BoardPost[], filters: BoardFilters): BoardPost[] {
  return posts
    .filter(
      (post) =>
        matchesQuery(post, filters.query) &&
        (filters.status === null || post.status === filters.status) &&
        (filters.category === null || post.aiCategory === filters.category) &&
        (filters.priority === null || post.aiPriority === filters.priority),
    )
    .sort(filters.sort === 'votes' ? byVotes : byNewest);
}
