import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { OrgList } from '../../../../components/dashboard/org-list';
import messages from '../../../../messages/en.json';

let container: HTMLDivElement;
let root: Root;

function renderList(orgs: Parameters<typeof OrgList>[0]['orgs']): void {
  act(() => {
    root.render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <OrgList orgs={orgs} />
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

describe('OrgList', () => {
  it('renders the empty-state copy when the caller has no orgs', () => {
    renderList([]);

    expect(container.textContent).toContain(messages.dashboard.empty);
  });

  it('renders one entry per org with its plan badge and a link to its dashboard', () => {
    renderList([
      { id: '1', name: 'Acme', slug: 'acme', plan: 'FREE', role: 'OWNER' },
      { id: '2', name: 'Umbrella', slug: 'umbrella', plan: 'PRO', role: 'MEMBER' },
    ]);

    expect(container.textContent).toContain('Acme');
    expect(container.textContent).toContain(messages.dashboard.planBadge.FREE);
    expect(container.textContent).toContain('Umbrella');
    expect(container.textContent).toContain(messages.dashboard.planBadge.PRO);

    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(2);
    expect(links[0]?.getAttribute('href')).toBe('/dashboard/acme');
    expect(links[1]?.getAttribute('href')).toBe('/dashboard/umbrella');
  });
});
