import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../../../components/ui/select', () => import('../../support/select-stub'));

import { PostFilters } from '../../../../components/boards/post-filters';
import { DEFAULT_BOARD_FILTERS, type BoardFilters } from '../../../../lib/board-filters';
import messages from '../../../../messages/en.json';
import { chooseOption, getBySelector, typeInto } from '../../support/dom';
import { Providers } from '../../support/providers';

const copy = messages.dashboard.boardDetail.filters;

let container: HTMLDivElement;
let root: Root;

type OnChange = (patch: Partial<BoardFilters>) => void;

function renderFilters(
  filters: BoardFilters = DEFAULT_BOARD_FILTERS,
  shown = 3,
  total = 5,
): ReturnType<typeof vi.fn<OnChange>> {
  const onChange = vi.fn<OnChange>();
  act(() => {
    root.render(
      <Providers>
        <PostFilters filters={filters} onChange={onChange} shown={shown} total={total} />
      </Providers>,
    );
  });
  return onChange;
}

function selectLabelled(label: string): HTMLSelectElement {
  return getBySelector(container, `select[aria-label="${label}"]`, HTMLSelectElement);
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  window.history.replaceState(null, '', '/');
});

describe('PostFilters', () => {
  it('reflects the filters it is given', () => {
    renderFilters({
      query: 'dark',
      sort: 'votes',
      status: 'PLANNED',
      category: 'UX',
      priority: 'HIGH',
    });

    expect(getBySelector(container, 'input[type="search"]', HTMLInputElement).value).toBe('dark');
    expect(selectLabelled(copy.sortLabel).value).toBe('votes');
    expect(selectLabelled(copy.statusLabel).value).toBe('PLANNED');
    expect(selectLabelled(copy.categoryLabel).value).toBe('UX');
    expect(selectLabelled(copy.priorityLabel).value).toBe('HIGH');
  });

  it('shows "all" for a filter that is not set', () => {
    renderFilters();

    expect(selectLabelled(copy.statusLabel).selectedOptions[0]?.textContent).toBe(copy.allStatuses);
    expect(selectLabelled(copy.categoryLabel).selectedOptions[0]?.textContent).toBe(
      copy.allCategories,
    );
    expect(selectLabelled(copy.priorityLabel).selectedOptions[0]?.textContent).toBe(
      copy.allPriorities,
    );
  });

  describe('the search box', () => {
    const searchBox = (): HTMLInputElement =>
      getBySelector(container, 'input[type="search"]', HTMLInputElement);

    function renderWith(onChange: OnChange, filters: BoardFilters): void {
      act(() => {
        root.render(
          <Providers>
            <PostFilters filters={filters} onChange={onChange} shown={3} total={5} />
          </Providers>,
        );
      });
    }

    function type(text: string): void {
      act(() => {
        typeInto(searchBox(), text);
      });
    }

    function advance(ms: number): void {
      act(() => {
        vi.advanceTimersByTime(ms);
      });
    }

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows what is typed at once but reports it only once typing pauses', () => {
      const onChange = renderFilters({ ...DEFAULT_BOARD_FILTERS, status: 'OPEN' });

      type('c');
      type('cs');
      type('csv');

      expect(searchBox().value).toBe('csv');
      expect(onChange).not.toHaveBeenCalled();

      advance(250);

      // One report for the whole burst, and only the query: the owner merges it into the URL, so a
      // filter chosen meanwhile is not overwritten with the copy this box rendered with.
      expect(onChange).toHaveBeenCalledExactlyOnceWith({ query: 'csv' });
    });

    it('restarts the pause with every keystroke', () => {
      const onChange = renderFilters();

      type('c');
      advance(200);
      type('cs');
      advance(200);
      expect(onChange).not.toHaveBeenCalled();

      advance(50);
      expect(onChange).toHaveBeenCalledExactlyOnceWith({ query: 'cs' });
    });

    it('shows a query the URL changed under it, such as after "Clear filters"', () => {
      const onChange = vi.fn<OnChange>();
      renderWith(onChange, { ...DEFAULT_BOARD_FILTERS, query: 'dark' });
      expect(searchBox().value).toBe('dark');

      renderWith(onChange, DEFAULT_BOARD_FILTERS);

      expect(searchBox().value).toBe('');
    });

    it('drops a keystroke still waiting when the URL is changed from outside', () => {
      const onChange = vi.fn<OnChange>();
      renderWith(onChange, { ...DEFAULT_BOARD_FILTERS, query: 'zzz' });

      type('zzzx');
      renderWith(onChange, DEFAULT_BOARD_FILTERS);
      advance(250);

      // The cleared search wins: the timer must not write 'zzzx' back over it.
      expect(searchBox().value).toBe('');
      expect(onChange).not.toHaveBeenCalled();
    });

    it('keeps the box when its own earlier write comes back while typing goes on', () => {
      const onChange = vi.fn<OnChange>();
      renderWith(onChange, DEFAULT_BOARD_FILTERS);

      type('da');
      advance(250);
      expect(onChange).toHaveBeenCalledExactlyOnceWith({ query: 'da' });
      type('dar');
      // The router lands the 'da' write while 'dar' is still waiting.
      renderWith(onChange, { ...DEFAULT_BOARD_FILTERS, query: 'da' });

      expect(searchBox().value).toBe('dar');
      advance(250);
      expect(onChange).toHaveBeenLastCalledWith({ query: 'dar' });
    });

    it('reports a keystroke still waiting when it unmounts, instead of dropping it', () => {
      const onChange = renderFilters();

      type('csv');
      act(() => {
        root.unmount();
      });
      root = createRoot(container);

      expect(onChange).toHaveBeenCalledExactlyOnceWith({ query: 'csv' });
      advance(250);
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('drops it instead when the unmount is a route change, so the next page keeps its URL', () => {
      const onChange = renderFilters();

      type('csv');
      // The router has already moved the URL to another page by the time the old one unmounts.
      window.history.replaceState(null, '', '/dashboard/acme');
      act(() => {
        root.unmount();
      });
      root = createRoot(container);

      expect(onChange).not.toHaveBeenCalled();
    });

    it('reports nothing on unmount when nothing is waiting', () => {
      const onChange = renderFilters();

      type('csv');
      advance(250);
      act(() => {
        root.unmount();
      });
      root = createRoot(container);

      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });

  it.each([
    [copy.sortLabel, 'votes', { sort: 'votes' }],
    [copy.statusLabel, 'DONE', { status: 'DONE' }],
    [copy.categoryLabel, 'BUG', { category: 'BUG' }],
    [copy.priorityLabel, 'LOW', { priority: 'LOW' }],
  ])('reports a change to "%s"', (label, value, expected) => {
    const onChange = renderFilters();

    act(() => {
      chooseOption(selectLabelled(label), value);
    });

    expect(onChange).toHaveBeenCalledExactlyOnceWith(expected);
  });

  it('clears a filter when "all" is chosen', () => {
    const onChange = renderFilters({ ...DEFAULT_BOARD_FILTERS, status: 'DONE' });

    act(() => {
      chooseOption(selectLabelled(copy.statusLabel), 'ALL');
    });

    expect(onChange).toHaveBeenCalledExactlyOnceWith({ status: null });
  });

  it('announces how many posts are shown', () => {
    renderFilters(DEFAULT_BOARD_FILTERS, 3, 5);

    expect(getBySelector(container, '[role="status"]', HTMLElement).textContent).toBe(
      'Showing 3 of 5',
    );
  });
});
