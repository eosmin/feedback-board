'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import { parseBoardFilters, writeBoardFilters, type BoardFilters } from './board-filters';

const POST_PARAM = 'post';

export interface BoardUrlState {
  filters: BoardFilters;
  /** The post open in the drawer, or `null`. May name a post that is not on this board. */
  selectedPostId: string | null;
  /** Changes only the given filters; the rest are read from the URL as it is at that moment. */
  setFilters: (patch: Partial<BoardFilters>) => void;
  setSelectedPostId: (postId: string | null) => void;
}

/**
 * The board view's search, sort, filters and open post live in the query string, so a filtered
 * view survives a reload and can be shared. Writes go through `history.replaceState`, which the
 * Next router syncs into `useSearchParams` without a navigation: no server round trip, no
 * progress bar, and no history entry per keystroke. Params this hook does not own are kept.
 */
export function useBoardUrlState(): BoardUrlState {
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  const filters = useMemo(() => parseBoardFilters(new URLSearchParams(search)), [search]);
  const selectedPostId = useMemo(() => new URLSearchParams(search).get(POST_PARAM), [search]);

  const write = useCallback((update: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(window.location.search);
    update(params);
    const next = params.toString();
    window.history.replaceState(null, '', next === '' ? window.location.pathname : `?${next}`);
  }, []);

  // A patch is merged into what the URL holds now, not into what the caller last rendered: two
  // changes made before the router re-renders (a search that has just fired and a filter chosen
  // in the same moment) would otherwise overwrite each other with their stale copy.
  const setFilters = useCallback(
    (patch: Partial<BoardFilters>) =>
      write((params) => writeBoardFilters(params, { ...parseBoardFilters(params), ...patch })),
    [write],
  );

  const setSelectedPostId = useCallback(
    (postId: string | null) =>
      write((params) => {
        if (postId === null) {
          params.delete(POST_PARAM);
        } else {
          params.set(POST_PARAM, postId);
        }
      }),
    [write],
  );

  return { filters, selectedPostId, setFilters, setSelectedPostId };
}
