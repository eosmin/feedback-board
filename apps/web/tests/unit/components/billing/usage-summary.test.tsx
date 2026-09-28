import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { UsageSummary } from '../../../../components/billing/usage-summary';
import messages from '../../../../messages/en.json';

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
});

describe('UsageSummary', () => {
  it('renders used/cap for FREE plan caps', () => {
    act(() => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <UsageSummary
            usage={{
              boards: { used: 1, cap: 1 },
              posts: { used: 12, cap: 50 },
              webhooks: { available: false },
            }}
          />
        </NextIntlClientProvider>,
      );
    });

    expect(container.textContent).toContain('1 / 1');
    expect(container.textContent).toContain('12 / 50');
    expect(container.textContent).toContain(messages.dashboard.billing.usage.unavailable);
  });

  it('renders "unlimited" for a null cap (PRO plan)', () => {
    act(() => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <UsageSummary
            usage={{
              boards: { used: 5, cap: null },
              posts: { used: 200, cap: null },
              webhooks: { available: true },
            }}
          />
        </NextIntlClientProvider>,
      );
    });

    const t = messages.dashboard.billing.usage;
    expect(container.textContent).toContain(`5 / ${t.unlimited}`);
    expect(container.textContent).toContain(`200 / ${t.unlimited}`);
    expect(container.textContent).toContain(t.available);
  });
});
