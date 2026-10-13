import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('../../../../lib/supabase/client', () => ({ createSupabaseBrowserClient: vi.fn() }));

import PickerLoading from '../../../../app/dashboard/(picker)/loading';
import en from '../../../../messages/en.json';
import es from '../../../../messages/es.json';

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

// `es.json` has the same keys as `en.json` (kept in sync by hand) but its string values are not the
// literal types `AppConfig` derives from `en.json`, so it needs the cast to be passed as messages.
const esMessages = es as unknown as typeof en;

describe.each([
  ['en', en],
  ['es', esMessages],
] as const)('picker loading (%s)', (locale, messages) => {
  it('shows the real title and a disabled create button with the translated label', () => {
    act(() => {
      root.render(
        <NextIntlClientProvider locale={locale} messages={messages}>
          <PickerLoading />
        </NextIntlClientProvider>,
      );
    });

    expect(container.querySelector('h1')?.textContent).toBe(messages.dashboard.title);
    const button = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent === messages.dashboard.createOrg.trigger,
    ) as HTMLButtonElement;
    expect(button.textContent).toBe(messages.dashboard.createOrg.trigger);
    expect(button.disabled).toBe(true);
    expect(button.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
