import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { NotFoundState, PageSkeleton, RouteError } from '../../../../components/ui';
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

function render(ui: React.ReactElement): void {
  act(() => {
    root.render(
      <NextIntlClientProvider locale="en" messages={messages}>
        {ui}
      </NextIntlClientProvider>,
    );
  });
}

describe('RouteError', () => {
  it('announces the failure and runs the Next retry (not reset) on press', async () => {
    const retry = vi.fn();
    render(<RouteError retry={retry} />);

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Something went wrong',
    );

    await act(async () => {
      container.querySelector('button')?.click();
    });

    expect(retry).toHaveBeenCalledTimes(1);
  });
});

describe('NotFoundState', () => {
  it('links back to the start page', () => {
    render(<NotFoundState />);

    expect(container.querySelector('a')?.getAttribute('href')).toBe('/');
  });
});

describe('PageSkeleton', () => {
  it('is a busy status region with a screen-reader label and the requested rows', () => {
    render(<PageSkeleton rows={4} />);

    const region = container.querySelector('[role="status"]');
    expect(region?.getAttribute('aria-busy')).toBe('true');
    expect(region?.textContent).toBe('Loading…');
    // One header bar plus one placeholder per row.
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(4 + 1);
  });
});
