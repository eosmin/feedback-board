import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../../../lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('../../../../lib/api-client')>(
    '../../../../lib/api-client',
  );
  return { ...actual, apiFetch: vi.fn() };
});
vi.mock('next/navigation', () => import('../../support/search-params'));
vi.mock('../../../../components/ui/select', () => import('../../support/select-stub'));

import { BoardDetailView } from '../../../../components/boards/board-detail-view';
import { apiFetch } from '../../../../lib/api-client';
import messages from '../../../../messages/en.json';
import { makeBoardPost, makeComment } from '../../support/board-fixtures';
import { chooseOption, getBySelector, getButton, typeInto } from '../../support/dom';
import { Providers } from '../../support/providers';
import { setLocationSearch } from '../../support/search-params';

const mockApiFetch = vi.mocked(apiFetch);
const copy = messages.dashboard.boardDetail;

let container: HTMLDivElement;
let root: Root;

const orgDetail = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  plan: 'FREE' as const,
  role: 'OWNER' as const,
  usage: {
    boards: { used: 1, cap: 1 },
    posts: { used: 1, cap: 50 },
    webhooks: { available: false },
  },
};

const boardDetail = {
  id: 'board-1',
  orgId: 'org-1',
  name: 'Feature Requests',
  slug: 'feature-requests',
  isPublic: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  postCount: 2,
};

const darkMode = makeBoardPost({
  id: 'post-1',
  title: 'Add dark mode',
  status: 'OPEN',
  voteCount: 3,
  createdAt: '2026-01-01T00:00:00.000Z',
});
const csvExport = makeBoardPost({
  id: 'post-2',
  title: 'Export to CSV',
  body: 'Let me download my data.',
  status: 'DONE',
  voteCount: 9,
  createdAt: '2026-02-01T00:00:00.000Z',
});

function mockFetchByPath(role: 'OWNER' | 'ADMIN' | 'MEMBER', posts = [csvExport, darkMode]): void {
  mockApiFetch.mockImplementation((path: string) => {
    if (path === '/orgs/acme') {
      return Promise.resolve({ ...orgDetail, role });
    }
    if (path === '/orgs/acme/boards/feature-requests') {
      return Promise.resolve(boardDetail);
    }
    if (path === '/orgs/acme/boards/feature-requests/posts') {
      return Promise.resolve(posts);
    }
    if (path.endsWith('/ai-digest/quota')) {
      return Promise.resolve({ remaining: 5, limit: 5 });
    }
    // The drawer's comment thread.
    return Promise.resolve([]);
  });
}

