'use client';

import {
  POST_CATEGORIES,
  POST_PRIORITIES,
  POST_STATUSES,
  type PostCategory,
  type PostPriority,
  type PostStatus,
} from '@feedback-board/shared';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';

import { POST_SORTS, type BoardFilters, type PostSort } from '../../lib/board-filters';
import { Input, Select } from '../ui';

/** `Select` reserves the empty string, so "no filter" travels as this sentinel. */
const ALL = 'ALL';

interface PostFiltersProps {
  filters: BoardFilters;
  /** Receives only what changed; the owner merges it into the URL as it is then. */
  onChange: (patch: Partial<BoardFilters>) => void;
  shown: number;
  total: number;
}

/**
 * How long typing must pause before the search reaches the URL. Every URL write is two
 * `history.replaceState` calls (ours and the router's own sync), and Safari throws a
 * `SecurityError` past about 100 of them in 30 seconds, which a long search typed key by key
 * would reach.
 */
const SEARCH_DEBOUNCE_MS = 250;

function narrow<T extends string>(value: string, allowed: readonly T[]): T | null {
  return allowed.find((candidate) => candidate === value) ?? null;
}

/**
 * Search, sort and the three filters above the post list. The state lives in the URL
 * (`useBoardUrlState`), so this renders whatever it is given and reports each change; the search
 * box alone keeps a draft of its own and reports once typing pauses.
 */
export function PostFilters({ filters, onChange, shown, total }: PostFiltersProps): ReactElement {
  const t = useTranslations('dashboard.boardDetail.filters');
  const tStatus = useTranslations('publicBoard.status');
  const tCategory = useTranslations('publicBoard.category');
  const tPriority = useTranslations('publicBoard.priority');
  // What the box shows. The URL gets it after a pause, so typing never waits on the router.
  const [draft, setDraft] = useState(filters.query);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Typed but not yet reported (and on which page), and the last value this box wrote to the URL.
  const unreported = useRef<string | null>(null);
  const typedOnPath = useRef<string | null>(null);
  const lastWritten = useRef<string | null>(null);
  // Read by the timer and the unmount cleanup, which run later than the render that made them.
  const latest = useRef({ query: filters.query, onChange });
  useEffect(() => {
    latest.current = { query: filters.query, onChange };
  });

  function cancelPending(): void {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    unreported.current = null;
  }

  // Unmounting with a keystroke still waiting reports it instead of dropping what was typed, but
  // only while the page is still the one it was typed on: when the unmount is a route change, the
  // URL already belongs to the next page and a write would put `?q=` on it.
  useEffect(
    () => () => {
      const waiting = unreported.current;
      const samePage = window.location.pathname === typedOnPath.current;
      cancelPending();
      if (waiting !== null && samePage && waiting !== latest.current.query) {
        latest.current.onChange({ query: waiting });
      }
    },
    [],
  );

  // The URL's query changed. If it is this box's own write coming back, the box is already there
  // (or ahead of it, if typing went on). Anything else (Clear filters, back) wins over a keystroke
  // still waiting, which is cancelled so it cannot put the old text back.
  useEffect(() => {
    if (filters.query === lastWritten.current) {
      return;
    }
    cancelPending();
    setDraft(filters.query);
  }, [filters.query]);

  function handleSearch(value: string): void {
    setDraft(value);
    unreported.current = value;
    typedOnPath.current = window.location.pathname;
    if (timer.current !== null) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => {
      timer.current = null;
      unreported.current = null;
      lastWritten.current = value;
      latest.current.onChange({ query: value });
    }, SEARCH_DEBOUNCE_MS);
  }

  return (
    <section aria-label={t('region')} className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative lg:min-w-48 lg:flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label={t('search')}
            placeholder={t('searchPlaceholder')}
            value={draft}
            onChange={(event) => handleSearch(event.target.value)}
            className="h-10 pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
          <Select
            aria-label={t('sortLabel')}
            className="w-full lg:w-auto"
            value={filters.sort}
            onValueChange={(value) =>
              onChange({ sort: narrow<PostSort>(value, POST_SORTS) ?? 'newest' })
            }
            options={POST_SORTS.map((sort) => ({ value: sort, label: t(`sort.${sort}`) }))}
          />
          <Select
            aria-label={t('statusLabel')}
            className="w-full lg:w-auto"
            value={filters.status ?? ALL}
            onValueChange={(value) =>
              onChange({ status: narrow<PostStatus>(value, POST_STATUSES) })
            }
            options={[
              { value: ALL, label: t('allStatuses') },
              ...POST_STATUSES.map((status) => ({ value: status, label: tStatus(status) })),
            ]}
          />
          <Select
            aria-label={t('categoryLabel')}
            className="w-full lg:w-auto"
            value={filters.category ?? ALL}
            onValueChange={(value) =>
              onChange({ category: narrow<PostCategory>(value, POST_CATEGORIES) })
            }
            options={[
              { value: ALL, label: t('allCategories') },
              ...POST_CATEGORIES.map((category) => ({
                value: category,
                label: tCategory(category),
              })),
            ]}
          />
          <Select
            aria-label={t('priorityLabel')}
            className="w-full lg:w-auto"
            value={filters.priority ?? ALL}
            onValueChange={(value) =>
              onChange({ priority: narrow<PostPriority>(value, POST_PRIORITIES) })
            }
            options={[
              { value: ALL, label: t('allPriorities') },
              ...POST_PRIORITIES.map((priority) => ({
                value: priority,
                label: tPriority(priority),
              })),
            ]}
          />
        </div>
      </div>
      <p role="status" className="text-caption text-text-muted">
        {t('results', { shown, total })}
      </p>
    </section>
  );
}
