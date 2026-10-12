import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const navigation = vi.hoisted(() => ({ pathname: '/dashboard', search: '' }));

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

import { NavigationProgress } from '../../../../components/ui';

let container: HTMLDivElement;
let root: Root;

function renderBar(): void {
  act(() => {
    root.render(<NavigationProgress />);
  });
}

/** An anchor that behaves like a `next/link` one: its own handler takes the click over. */
function addLink(href: string, { handled = true }: { handled?: boolean } = {}): HTMLAnchorElement {
  const anchor = document.createElement('a');
  anchor.href = href;
  if (handled) anchor.addEventListener('click', (event) => event.preventDefault());
  document.body.appendChild(anchor);
  return anchor;
}

function click(anchor: HTMLAnchorElement, init: MouseEventInit = {}): void {
  act(() => {
    anchor.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }),
    );
  });
}

const isNavigating = (): boolean => document.documentElement.hasAttribute('data-navigating');

beforeEach(() => {
  vi.useFakeTimers();
  navigation.pathname = '/dashboard';
  navigation.search = '';
  window.history.replaceState(null, '', '/dashboard');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  renderBar();
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  document.body.querySelectorAll('a').forEach((anchor) => anchor.remove());
  vi.useRealTimers();
});

describe('NavigationProgress', () => {
  it('marks the page and only the pressed link as pending when the router takes a click', () => {
    const pressed = addLink('/dashboard/acme');
    const other = addLink('/dashboard/other');

    click(pressed);

    expect(isNavigating()).toBe(true);
    expect(pressed.hasAttribute('data-nav-pending')).toBe(true);
    expect(other.hasAttribute('data-nav-pending')).toBe(false);
    expect(container.querySelector<HTMLElement>('.nav-progress-bar')?.style.opacity).toBe('1');
  });

  it('finishes when the pathname changes', () => {
    const link = addLink('/dashboard/acme');
    click(link);

    navigation.pathname = '/dashboard/acme';
    renderBar();

    expect(isNavigating()).toBe(false);
    expect(link.hasAttribute('data-nav-pending')).toBe(false);
    expect(container.querySelector<HTMLElement>('.nav-progress-bar')?.style.opacity).toBe('0');
  });

  it('finishes when only the query string changes', () => {
    click(addLink('/dashboard?sort=top'));

    navigation.search = 'sort=top';
    renderBar();

    expect(isNavigating()).toBe(false);
  });

  it('gives up on a navigation that never lands', () => {
    const link = addLink('/dashboard/acme');
    click(link);

    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    expect(isNavigating()).toBe(false);
    expect(link.hasAttribute('data-nav-pending')).toBe(false);
  });

  it('moves the pending mark to the last pressed link', () => {
    const first = addLink('/dashboard/a');
    const second = addLink('/dashboard/b');

    click(first);
    click(second);

    expect(first.hasAttribute('data-nav-pending')).toBe(false);
    expect(second.hasAttribute('data-nav-pending')).toBe(true);
  });

  it.each([
    ['a click the router did not handle', () => addLink('/dashboard/acme', { handled: false }), {}],
    ['a modified click (new tab)', () => addLink('/dashboard/acme'), { ctrlKey: true }],
    ['a middle click', () => addLink('/dashboard/acme'), { button: 1 }],
    ['an external link', () => addLink('https://example.com/'), {}],
    ['a link to the current URL', () => addLink('/dashboard'), {}],
    ['a hash jump', () => addLink('/dashboard#section'), {}],
  ])('ignores %s', (_label, makeLink, init) => {
    click(makeLink(), init);

    expect(isNavigating()).toBe(false);
  });
});