async function renderView(): Promise<void> {
  await act(async () => {
    root.render(
      <Providers>
        <BoardDetailView orgSlug="acme" boardSlug="feature-requests" />
      </Providers>,
    );
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function rowTitles(): string[] {
  return Array.from(container.querySelectorAll('li h2')).map(
    (heading) => heading.textContent ?? '',
  );
}

function dialog(): HTMLElement {
  return getBySelector(document.body, '[role="dialog"]', HTMLElement);
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

describe('BoardDetailView', () => {
  it('shows the loading copy before the initial fetches resolve', () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));

    act(() => {
      root.render(
        <Providers>
          <BoardDetailView orgSlug="acme" boardSlug="feature-requests" />
        </Providers>,
      );
    });

    expect(container.textContent).toBe(messages.common.loading);
  });

  it('renders the board name and its posts, newest first, once the fetches resolve', async () => {
    mockFetchByPath('MEMBER');

    await renderView();

    expect(container.querySelector('h1')?.textContent).toBe('Feature Requests');
    expect(rowTitles()).toEqual(['Export to CSV', 'Add dark mode']);
  });

  it('renders the AI summary bar only for OWNER/ADMIN, matching the route guard (TDD §3.8, §11)', async () => {
    mockFetchByPath('MEMBER');
    await renderView();
    expect(container.textContent).not.toContain(copy.aiDigest.submit);

    act(() => {
      root.unmount();
    });
    root = createRoot(container);
    mockFetchByPath('OWNER');
    await renderView();
    expect(container.textContent).toContain(copy.aiDigest.submit);
  });

  it('shows the empty-board screen, without search or filters, when there are no posts', async () => {
    mockFetchByPath('MEMBER', []);

    await renderView();

    expect(container.textContent).toContain(copy.postsEmpty);
    expect(container.textContent).not.toContain(copy.noResults);
    expect(container.querySelector('input[type="search"]')).toBeNull();
  });

  describe('search, sort and filters', () => {
    it('applies the filters found in the URL on first render', async () => {
      setLocationSearch('status=DONE');
      mockFetchByPath('MEMBER');

      await renderView();

      expect(rowTitles()).toEqual(['Export to CSV']);
      expect(getBySelector(container, '[role="status"]', HTMLElement).textContent).toBe(
        'Showing 1 of 2',
      );
    });

    // The oldest post has the most votes and the input is in neither order, so each sort has to
    // do real work to produce its own result.
    const popularOld = makeBoardPost({
      id: 'post-0',
      title: 'Oldest but loved',
      voteCount: 20,
      createdAt: '2025-12-01T00:00:00.000Z',
    });

    it('lists newest first by default', async () => {
      mockFetchByPath('MEMBER', [darkMode, popularOld, csvExport]);

      await renderView();

      expect(rowTitles()).toEqual(['Export to CSV', 'Add dark mode', 'Oldest but loved']);
    });

    it('sorts by votes when asked', async () => {
      setLocationSearch('sort=votes');
      mockFetchByPath('MEMBER', [darkMode, popularOld, csvExport]);

      await renderView();

      expect(rowTitles()).toEqual(['Oldest but loved', 'Export to CSV', 'Add dark mode']);
    });

    it('writes a typed search to the URL without navigating, and filters the list', async () => {
      mockFetchByPath('MEMBER');
      await renderView();

      await act(async () => {
        typeInto(getBySelector(container, 'input[type="search"]', HTMLInputElement), 'dark');
        // The search reaches the URL, and so the list, once typing pauses.
        await new Promise((resolve) => setTimeout(resolve, 300));
      });

      expect(window.location.search).toBe('?q=dark');
      expect(rowTitles()).toEqual(['Add dark mode']);
    });

    it('writes a chosen filter to the URL and drops it again when cleared', async () => {
      mockFetchByPath('MEMBER');
      await renderView();
      const statusSelect = (): HTMLSelectElement =>
        getBySelector(
          container,
          `select[aria-label="${copy.filters.statusLabel}"]`,
          HTMLSelectElement,
        );

      await act(async () => {
        chooseOption(statusSelect(), 'OPEN');
      });
      expect(window.location.search).toBe('?status=OPEN');
      expect(rowTitles()).toEqual(['Add dark mode']);

      await act(async () => {
        chooseOption(statusSelect(), 'ALL');
      });
      expect(window.location.search).toBe('');
      expect(rowTitles()).toHaveLength(2);
    });

    it('shows a no-results screen, distinct from the empty board, with a way back', async () => {
      setLocationSearch('q=zzz&sort=votes');
      mockFetchByPath('MEMBER');

      await renderView();

      expect(container.textContent).toContain(copy.noResults);
      expect(container.textContent).not.toContain(copy.postsEmpty);
      // The toolbar stays, so the filters can be changed.
      expect(container.querySelector('input[type="search"]')).not.toBeNull();

      await act(async () => {
        getButton(container, copy.clearFilters).click();
      });

      expect(rowTitles()).toHaveLength(2);
      // Clearing narrows nothing but leaves the chosen sort alone.
      expect(window.location.search).toBe('?sort=votes');
    });
  });

  describe('the detail drawer', () => {
    it('opens from a row, records the post in the URL, and closes back out of it', async () => {
      mockFetchByPath('MEMBER');
      await renderView();
      expect(document.body.querySelector('[role="dialog"]')).toBeNull();

      await act(async () => {
        getButton(container, 'Add dark mode').click();
      });

      expect(window.location.search).toBe('?post=post-1');
      expect(dialog().querySelector('h2')?.textContent).toBe('Add dark mode');

      await act(async () => {
        getButton(document.body, messages.common.close).click();
      });

      expect(window.location.search).toBe('');
    });

    it('opens straight away from a shared link', async () => {
      setLocationSearch('post=post-2');
      mockFetchByPath('MEMBER');

      await renderView();

      expect(dialog().querySelector('h2')?.textContent).toBe('Export to CSV');
    });

    it('opens nothing for a post that is not on this board', async () => {
      setLocationSearch('post=somewhere-else');
      mockFetchByPath('MEMBER');

      await renderView();

      expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    });

    it('offers the status select to an admin and the badge to a member', async () => {
      setLocationSearch('post=post-1');
      mockFetchByPath('ADMIN');
      await renderView();
      expect(dialog().querySelector('select')).not.toBeNull();

      act(() => {
        root.unmount();
      });
      root = createRoot(container);
      mockFetchByPath('MEMBER');
      await renderView();
      expect(dialog().querySelector('select')).toBeNull();
    });

    it('bumps the row comment count once a comment is posted from the drawer', async () => {
      setLocationSearch('post=post-1');
      mockApiFetch.mockImplementation(
        (path: string, _schema: unknown, init?: { method?: string }) => {
          if (path === '/orgs/acme') {
            return Promise.resolve({ ...orgDetail, role: 'MEMBER' });
          }
          if (path === '/orgs/acme/boards/feature-requests') {
            return Promise.resolve(boardDetail);
          }
          if (path === '/orgs/acme/boards/feature-requests/posts') {
            return Promise.resolve([{ ...darkMode, commentCount: 2 }]);
          }
          if (path === '/orgs/acme/posts/post-1/comments' && init?.method === 'POST') {
            return Promise.resolve(makeComment({ body: 'Agreed.' }));
          }
          return Promise.resolve([]);
        },
      );
      await renderView();
      const count = (): string | undefined =>
        container.querySelector('[aria-label^="Comments:"]')?.textContent ?? undefined;
      expect(count()).toBe('2');

      await act(async () => {
        typeInto(getBySelector(dialog(), 'textarea', HTMLTextAreaElement), 'Agreed.');
      });
      await act(async () => {
        getBySelector(dialog(), 'form', HTMLFormElement).requestSubmit();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(count()).toBe('3');
    });
  });

  describe('creating a post', () => {
    const created = makeBoardPost({
      id: 'post-3',
      title: 'Brand new request',
      body: 'Something we need.',
      voteCount: 0,
      commentCount: 0,
      createdAt: '2026-03-01T00:00:00.000Z',
    });

    // `listAfterCreate` is what the API returns when the list is read again after the POST.
    function mockCreateFlow(listAfterCreate: ReturnType<typeof makeBoardPost>[]): void {
      let createdOnServer = false;
      mockApiFetch.mockImplementation(
        (path: string, _schema: unknown, init?: { method?: string }) => {
          if (path === '/orgs/acme') {
            return Promise.resolve({ ...orgDetail, role: 'MEMBER' });
          }
          if (path === '/orgs/acme/boards/feature-requests') {
            return Promise.resolve(boardDetail);
          }
          if (path === '/orgs/acme/boards/feature-requests/posts') {
            if (init?.method === 'POST') {
              createdOnServer = true;
              return Promise.resolve(created);
            }
            return Promise.resolve(createdOnServer ? listAfterCreate : [csvExport, darkMode]);
          }
          return Promise.resolve([]);
        },
      );
    }

    async function renderAndCreate(): Promise<void> {
      await renderView();
      await act(async () => {
        getButton(container, copy.createPost.trigger).click();
      });

      // The dialog renders through a portal into document.body, outside `container`.
      await act(async () => {
        typeInto(getBySelector(document.body, '#post-title', HTMLInputElement), created.title);
        typeInto(getBySelector(document.body, '#post-body', HTMLTextAreaElement), created.body);
        getBySelector(document.body, 'form', HTMLFormElement).requestSubmit();
        // react-hook-form validates through an async resolver; a macrotask outlasts its microtasks.
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }

    it('reads the list again after the POST and shows the new post where the server put it', async () => {
      mockCreateFlow([created, csvExport, darkMode]);

      await renderAndCreate();

      expect(mockApiFetch).toHaveBeenCalledWith(
        '/orgs/acme/boards/feature-requests/posts',
        expect.anything(),
        expect.objectContaining({ method: 'POST' }),
      );
      expect(rowTitles()).toEqual(['Brand new request', 'Export to CSV', 'Add dark mode']);
    });

    it('closes the dialog and confirms in a toast once the new post is in place', async () => {
      mockCreateFlow([created, csvExport, darkMode]);

      await renderAndCreate();

      expect(document.body.querySelector('[role="dialog"]')).toBeNull();
      expect(document.body.textContent).toContain(copy.createPost.success);
    });

    it('clears the filters so a new post they would hide is visible', async () => {
      // A new post is open and unclassified, so a status filter would hide it.
      setLocationSearch('status=DONE&sort=votes');
      mockCreateFlow([created, csvExport, darkMode]);

      await renderAndCreate();

      expect(rowTitles()).toContain('Brand new request');
      // The sort is a view choice, not a filter, and is kept.
      expect(window.location.search).toBe('?sort=votes');
    });

    it('places the new post by its date, not always at the top', async () => {
      // The list is sorted by date on the client with the server's own rule, so the position right
      // after creating is the one a reload gives.
      const older = { ...created, createdAt: '2025-12-01T00:00:00.000Z' };
      mockCreateFlow([csvExport, darkMode, older]);

      await renderAndCreate();

      expect(rowTitles()).toEqual(['Export to CSV', 'Add dark mode', 'Brand new request']);
    });
  });

  it('shows the generic error instead of loading forever when a fetch fails', async () => {
    mockApiFetch.mockRejectedValue(new Error('network down'));

    await renderView();

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      messages.common.error.generic,
    );
    expect(container.textContent).not.toContain(messages.common.loading);
  });
});
