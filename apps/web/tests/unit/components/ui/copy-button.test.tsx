import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { CopyButton } from '../../../../components/ui';
import messages from '../../../../messages/en.json';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.useRealTimers();
});

function renderButton(visibleStatus = false): HTMLButtonElement {
  act(() => {
    root.render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <CopyButton value="whsec_123" label="Copy secret" visibleStatus={visibleStatus} />
      </NextIntlClientProvider>,
    );
  });
  return container.querySelector('button') as HTMLButtonElement;
}

async function press(button: HTMLButtonElement): Promise<void> {
  await act(async () => {
    button.click();
  });
}

describe('CopyButton', () => {
  it('writes the value, announces "Copied", then resets', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const button = renderButton();
    const status = container.querySelector('[role="status"]') as HTMLElement;

    await press(button);
    expect(writeText).toHaveBeenCalledWith('whsec_123');
    expect(status.textContent).toBe(messages.common.copy.copied);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(status.textContent).toBe('');
  });

  it('announces the failure, not success, when the clipboard write is rejected', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const button = renderButton();

    await press(button);
    expect((container.querySelector('[role="status"]') as HTMLElement).textContent).toBe(
      messages.common.copy.failed,
    );
  });

  it('keeps the status screen-reader only by default and shows it with `visibleStatus`', () => {
    renderButton();
    expect((container.querySelector('[role="status"]') as HTMLElement).className).toContain(
      'sr-only',
    );

    renderButton(true);
    expect((container.querySelector('[role="status"]') as HTMLElement).className).not.toContain(
      'sr-only',
    );
  });
});
