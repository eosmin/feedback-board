import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Post } from '@feedback-board/shared';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../../../lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('../../../../lib/api-client')>(
    '../../../../lib/api-client',
  );
  return { ...actual, apiFetch: vi.fn() };
});

import { PostList } from '../../../../components/boards/post-list';
import { apiFetch } from '../../../../lib/api-client';
import messages from '../../../../messages/en.json';

const mockApiFetch = vi.mocked(apiFetch);

let container: HTMLDivElement;
let root: Root;

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    boardId: '22222222-2222-2222-2222-222222222222',
    orgId: '33333333-3333-3333-3333-333333333333',
    authorId: '44444444-4444-4444-4444-444444444444',
    title: 'Add dark mode',
    body: 'Please add a dark theme.',
    status: 'OPEN',
    voteCount: 3,
    aiCategory: null,
    aiPriority: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  // PostComments fetches on mount for every rendered post — resolve it to an empty list so
  // these assertions are not entangled with the comment thread's own behavior.
  mockApiFetch.mockResolvedValue([]);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
});

describe('PostList', () => {
  it('renders the empty-state message when there are no posts', () => {
    act(() => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <PostList orgSlug="acme" posts={[]} canManage={false} onUpdated={vi.fn()} />
        </NextIntlClientProvider>,
      );
    });

    expect(container.textContent).toBe(messages.dashboard.boardDetail.postsEmpty);
  });

  it('renders a status select for a manager and a read-only badge for a plain member', async () => {
    await act(async () => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <PostList orgSlug="acme" posts={[makePost()]} canManage={true} onUpdated={vi.fn()} />
        </NextIntlClientProvider>,
      );
      await Promise.resolve();
    });

    expect(container.querySelector('select')).not.toBeNull();

    act(() => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <PostList orgSlug="acme" posts={[makePost()]} canManage={false} onUpdated={vi.fn()} />
        </NextIntlClientProvider>,
      );
    });

    expect(container.querySelector('select')).toBeNull();
    expect(container.textContent).toContain(messages.publicBoard.status.OPEN);
  });

  it('renders title, body and the vote button for each post', async () => {
    await act(async () => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <PostList orgSlug="acme" posts={[makePost()]} canManage={false} onUpdated={vi.fn()} />
        </NextIntlClientProvider>,
      );
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Add dark mode');
    expect(container.textContent).toContain('Please add a dark theme.');
    expect(container.textContent).toContain('Vote (3)');
  });
});
