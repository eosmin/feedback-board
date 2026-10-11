import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { Button } from '../../../../components/ui';

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

describe('Button', () => {
  it('is disabled, busy and shows a spinner while pending, and swallows clicks', () => {
    const onClick = vi.fn();
    act(() => {
      root.render(
        <Button pending onClick={onClick}>
          Save
        </Button>,
      );
    });
    const button = container.querySelector('button') as HTMLButtonElement;

    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.querySelector('svg')).not.toBeNull();
    expect(button.textContent).toBe('Save');

    act(() => {
      button.click();
    });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('is a plain enabled button when not pending', () => {
    act(() => {
      root.render(<Button>Save</Button>);
    });
    const button = container.querySelector('button') as HTMLButtonElement;

    expect(button.disabled).toBe(false);
    expect(button.hasAttribute('aria-busy')).toBe(false);
    expect(button.querySelector('svg')).toBeNull();
    expect(button.type).toBe('button');
  });
});
