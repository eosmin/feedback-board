import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const navigation = vi.hoisted(() => ({ pathname: '/dashboard/acme' }));

vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }));

import { NavLink } from '../../../../components/ui';

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

function currentLinks(pathname: string): string[] {
  navigation.pathname = pathname;
  act(() => {
    root.render(
      <>
        <NavLink href="/dashboard/acme" end activePaths={['/dashboard/acme/boards']}>
          Boards
        </NavLink>
        <NavLink href="/dashboard/acme/billing">Billing</NavLink>
      </>,
    );
  });
  return Array.from(container.querySelectorAll('a[aria-current="page"]')).map(
    (link) => link.textContent ?? '',
  );
}

describe('NavLink', () => {
  it('marks the entry whose path matches as the current page', () => {
    expect(currentLinks('/dashboard/acme/billing')).toEqual(['Billing']);
  });

  it('keeps an `end` link inactive on the sections below it', () => {
    expect(currentLinks('/dashboard/acme')).toEqual(['Boards']);
    expect(currentLinks('/dashboard/acme/billing')).not.toContain('Boards');
  });

  it('marks a link active for the extra paths it claims', () => {
    expect(currentLinks('/dashboard/acme/boards/roadmap')).toEqual(['Boards']);
  });

  it('does not treat a longer sibling name as a descendant', () => {
    expect(currentLinks('/dashboard/acme/billing-history')).toEqual([]);
  });
});
