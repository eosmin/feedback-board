import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { OrgSwitcher } from '../../../../components/dashboard/org-switcher';
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

describe('OrgSwitcher', () => {
  it('returns focus to its button when the create dialog closes, since the menu item is gone', async () => {
    act(() => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <OrgSwitcher
            currentOrgSlug="acme"
            currentOrgName="Acme"
            orgs={[{ id: '1', name: 'Acme', slug: 'acme', plan: 'FREE', role: 'OWNER' }]}
          />
        </NextIntlClientProvider>,
      );
    });

    const trigger = container.querySelector('button[aria-haspopup="menu"]') as HTMLButtonElement;
    act(() => {
      trigger.click();
    });
    const createItem = Array.from(container.querySelectorAll('button[role="menuitem"]')).find(
      (item) => item.textContent === messages.dashboard.shell.orgSwitcher.createNew,
    ) as HTMLButtonElement;
    act(() => {
      createItem.click();
    });
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(createItem.isConnected).toBe(false);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('always offers "All organizations", even with few orgs', () => {
    act(() => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <OrgSwitcher
            currentOrgSlug="acme"
            currentOrgName="Acme"
            orgs={[{ id: '1', name: 'Acme', slug: 'acme', plan: 'FREE', role: 'OWNER' }]}
          />
        </NextIntlClientProvider>,
      );
    });
    act(() => {
      (container.querySelector('button[aria-haspopup="menu"]') as HTMLButtonElement).click();
    });

    const link = container.querySelector('a[href="/dashboard"]');
    expect(link?.textContent).toBe(messages.dashboard.shell.orgSwitcher.allOrgs);
  });
});
