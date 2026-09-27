import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { BoardList } from '../../../../components/dashboard/board-list';
import messages from '../../../../messages/en.json';

let container: HTMLDivElement;
let root: Root;

function renderList(boards: Parameters<typeof BoardList>[0]['boards']): void {
  act(() => {
    root.render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <BoardList orgSlug="acme" boards={boards} />
      </NextIntlClientProvider>,
    );
  });
}

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

describe('BoardList', () => {
  it('renders the empty-state copy when the org has no boards', () => {
    renderList([]);

    expect(container.textContent).toContain(messages.dashboard.orgOverview.boardsEmpty);
  });

  it('renders one entry per board with its visibility and a link to its detail page', () => {
    renderList([
      {
        id: '1',
        orgId: 'org-1',
        name: 'Feature Requests',
        slug: 'feature-requests',
        isPublic: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: '2',
        orgId: 'org-1',
        name: 'Internal Bugs',
        slug: 'internal-bugs',
        isPublic: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    expect(container.textContent).toContain('Feature Requests');
    expect(container.textContent).toContain(messages.dashboard.orgOverview.visibility.public);
    expect(container.textContent).toContain('Internal Bugs');
    expect(container.textContent).toContain(messages.dashboard.orgOverview.visibility.private);

    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(2);
    expect(links[0]?.getAttribute('href')).toBe('/dashboard/acme/boards/feature-requests');
    expect(links[1]?.getAttribute('href')).toBe('/dashboard/acme/boards/internal-bugs');
  });
});
