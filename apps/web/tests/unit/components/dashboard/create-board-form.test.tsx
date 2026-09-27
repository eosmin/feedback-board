import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock('../../../../lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('../../../../lib/api-client')>(
    '../../../../lib/api-client',
  );
  return { ...actual, apiFetch: vi.fn() };
});

import { CreateBoardForm } from '../../../../components/dashboard/create-board-form';
import { apiFetch, ApiError } from '../../../../lib/api-client';
import messages from '../../../../messages/en.json';

const mockApiFetch = vi.mocked(apiFetch);

let container: HTMLDivElement;
let root: Root;

function renderForm(onCreated = vi.fn()): typeof onCreated {
  act(() => {
    root.render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <CreateBoardForm orgSlug="acme" onCreated={onCreated} />
      </NextIntlClientProvider>,
    );
  });
  return onCreated;
}

function setInputValue(input: HTMLInputElement, value: string): void {
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
  refreshMock.mockClear();
});

describe('CreateBoardForm', () => {
  it('renders the nameLabel and submit copy from the message catalog', () => {
    renderForm();

    const t = messages.dashboard.orgOverview.createBoard;
    expect(container.textContent).toContain(t.nameLabel);
    expect(container.textContent).toContain(t.submit);
  });

  it('calls onCreated and refreshes the router on a successful creation', async () => {
    const created = {
      id: '1',
      orgId: 'org-1',
      name: 'Feature Requests',
      slug: 'feature-requests',
      isPublic: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    mockApiFetch.mockResolvedValue(created);
    const onCreated = renderForm();

    const nameInput = container.querySelector('#board-name') as HTMLInputElement;
    const slugInput = container.querySelector('#board-slug') as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    await act(async () => {
      setInputValue(nameInput, 'Feature Requests');
      setInputValue(slugInput, 'feature-requests');
      form.requestSubmit();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/orgs/acme/boards',
      expect.anything(),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(onCreated).toHaveBeenCalledWith(created);
    expect(refreshMock).toHaveBeenCalled();
  });

  it('renders the upgrade prompt instead of a generic error on a PLAN_LIMIT response (Done when, TDD §13 step 19.2)', async () => {
    mockApiFetch.mockRejectedValue(
      new ApiError(403, { error: 'PLAN_LIMIT', limit: 'boards', plan: 'FREE', cap: 1 }),
    );
    renderForm();

    const nameInput = container.querySelector('#board-name') as HTMLInputElement;
    const slugInput = container.querySelector('#board-slug') as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    await act(async () => {
      setInputValue(nameInput, 'Feature Requests');
      setInputValue(slugInput, 'feature-requests');
      form.requestSubmit();
      await Promise.resolve();
      await Promise.resolve();
    });

    const planLimitMessages = messages.dashboard.orgOverview.planLimit.boards;
    expect(container.textContent).toContain(planLimitMessages.title);
    expect(container.querySelector('form')).toBeNull();
    expect(container.textContent).not.toContain(messages.dashboard.orgOverview.createBoard.error);
  });

  it('shows a duplicate-slug field error on a CONFLICT response, not a generic failure', async () => {
    mockApiFetch.mockRejectedValue(new ApiError(409, { error: 'CONFLICT' }));
    renderForm();

    const nameInput = container.querySelector('#board-name') as HTMLInputElement;
    const slugInput = container.querySelector('#board-slug') as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    await act(async () => {
      setInputValue(nameInput, 'Feature Requests');
      setInputValue(slugInput, 'feature-requests');
      form.requestSubmit();
      await Promise.resolve();
      await Promise.resolve();
    });

    const t = messages.dashboard.orgOverview.createBoard;
    expect(container.textContent).toContain(t.slugTaken);
    expect(container.textContent).not.toContain(t.error);
  });

  it('shows the generic error message for a non-PLAN_LIMIT, non-CONFLICT failure', async () => {
    mockApiFetch.mockRejectedValue(new ApiError(500, { error: 'INTERNAL_ERROR' }));
    renderForm();

    const nameInput = container.querySelector('#board-name') as HTMLInputElement;
    const slugInput = container.querySelector('#board-slug') as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    await act(async () => {
      setInputValue(nameInput, 'Feature Requests');
      setInputValue(slugInput, 'feature-requests');
      form.requestSubmit();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain(messages.dashboard.orgOverview.createBoard.error);
  });
});
