import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { Select } from '../../../../components/ui';

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

const OPTIONS = [
  { value: 'OPEN', label: 'Open' },
  { value: 'DONE', label: 'Done' },
];

describe('Select', () => {
  it('exposes an accessible combobox showing the selected label', () => {
    act(() => {
      root.render(
        <Select value="DONE" onValueChange={vi.fn()} options={OPTIONS} aria-label="Status" />,
      );
    });
    const trigger = container.querySelector('[role="combobox"]') as HTMLElement;
    expect(trigger.getAttribute('aria-label')).toBe('Status');
    expect(trigger.textContent).toBe('Done');
  });

  it('does not open while disabled', () => {
    act(() => {
      root.render(
        <Select
          value="OPEN"
          onValueChange={vi.fn()}
          options={OPTIONS}
          aria-label="Status"
          disabled
        />,
      );
    });
    const trigger = container.querySelector('[role="combobox"]') as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
  });
});
