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

import { WebhookList } from '../../../../components/webhooks/webhook-list';
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

describe('WebhookList', () => {
  it('renders active and disabled webhooks, and deletes on click', async () => {
    const onDeleted = vi.fn();
    mockApiFetch.mockResolvedValue(null);

    act(() => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <WebhookList
            orgSlug="acme"
            webhooks={[
              {
                id: '1',
                orgId: 'org-1',
                targetUrl: 'https://example.com/active',
                events: ['post.created'],
                isActive: true,
                createdAt: '2026-01-01T00:00:00.000Z',
              },
              {
                id: '2',
                orgId: 'org-1',
                targetUrl: 'https://example.com/disabled',
                events: ['post.status_changed'],
                isActive: false,
                createdAt: '2026-01-01T00:00:00.000Z',
              },
            ]}
            onDeleted={onDeleted}
          />
        </NextIntlClientProvider>,
      );
    });

    const t = messages.dashboard.webhooks.list;
    expect(container.textContent).toContain('https://example.com/active');
    expect(container.textContent).toContain(t.status.active);
    expect(container.textContent).toContain(t.status.disabled);

    const [deleteButton] = Array.from(container.querySelectorAll('button')).filter(
      (button) => button.textContent === t.delete,
    );

    await act(async () => {
      deleteButton?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/orgs/acme/webhooks/1',
      expect.anything(),
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(onDeleted).toHaveBeenCalledWith('1');
  });

  it('renders the empty state with no webhooks', () => {
    act(() => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <WebhookList orgSlug="acme" webhooks={[]} onDeleted={vi.fn()} />
        </NextIntlClientProvider>,
      );
    });

    expect(container.textContent).toContain(messages.dashboard.webhooks.list.empty);
  });
});
