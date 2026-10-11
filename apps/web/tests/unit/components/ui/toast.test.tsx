import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { ToastProvider, useToast } from '../../../../components/ui';
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

function Trigger(): React.ReactElement {
  const { toast } = useToast();
  return (
    <>
      <button type="button" id="ok" onClick={() => toast('Saved')}>
        ok
      </button>
      <button type="button" id="bad" onClick={() => toast('Failed', 'error')}>
        bad
      </button>
    </>
  );
}

function renderTree(): void {
  act(() => {
    root.render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ToastProvider>
          <Trigger />
        </ToastProvider>
      </NextIntlClientProvider>,
    );
  });
}

function click(id: string): void {
  act(() => {
    (document.getElementById(id) as HTMLButtonElement).click();
  });
}

describe('Toast', () => {
  it('shows the message and announces it through a live region', async () => {
    renderTree();
    click('ok');
    // Radix mounts the announcer one animation frame after the toast.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(document.body.textContent).toContain('Saved');
    // Radix mirrors every foreground toast into its own announcer so screen readers read it.
    const announcer = Array.from(document.body.querySelectorAll('[role="status"]')).find((node) =>
      node.textContent?.includes('Saved'),
    );
    expect(announcer).toBeDefined();
    expect(announcer?.getAttribute('aria-live')).toBe('assertive');
  });

  it('labels the notification region and stacks several toasts', () => {
    renderTree();
    click('ok');
    click('bad');

    expect(document.body.querySelector(`[aria-label^="${messages.common.toast.region}"]`)).not.toBeNull();
    expect(document.body.textContent).toContain('Saved');
    expect(document.body.textContent).toContain('Failed');
  });

  it('dismisses a toast from its close button', () => {
    renderTree();
    click('ok');
    const close = document.body.querySelector(`[aria-label="${messages.common.close}"]`) as HTMLButtonElement;
    act(() => {
      close.click();
    });
    // Exit animation is instant in jsdom (no animationend needed without a running animation).
    expect(document.body.querySelector('li')?.textContent ?? '').not.toContain('Saved');
  });

  it('refuses to be used outside its provider', () => {
    expect(() => {
      act(() => {
        root.render(<Trigger />);
      });
    }).toThrow(/ToastProvider/);
  });
});
