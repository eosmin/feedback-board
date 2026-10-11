import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { Dialog, Drawer } from '../../../../components/ui';

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

const PRIMITIVES = [
  ['Dialog', Dialog],
  ['Drawer', Drawer],
] as const;

describe.each(PRIMITIVES)('%s', (_name, Primitive) => {
  function renderOpen(onClose: () => void): void {
    act(() => {
      root.render(
        <>
          <button type="button">background</button>
          <Primitive open onClose={onClose} title="Panel title" closeLabel="Close panel">
            <button type="button">first</button>
            <button type="button">last</button>
          </Primitive>
        </>,
      );
    });
  }

  it('is an accessible modal named by its title, and renders nothing while closed', () => {
    renderOpen(vi.fn());
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement;
    const titleId = dialog.getAttribute('aria-labelledby') as string;
    expect(document.getElementById(titleId)?.textContent).toBe('Panel title');

    act(() => {
      root.render(
        <Primitive open={false} onClose={vi.fn()} title="Panel title" closeLabel="Close panel">
          x
        </Primitive>,
      );
    });
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it('closes on Escape and on the labelled close button', () => {
    const onClose = vi.fn();
    renderOpen(onClose);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    const close = document.body.querySelector('[aria-label="Close panel"]') as HTMLButtonElement;
    act(() => {
      close.click();
    });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('moves focus inside on open and keeps Tab inside the panel', () => {
    renderOpen(vi.fn());
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.contains(document.activeElement)).toBe(true);

    const last = Array.from(dialog.querySelectorAll('button')).pop() as HTMLButtonElement;
    last.focus();
    act(() => {
      last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(document.body);
  });

  it('starts on the first form field instead of the close button', () => {
    act(() => {
      root.render(
        <Primitive open onClose={vi.fn()} title="Panel title" closeLabel="Close panel">
          <input aria-label="name" />
        </Primitive>,
      );
    });
    expect(document.activeElement).toBe(document.body.querySelector('input'));
  });

  it('hides the background from assistive technology while open', () => {
    renderOpen(vi.fn());
    expect(container.getAttribute('aria-hidden')).toBe('true');
  });
});
