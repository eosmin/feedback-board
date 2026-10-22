import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const navigation = vi.hoisted(() => ({ pathname: '/dashboard/acme' }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => navigation.pathname,
}));

import {
  BoardLabelProvider,
  usePublishBoardLabel,
} from '../../../../components/dashboard/board-breadcrumb-label';
import { OrgBreadcrumb } from '../../../../components/dashboard/org-breadcrumb';
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

function BoardPage({ name }: { name: string | null }): null {
  usePublishBoardLabel('roadmap', name);
  return null;
}

function renderBreadcrumb(pathname: string, boardName: string | null = null): HTMLElement {
  navigation.pathname = pathname;
  act(() => {
    root.render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <BoardLabelProvider>
          <OrgBreadcrumb
            orgSlug="acme"
            orgName="Acme"
            orgs={[{ id: '1', name: 'Acme', slug: 'acme', plan: 'FREE', role: 'OWNER' }]}
          />
          {boardName !== null && <BoardPage name={boardName} />}
        </BoardLabelProvider>
      </NextIntlClientProvider>,
    );
  });
  return container.querySelector('nav') as HTMLElement;
}

describe('OrgBreadcrumb', () => {
  it('shows the boards section as the current page on the overview', () => {
    const nav = renderBreadcrumb('/dashboard/acme');
    const current = nav.querySelector('[aria-current="page"]');
    expect(current?.textContent).toBe(messages.dashboard.shell.nav.boards);
    expect(nav.querySelector('a[href="/dashboard/acme"]')).toBeNull();
  });

  it('adds the section as the current page below the org', () => {
    const nav = renderBreadcrumb('/dashboard/acme/billing');
    const current = nav.querySelector('[aria-current="page"]');
    expect(current?.textContent).toBe(messages.dashboard.shell.nav.billing);
  });

  it('links the boards section back to the overview and names the open board', () => {
    const nav = renderBreadcrumb('/dashboard/acme/boards/roadmap', 'Public roadmap');
    const sectionLink = nav.querySelector('a[href="/dashboard/acme"]');
    expect(sectionLink?.textContent).toBe(messages.dashboard.shell.nav.boards);
    expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe('Public roadmap');
  });

  it('holds a placeholder instead of the slug until the board page publishes its name', () => {
    const nav = renderBreadcrumb('/dashboard/acme/boards/roadmap');
    expect(nav.querySelector('[aria-current="page"]')).toBeNull();
    expect(nav.textContent).not.toContain('roadmap');
  });
});
