import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { BoardsUsage } from '../../../../components/dashboard/boards-usage';
import messages from '../../../../messages/en.json';

let container: HTMLDivElement;
let root: Root;

function renderUsage(usage: Parameters<typeof BoardsUsage>[0]['usage']): void {
  act(() => {
    root.render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <BoardsUsage usage={usage} />
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

describe('BoardsUsage', () => {
  it('labels a capped plan and fills the bar in proportion', () => {
    renderUsage({ used: 1, cap: 4 });

    expect(container.textContent).toContain('1 of 4 boards used');
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-valuenow')).toBe('1');
    expect(bar?.getAttribute('aria-valuemax')).toBe('4');
    expect((bar?.firstElementChild as HTMLElement).style.width).toBe('25%');
  });

  it('flags the bar as full at the cap', () => {
    renderUsage({ used: 1, cap: 1 });

    expect(container.querySelector('[role="progressbar"] > div')?.className).toContain(
      'bg-warning',
    );
  });

  it('shows plain text, no bar, when the plan has no cap', () => {
    renderUsage({ used: 3, cap: null });

    expect(container.textContent).toContain('3 boards · no limit');
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
  });
});
