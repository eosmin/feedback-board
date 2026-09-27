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

import { CreateOrgForm } from '../../../../components/dashboard/create-org-form';
import { apiFetch, ApiError } from '../../../../lib/api-client';
import messages from '../../../../messages/en.json';

const mockApiFetch = vi.mocked(apiFetch);

let container: HTMLDivElement;
let root: Root;

function renderForm(onCreated = vi.fn()): typeof onCreated {
  act(() => {
    root.render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <CreateOrgForm onCreated={onCreated} />
      </NextIntlClientProvider>,
    );
  });
  return onCreated;
}

function setInputValue(input: HTMLInputElement, value: string): void {
  Object.defineProperty(input, 'value', { value, configurable: true });
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

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

describe('CreateOrgForm', () => {
  it('renders the nameLabel and submit copy from the message catalog', () => {
    renderForm();

    expect(container.textContent).toContain(messages.dashboard.createOrg.nameLabel);
    expect(container.textContent).toContain(messages.dashboard.createOrg.submit);
  });

  it('calls onCreated and refreshes the router on a successful creation', async () => {
    const created = {
      id: '1',
      name: 'Acme',
      slug: 'acme',
      plan: 'FREE' as const,
      role: 'OWNER' as const,
    };
    mockApiFetch.mockResolvedValue(created);
    const onCreated = renderForm();

    const nameInput = container.querySelector('#org-name') as HTMLInputElement;
    const slugInput = container.querySelector('#org-slug') as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    await act(async () => {
      setInputValue(nameInput, 'Acme');
      setInputValue(slugInput, 'acme');
      form.requestSubmit();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/orgs',
      expect.anything(),
      expect.objectContaining({ method: 'POST', body: { name: 'Acme', slug: 'acme' } }),
    );
    expect(onCreated).toHaveBeenCalledWith(created);
    expect(refreshMock).toHaveBeenCalled();
  });

  it('shows a duplicate-slug field error on a CONFLICT response, not a generic failure', async () => {
    // A well-formed, non-reserved slug so client-side zodResolver lets it through and the
    // request actually reaches apiFetch — the reserved-slug case ("login", "dashboard", etc.)
    // never gets this far, it is rejected by orgSlugSchema before submit (TDD §12).
    mockApiFetch.mockRejectedValue(new ApiError(409, { error: 'CONFLICT' }));
    renderForm();

    const nameInput = container.querySelector('#org-name') as HTMLInputElement;
    const slugInput = container.querySelector('#org-slug') as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    await act(async () => {
      setInputValue(nameInput, 'Acme');
      setInputValue(slugInput, 'acme-already-taken');
      form.requestSubmit();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain(messages.dashboard.createOrg.slugReserved);
    expect(container.textContent).not.toContain(messages.dashboard.createOrg.error);
  });

  it('shows the generic error message for a non-CONFLICT failure', async () => {
    mockApiFetch.mockRejectedValue(new ApiError(500, { error: 'INTERNAL_ERROR' }));
    renderForm();

    const nameInput = container.querySelector('#org-name') as HTMLInputElement;
    const slugInput = container.querySelector('#org-slug') as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    await act(async () => {
      setInputValue(nameInput, 'Acme');
      setInputValue(slugInput, 'acme');
      form.requestSubmit();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain(messages.dashboard.createOrg.error);
  });
});
