import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock('../../../../lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('../../../../lib/api-client')>(
    '../../../../lib/api-client',
  );
  return { ...actual, apiFetch: vi.fn() };
});

import { OrgPicker } from '../../../../components/dashboard/org-picker';
import { apiFetch } from '../../../../lib/api-client';
import messages from '../../../../messages/en.json';

const mockApiFetch = vi.mocked(apiFetch);

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
  vi.restoreAllMocks();
  refreshMock.mockClear();
});

describe('OrgPicker', () => {
  it('appends a newly created org to the list without waiting for a reload (Done when, TDD §13 step 19.1)', async () => {
    const created = {
      id: '2',
      name: 'Umbrella',
      slug: 'umbrella',
      plan: 'FREE' as const,
      role: 'OWNER' as const,
    };
    mockApiFetch.mockResolvedValue(created);

    act(() => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <OrgPicker
            initialOrgs={[{ id: '1', name: 'Acme', slug: 'acme', plan: 'FREE', role: 'OWNER' }]}
          />
        </NextIntlClientProvider>,
      );
    });

    expect(container.textContent).toContain('Acme');
    expect(container.textContent).not.toContain('Umbrella');

    const nameInput = container.querySelector('#org-name') as HTMLInputElement;
    const slugInput = container.querySelector('#org-slug') as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    await act(async () => {
      Object.defineProperty(nameInput, 'value', { value: 'Umbrella', configurable: true });
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      Object.defineProperty(slugInput, 'value', { value: 'umbrella', configurable: true });
      slugInput.dispatchEvent(new Event('input', { bubbles: true }));
      form.requestSubmit();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Acme');
    expect(container.textContent).toContain('Umbrella');
  });
});
