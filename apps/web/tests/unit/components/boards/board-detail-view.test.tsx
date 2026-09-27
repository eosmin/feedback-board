import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../../../lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('../../../../lib/api-client')>(
    '../../../../lib/api-client',
  );
  return { ...actual, apiFetch: vi.fn() };
});

import { BoardDetailView } from '../../../../components/boards/board-detail-view';
import { apiFetch } from '../../../../lib/api-client';
import messages from '../../../../messages/en.json';

const mockApiFetch = vi.mocked(apiFetch);

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
  postCount: 1,
};

const post = {
  id: 'post-1',
  boardId: 'board-1',
  orgId: 'org-1',
  authorId: 'user-1',
  title: 'Add dark mode',
  body: 'Please add a dark theme.',
  status: 'OPEN' as const,
  voteCount: 3,
  aiCategory: null,
  aiPriority: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function mockFetchByPath(role: 'OWNER' | 'ADMIN' | 'MEMBER'): void {
  mockApiFetch.mockImplementation((path: string) => {
    if (path === '/orgs/acme') {
      return Promise.resolve({ ...orgDetail, role });
    }
    if (path === '/orgs/acme/boards/feature-requests') {
      return Promise.resolve(boardDetail);
    }
    if (path === '/orgs/acme/boards/feature-requests/posts') {
      return Promise.resolve([post]);
    }
    // PostComments' own fetch on mount, keyed on the post id.
    return Promise.resolve([]);
  });
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
  vi.restoreAllMocks();
});

describe('BoardDetailView', () => {
  it('shows the loading copy before the initial fetches resolve', () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));

    act(() => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <BoardDetailView orgSlug="acme" boardSlug="feature-requests" />
        </NextIntlClientProvider>,
      );
    });

    expect(container.textContent).toBe(messages.common.loading);
  });

  it('renders the board name and posts once the fetches resolve', async () => {
    mockFetchByPath('MEMBER');

    await act(async () => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <BoardDetailView orgSlug="acme" boardSlug="feature-requests" />
        </NextIntlClientProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Feature Requests');
    expect(container.textContent).toContain('Add dark mode');
  });

  it('renders "Generate AI Summary" only for OWNER/ADMIN, matching the route guard (TDD §3.8, §11)', async () => {
    mockFetchByPath('MEMBER');

    await act(async () => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <BoardDetailView orgSlug="acme" boardSlug="feature-requests" />
        </NextIntlClientProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain(messages.dashboard.boardDetail.aiDigest.submit);
  });

  it('renders "Generate AI Summary" for an OWNER', async () => {
    mockFetchByPath('OWNER');

    await act(async () => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <BoardDetailView orgSlug="acme" boardSlug="feature-requests" />
        </NextIntlClientProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain(messages.dashboard.boardDetail.aiDigest.submit);
  });
});
