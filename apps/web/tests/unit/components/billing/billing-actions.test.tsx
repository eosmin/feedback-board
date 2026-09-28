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

import { BillingActions } from '../../../../components/billing/billing-actions';
import { apiFetch } from '../../../../lib/api-client';
import messages from '../../../../messages/en.json';

const mockApiFetch = vi.mocked(apiFetch);

let container: HTMLDivElement;
let root: Root;

function renderActions(plan: 'FREE' | 'PRO'): void {
  act(() => {
    root.render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <BillingActions orgSlug="acme" plan={plan} />
      </NextIntlClientProvider>,
    );
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { href: '' },
  });
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
});

describe('BillingActions', () => {
  it('renders the upgrade button for a FREE org and hits the checkout-session route', async () => {
    mockApiFetch.mockResolvedValue({ url: 'https://checkout.stripe.com/session' });
    renderActions('FREE');

    const t = messages.dashboard.billing.actions;
    expect(container.textContent).toContain(t.upgrade);

    const button = container.querySelector('button') as HTMLButtonElement;
    await act(async () => {
      button.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/orgs/acme/billing/checkout-session',
      expect.anything(),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(window.location.href).toBe('https://checkout.stripe.com/session');
  });

  it('renders the manage-billing button for a PRO org and hits the portal-session route', async () => {
    mockApiFetch.mockResolvedValue({ url: 'https://billing.stripe.com/portal' });
    renderActions('PRO');

    const t = messages.dashboard.billing.actions;
    expect(container.textContent).toContain(t.managePortal);

    const button = container.querySelector('button') as HTMLButtonElement;
    await act(async () => {
      button.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/orgs/acme/billing/portal-session',
      expect.anything(),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(window.location.href).toBe('https://billing.stripe.com/portal');
  });

  it('shows an error message and re-enables the button on failure', async () => {
    mockApiFetch.mockRejectedValue(new Error('boom'));
    renderActions('FREE');

    const button = container.querySelector('button') as HTMLButtonElement;
    await act(async () => {
      button.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const t = messages.dashboard.billing.actions;
    expect(container.textContent).toContain(t.error);
    expect(button.disabled).toBe(false);
  });
});
