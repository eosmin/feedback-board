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

import { VoteButton } from '../../../../components/boards/vote-button';
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
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
});

describe('VoteButton', () => {
  it('renders the current vote count from the message catalog', () => {
    act(() => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <VoteButton orgSlug="acme" post={makePost({ voteCount: 3 })} onUpdated={vi.fn()} />
        </NextIntlClientProvider>,
      );
    });

    expect(container.textContent).toContain('Vote (3)');
  });

  it('toggles the vote and reports the updated post with the new vote count', async () => {
    mockApiFetch.mockResolvedValue({
      postId: '11111111-1111-1111-1111-111111111111',
      voted: true,
      voteCount: 4,
    });
    const onUpdated = vi.fn();

    act(() => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <VoteButton orgSlug="acme" post={makePost({ voteCount: 3 })} onUpdated={onUpdated} />
        </NextIntlClientProvider>,
      );
    });

    const button = container.querySelector('button') as HTMLButtonElement;

    await act(async () => {
      button.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/orgs/acme/posts/11111111-1111-1111-1111-111111111111/votes',
      expect.anything(),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ voteCount: 4 }));
  });
});
