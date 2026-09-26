import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { PublicPost } from '@feedback-board/shared';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { PublicPostList } from '../../../../components/boards/public-post-list';
import messages from '../../../../messages/en.json';

let container: HTMLDivElement;
let root: Root;

function renderList(posts: PublicPost[]): void {
  act(() => {
    root.render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <PublicPostList posts={posts} />
      </NextIntlClientProvider>,
    );
  });
}

function makePost(overrides: Partial<PublicPost> = {}): PublicPost {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    boardId: '22222222-2222-2222-2222-222222222222',
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
});

describe('PublicPostList', () => {
  it('renders the empty-state message when there are no posts', () => {
    renderList([]);

    expect(container.textContent).toBe(messages.publicBoard.empty);
  });

  it('renders no vote or comment affordance for a post — the public API exposes neither', () => {
    renderList([makePost()]);

    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('form')).toBeNull();
  });

  it('renders title, body, status and vote count for each post', () => {
    renderList([makePost({ title: 'Add dark mode', voteCount: 5, status: 'PLANNED' })]);

    expect(container.textContent).toContain('Add dark mode');
    expect(container.textContent).toContain('Please add a dark theme.');
    expect(container.textContent).toContain(messages.publicBoard.status.PLANNED);
    expect(container.textContent).toContain('5 votes');
  });
});
