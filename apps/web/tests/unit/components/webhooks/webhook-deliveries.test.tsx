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

import { WebhookDeliveries } from '../../../../components/webhooks/webhook-deliveries';
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

describe('WebhookDeliveries', () => {
  it('loads and renders one row per attempt on click', async () => {
    mockApiFetch.mockResolvedValue([
      {
        id: 'd1',
        webhookId: '1',
        orgId: 'org-1',
        event: 'post.created',
        payload: {},
        responseStatus: 200,
        attempt: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'd2',
        webhookId: '1',
        orgId: 'org-1',
        event: 'post.created',
        payload: {},
        responseStatus: null,
        attempt: 2,
        createdAt: '2026-01-02T00:00:00.000Z',
      },
    ]);

    act(() => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <WebhookDeliveries orgSlug="acme" webhookId="1" />
        </NextIntlClientProvider>,
      );
    });

    const t = messages.dashboard.webhooks.deliveries;
    const showButton = container.querySelector('button') as HTMLButtonElement;
    expect(showButton.textContent).toBe(t.show);

    await act(async () => {
      showButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith('/orgs/acme/webhooks/1/deliveries', expect.anything());
    expect(container.textContent).toContain('200');
    expect(container.textContent).toContain(t.noResponse);
  });

  it('shows an error message when loading fails', async () => {
    mockApiFetch.mockRejectedValue(new Error('boom'));

    act(() => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <WebhookDeliveries orgSlug="acme" webhookId="1" />
        </NextIntlClientProvider>,
      );
    });

    const showButton = container.querySelector('button') as HTMLButtonElement;

    await act(async () => {
      showButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const t = messages.dashboard.webhooks.deliveries;
    expect(container.textContent).toContain(t.error);
  });
});
