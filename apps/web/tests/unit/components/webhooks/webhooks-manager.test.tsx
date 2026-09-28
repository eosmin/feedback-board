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

import { WebhooksManager } from '../../../../components/webhooks/webhooks-manager';
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

function render(webhooksAvailable: boolean): void {
  act(() => {
    root.render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <WebhooksManager orgSlug="acme" initialWebhooks={[]} webhooksAvailable={webhooksAvailable} />
      </NextIntlClientProvider>,
    );
  });
}

describe('WebhooksManager', () => {
  it('shows the create form and the one-time secret banner on a PRO org', async () => {
    render(true);

    const t = messages.dashboard.webhooks;
    expect(container.textContent).toContain(t.createForm.title);
    expect(container.textContent).not.toContain(t.upgradePrompt.title);

    const created = {
      id: '1',
      orgId: 'org-1',
      targetUrl: 'https://example.com/hook',
      events: ['post.created'],
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      secret: 'super-secret-value',
    };
    mockApiFetch.mockResolvedValue(created);

    const urlInput = container.querySelector('#webhook-target-url') as HTMLInputElement;
    const eventCheckbox = container.querySelector(
      '#webhook-event-post\\.created',
    ) as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    await act(async () => {
      Object.defineProperty(urlInput, 'value', {
        value: 'https://example.com/hook',
        configurable: true,
      });
      urlInput.dispatchEvent(new Event('input', { bubbles: true }));
      eventCheckbox.click();
      form.requestSubmit();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('super-secret-value');
    expect(container.textContent).toContain('https://example.com/hook');
    expect(container.textContent).not.toContain('undefined');
  });

  it('shows the upgrade prompt instead of the create form on a FREE org', () => {
    render(false);

    const t = messages.dashboard.webhooks;
    expect(container.textContent).toContain(t.upgradePrompt.title);
    expect(container.textContent).not.toContain(t.createForm.title);
  });
});
