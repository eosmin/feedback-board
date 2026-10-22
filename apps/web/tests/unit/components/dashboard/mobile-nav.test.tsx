import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import Link from 'next/link';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { MobileNav } from '../../../../components/dashboard/mobile-nav';
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

describe('MobileNav', () => {
  it('opens the nav in a drawer and closes it when a link is followed', async () => {
    act(() => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <MobileNav>
            <Link href="/dashboard/acme/billing" onClick={(event) => event.preventDefault()}>
              Billing
            </Link>
          </MobileNav>
        </NextIntlClientProvider>,
      );
    });

    const trigger = container.querySelector('button[aria-haspopup="dialog"]') as HTMLButtonElement;
    expect(trigger.getAttribute('aria-label')).toBe(messages.dashboard.shell.menu.open);
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();

    act(() => {
      trigger.click();
    });
    const link = document.body.querySelector('[role="dialog"] a') as HTMLAnchorElement;
    expect(link.textContent).toBe('Billing');

    act(() => {
      link.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes when the viewport grows past the sidebar breakpoint', () => {
    let notify: (event: { matches: boolean }) => void = () => undefined;
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: (_type: string, listener: typeof notify) => {
        notify = listener;
      },
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;

    act(() => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <MobileNav>
            <span>Boards</span>
          </MobileNav>
        </NextIntlClientProvider>,
      );
    });
    act(() => {
      (container.querySelector('button[aria-haspopup="dialog"]') as HTMLButtonElement).click();
    });
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();

    act(() => {
      notify({ matches: true });
    });

    expect(container.querySelector('button[aria-expanded="true"]')).toBeNull();
  });
});
