import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

import { LocaleSwitcher } from '../../../../components/ui';
import messages from '../../../../messages/en.json';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <LocaleSwitcher />
      </NextIntlClientProvider>,
    );
  });
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  refresh.mockClear();
});

function trigger(): HTMLButtonElement {
  return container.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!;
}

function open(): void {
  act(() => {
    trigger().click();
  });
}

function press(key: string): void {
  act(() => {
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

describe('LocaleSwitcher keyboard', () => {
  it('moves focus to the checked item when opened', () => {
    open();
    expect(document.activeElement?.getAttribute('aria-checked')).toBe('true');
  });

  it('closes on Escape and returns focus to the trigger', () => {
    open();
    press('Escape');
    expect(container.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('moves between items with the arrow keys, wrapping around', () => {
    open();
    const items = Array.from(container.querySelectorAll<HTMLElement>('[role="menuitemradio"]'));
    press('ArrowDown');
    expect(document.activeElement).toBe(items[1]);
    press('ArrowDown');
    expect(document.activeElement).toBe(items[0]);
    press('ArrowUp');
    expect(document.activeElement).toBe(items[1]);
  });

  it('closes on Tab so focus is not trapped', () => {
    open();
    press('Tab');
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });
});
