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

import { PostStatusSelect } from '../../../../components/boards/post-status-select';
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

describe('PostStatusSelect', () => {
  it('renders every POST_STATUSES value as a translated option', () => {
    act(() => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <PostStatusSelect orgSlug="acme" post={makePost()} onUpdated={vi.fn()} />
        </NextIntlClientProvider>,
      );
    });

    const options = Array.from(container.querySelectorAll('option')).map(
      (option) => option.textContent,
    );
    expect(options).toEqual(['Open', 'Planned', 'In progress', 'Done', 'Closed']);
  });

  it('PATCHes the new status and reports the updated post on change', async () => {
    const updated = { ...makePost(), status: 'PLANNED' as const };
    mockApiFetch.mockResolvedValue(updated);
    const onUpdated = vi.fn();

    act(() => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <PostStatusSelect orgSlug="acme" post={makePost()} onUpdated={onUpdated} />
        </NextIntlClientProvider>,
      );
    });

    const select = container.querySelector('select') as HTMLSelectElement;

    await act(async () => {
      select.value = 'PLANNED';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/orgs/acme/posts/11111111-1111-1111-1111-111111111111',
      expect.anything(),
      expect.objectContaining({ method: 'PATCH', body: { status: 'PLANNED' } }),
    );
    expect(onUpdated).toHaveBeenCalledWith(updated);
  });
});
