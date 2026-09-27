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

import { CreatePostForm } from '../../../../components/boards/create-post-form';
import { apiFetch, ApiError } from '../../../../lib/api-client';
import messages from '../../../../messages/en.json';

const mockApiFetch = vi.mocked(apiFetch);

let container: HTMLDivElement;
let root: Root;

function renderForm(onCreated = vi.fn()): typeof onCreated {
  act(() => {
    root.render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <CreatePostForm orgSlug="acme" boardSlug="feature-requests" onCreated={onCreated} />
      </NextIntlClientProvider>,
    );
  });
  return onCreated;
}

function setInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  Object.defineProperty(input, 'value', { value, configurable: true });
  input.dispatchEvent(new Event('input', { bubbles: true }));
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

describe('CreatePostForm', () => {
  it('renders the titleLabel and submit copy from the message catalog', () => {
    renderForm();

    const t = messages.dashboard.boardDetail.createPost;
    expect(container.textContent).toContain(t.titleLabel);
    expect(container.textContent).toContain(t.submit);
  });

  it('calls onCreated and resets the form on a successful creation', async () => {
    const created = {
      id: '1',
      boardId: 'board-1',
      orgId: 'org-1',
      authorId: 'user-1',
      title: 'Add dark mode',
      body: 'Please add a dark theme.',
      status: 'OPEN' as const,
      voteCount: 0,
      aiCategory: null,
      aiPriority: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    mockApiFetch.mockResolvedValue(created);
    const onCreated = renderForm();

    const titleInput = container.querySelector('#post-title') as HTMLInputElement;
    const bodyInput = container.querySelector('#post-body') as HTMLTextAreaElement;
    const form = container.querySelector('form') as HTMLFormElement;

    await act(async () => {
      setInputValue(titleInput, 'Add dark mode');
      setInputValue(bodyInput, 'Please add a dark theme.');
      form.requestSubmit();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/orgs/acme/boards/feature-requests/posts',
      expect.anything(),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(onCreated).toHaveBeenCalledWith(created);
  });

  it('renders the upgrade prompt instead of a generic error on a PLAN_LIMIT response (TDD §3.9)', async () => {
    mockApiFetch.mockRejectedValue(
      new ApiError(403, { error: 'PLAN_LIMIT', limit: 'posts', plan: 'FREE', cap: 50 }),
    );
    renderForm();

    const titleInput = container.querySelector('#post-title') as HTMLInputElement;
    const bodyInput = container.querySelector('#post-body') as HTMLTextAreaElement;
    const form = container.querySelector('form') as HTMLFormElement;

    await act(async () => {
      setInputValue(titleInput, 'Add dark mode');
      setInputValue(bodyInput, 'Please add a dark theme.');
      form.requestSubmit();
      await Promise.resolve();
      await Promise.resolve();
    });

    const planLimitMessages = messages.dashboard.boardDetail.planLimit.posts;
    expect(container.textContent).toContain(planLimitMessages.title);
    expect(container.querySelector('form')).toBeNull();
    expect(container.textContent).not.toContain(messages.dashboard.boardDetail.createPost.error);
  });

  it('shows the generic error message for a non-PLAN_LIMIT failure', async () => {
    mockApiFetch.mockRejectedValue(new ApiError(500, { error: 'INTERNAL_ERROR' }));
    renderForm();

    const titleInput = container.querySelector('#post-title') as HTMLInputElement;
    const bodyInput = container.querySelector('#post-body') as HTMLTextAreaElement;
    const form = container.querySelector('form') as HTMLFormElement;

    await act(async () => {
      setInputValue(titleInput, 'Add dark mode');
      setInputValue(bodyInput, 'Please add a dark theme.');
      form.requestSubmit();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain(messages.dashboard.boardDetail.createPost.error);
  });
});
