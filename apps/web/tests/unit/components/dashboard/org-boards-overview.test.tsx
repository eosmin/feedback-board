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

import { OrgBoardsOverview } from '../../../../components/dashboard/org-boards-overview';
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
  refreshMock.mockClear();
});

describe('OrgBoardsOverview', () => {
  it('appends a newly created board to the list without waiting for a reload', async () => {
    const created = {
      id: '2',
      orgId: 'org-1',
      name: 'Bugs',
      slug: 'bugs',
      isPublic: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    mockApiFetch.mockResolvedValue(created);

    act(() => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <OrgBoardsOverview
            orgSlug="acme"
            initialBoards={[
              {
                id: '1',
                orgId: 'org-1',
                name: 'Feature Requests',
                slug: 'feature-requests',
                isPublic: true,
                createdAt: '2026-01-01T00:00:00.000Z',
              },
            ]}
          />
        </NextIntlClientProvider>,
      );
    });

    expect(container.textContent).toContain('Feature Requests');
    expect(container.textContent).not.toContain('Bugs');

    const trigger = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === messages.dashboard.orgOverview.createBoard.trigger,
    ) as HTMLButtonElement;

    act(() => {
      trigger.click();
    });

    // The dialog is rendered via a portal into document.body, not into `container`.
    const nameInput = document.querySelector('#board-name') as HTMLInputElement;
    const slugInput = document.querySelector('#board-slug') as HTMLInputElement;
    const form = document.querySelector('#board-name')?.closest('form') as HTMLFormElement;

    await act(async () => {
      Object.defineProperty(nameInput, 'value', { value: 'Bugs', configurable: true });
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      Object.defineProperty(slugInput, 'value', { value: 'bugs', configurable: true });
      slugInput.dispatchEvent(new Event('input', { bubbles: true }));
      form.requestSubmit();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Feature Requests');
    expect(container.textContent).toContain('Bugs');
  });
});
