import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { PlanLimitUpgradePrompt } from '../../../../components/dashboard/plan-limit-upgrade-prompt';
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

describe('PlanLimitUpgradePrompt', () => {
  it('renders the plan-limit copy and a link to the org billing page, not a generic error (TDD §3.9)', () => {
    act(() => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <PlanLimitUpgradePrompt orgSlug="acme" />
        </NextIntlClientProvider>,
      );
    });

    const planLimitMessages = messages.dashboard.orgOverview.planLimit.boards;
    expect(container.textContent).toContain(planLimitMessages.title);
    expect(container.textContent).toContain(planLimitMessages.description);
    expect(container.textContent).not.toContain(messages.common.error.generic);

    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('/dashboard/acme/billing');

    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });
});
