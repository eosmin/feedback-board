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

import { PostComments } from '../../../../components/boards/post-comments';
import { apiFetch } from '../../../../lib/api-client';
import messages from '../../../../messages/en.json';

const mockApiFetch = vi.mocked(apiFetch);

let container: HTMLDivElement;
let root: Root;

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

describe('PostComments', () => {
  it('renders the empty-state copy once the initial fetch resolves with no comments', async () => {
    mockApiFetch.mockResolvedValue([]);

    await act(async () => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <PostComments orgSlug="acme" postId="post-1" />
        </NextIntlClientProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/orgs/acme/posts/post-1/comments',
      expect.anything(),
    );
    expect(container.textContent).toContain(messages.dashboard.boardDetail.comments.empty);
  });

  it('renders fetched comments and appends a newly submitted one', async () => {
    const existing = {
      id: 'c1',
      postId: 'post-1',
      orgId: 'org-1',
      authorId: 'user-1',
      body: 'Great idea!',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const created = {
      id: 'c2',
      postId: 'post-1',
      orgId: 'org-1',
      authorId: 'user-2',
      body: 'Agreed.',
      createdAt: '2026-01-02T00:00:00.000Z',
    };
    mockApiFetch.mockResolvedValueOnce([existing]).mockResolvedValueOnce(created);

    await act(async () => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <PostComments orgSlug="acme" postId="post-1" />
        </NextIntlClientProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Great idea!');

    const input = container.querySelector('input') as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    await act(async () => {
      Object.defineProperty(input, 'value', { value: 'Agreed.', configurable: true });
      input.dispatchEvent(new Event('input', { bubbles: true }));
      form.requestSubmit();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Great idea!');
    expect(container.textContent).toContain('Agreed.');
  });
});
