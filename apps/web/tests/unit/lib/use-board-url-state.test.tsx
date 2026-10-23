import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('next/navigation', () => import('../support/search-params'));

import { DEFAULT_BOARD_FILTERS, NO_FILTERS } from '../../../lib/board-filters';
import { useBoardUrlState, type BoardUrlState } from '../../../lib/use-board-url-state';
import { setLocationSearch } from '../support/search-params';

let container: HTMLDivElement;
let root: Root;
let state: BoardUrlState;

// Hands the hook's latest value to the test from an effect: assigning from render is impure.
function Probe(): null {
  const current = useBoardUrlState();
  useEffect(() => {
    state = current;
  });
  return null;
}

function mount(): void {
  act(() => {
    root.render(<Probe />);
  });
}

beforeEach(() => {
  setLocationSearch('');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
});

describe('useBoardUrlState', () => {
  it('reads the filters and the open post from the query string', () => {
    setLocationSearch('q=dark&status=DONE&post=abc');

    mount();

    expect(state.filters).toEqual({ ...DEFAULT_BOARD_FILTERS, query: 'dark', status: 'DONE' });
    expect(state.selectedPostId).toBe('abc');
  });

  it('has no open post and default filters on a clean URL', () => {
    mount();

    expect(state.filters).toEqual(DEFAULT_BOARD_FILTERS);
    expect(state.selectedPostId).toBeNull();
  });

  it('writes filters with replaceState, never pushing a history entry, and re-renders', () => {
    const push = vi.spyOn(window.history, 'pushState');
    mount();
    const entries = window.history.length;

    act(() => {
      state.setFilters({ ...DEFAULT_BOARD_FILTERS, query: 'csv', sort: 'votes' });
    });

    expect(window.location.search).toBe('?q=csv&sort=votes');
    expect(state.filters.query).toBe('csv');
    expect(push).not.toHaveBeenCalled();
    expect(window.history.length).toBe(entries);
  });

  it('keeps the open post when the filters change, and the filters when the post changes', () => {
    setLocationSearch('post=abc');
    mount();

    act(() => {
      state.setFilters({ ...DEFAULT_BOARD_FILTERS, status: 'OPEN' });
    });
    expect(window.location.search).toBe('?post=abc&status=OPEN');

    act(() => {
      state.setSelectedPostId('def');
    });
    expect(window.location.search).toBe('?post=def&status=OPEN');

    act(() => {
      state.setSelectedPostId(null);
    });
    expect(window.location.search).toBe('?status=OPEN');
  });

  it('merges a patch into the URL as it is now, not into what the caller last rendered', () => {
    setLocationSearch('status=OPEN');
    mount();
    expect(state.filters.status).toBe('OPEN');

    // Another write has landed that this render has not seen yet.
    setLocationSearch('status=DONE&sort=votes');
    act(() => {
      state.setFilters({ query: 'csv' });
    });

    expect(window.location.search).toBe('?status=DONE&sort=votes&q=csv');
  });

  it('clears search and filters with a patch and keeps the sort', () => {
    setLocationSearch('q=dark&status=DONE&category=BUG&priority=HIGH&sort=votes');
    mount();

    act(() => {
      state.setFilters(NO_FILTERS);
    });

    expect(window.location.search).toBe('?sort=votes');
  });

  it('leaves a clean path, without a trailing "?", once everything is cleared', () => {
    setLocationSearch('q=dark');
    mount();

    act(() => {
      state.setFilters(DEFAULT_BOARD_FILTERS);
    });

    expect(window.location.search).toBe('');
    expect(window.location.href.endsWith('?')).toBe(false);
  });
});
