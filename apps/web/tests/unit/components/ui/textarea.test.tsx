import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { Textarea } from '../../../../components/ui';

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

function keyDown(node: HTMLElement, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  act(() => {
    node.dispatchEvent(event);
  });
  return event;
}

describe('Textarea', () => {
  it('submits the enclosing form on Cmd+Enter and Ctrl+Enter, but not on plain Enter', () => {
    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    act(() => {
      root.render(
        <form onSubmit={(event) => onSubmit(event.nativeEvent)}>
          <Textarea submitOnShortcut aria-label="body" />
        </form>,
      );
    });
    const area = container.querySelector('textarea') as HTMLTextAreaElement;

    keyDown(area, { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();

    keyDown(area, { key: 'Enter', metaKey: true });
    keyDown(area, { key: 'Enter', ctrlKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it('does not submit on the shortcut unless it is opted in', () => {
    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    act(() => {
      root.render(
        <form onSubmit={(event) => onSubmit(event.nativeEvent)}>
          <Textarea aria-label="body" />
        </form>,
      );
    });

    keyDown(container.querySelector('textarea') as HTMLTextAreaElement, {
      key: 'Enter',
      metaKey: true,
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('starts collapsed at one row and sizes itself to its content when autoGrow is on', () => {
    act(() => {
      root.render(<Textarea autoGrow defaultValue="" aria-label="body" />);
    });
    const area = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(area.rows).toBe(1);

    // jsdom does no layout, so scrollHeight is stubbed: the contract is "height follows it".
    Object.defineProperty(area, 'scrollHeight', { configurable: true, value: 96 });
    act(() => {
      area.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(area.style.height).toBe('96px');
  });

  it('still hands the DOM node to a forwarded ref (react-hook-form register)', () => {
    const ref = createRef<HTMLTextAreaElement>();
    act(() => {
      root.render(<Textarea ref={ref} autoGrow aria-label="body" />);
    });
    expect(ref.current).toBe(container.querySelector('textarea'));
  });
});
