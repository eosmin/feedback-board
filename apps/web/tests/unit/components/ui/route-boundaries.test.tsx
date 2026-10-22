import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import {
  NotFoundState,
  PageSkeleton,
  RouteError,
  StandaloneScreen,
} from '../../../../components/ui';
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

describe('StandaloneScreen', () => {
  it('centres its content in <main> and keeps theme and language reachable', () => {
    render(
      <StandaloneScreen>
        <NotFoundState />
      </StandaloneScreen>,
    );

    expect(container.querySelector('main h1')?.textContent).toBe('Page not found');
    expect(container.querySelector('button[aria-label="Language"]')).not.toBeNull();
  });
});

describe('PageSkeleton', () => {
  it('is a busy main with a status label for screen readers and the requested rows', () => {
    render(<PageSkeleton rows={4} />);

    // A `<main>`, like the real pages, so the global width rule applies and nothing shifts.
    const main = container.querySelector('main');
    expect(main?.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Loading…');
    // One header bar plus one placeholder per row.
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(4 + 1);
  });
});
