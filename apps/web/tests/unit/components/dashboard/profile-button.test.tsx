import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../../../lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('../../../../lib/api-client')>(
    '../../../../lib/api-client',
  );
  return { ...actual, apiFetch: vi.fn() };
});

import { ProfileButton } from '../../../../components/dashboard/profile-button';
import { ToastProvider } from '../../../../components/ui';
import { apiFetch } from '../../../../lib/api-client';
import messages from '../../../../messages/en.json';

const mockApiFetch = vi.mocked(apiFetch);
const copy = messages.dashboard.shell.profile;
const PROFILE = {
  id: '3f1a7c2e-9b4d-4f8a-9c1e-7d5b2a6e0f43',
  email: 'ada@example.com',
  name: null,
};

let container: HTMLDivElement;
let root: Root;

function byLabel(label: string): HTMLElement {
  const found = document.querySelector(`[aria-label="${label}"]`);
  if (!(found instanceof HTMLElement)) {
    throw new Error(`no element labelled "${label}"`);
  }
  return found;
}

function byId(id: string): HTMLInputElement {
  const found = document.getElementById(id);
  if (!(found instanceof HTMLInputElement)) {
    throw new Error(`no input #${id}`);
  }
  return found;
}

function setInputValue(input: HTMLInputElement, value: string): void {
  Object.defineProperty(input, 'value', { value, configurable: true });
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function openDialog(): Promise<void> {
  await act(async () => {
    byLabel(copy.trigger).click();
  });
  await flush();
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

/** The profile is fetched on mount, so the mock must be set up before this runs. */
async function renderButton(): Promise<void> {
  await act(async () => {
    root.render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ToastProvider>
          <ProfileButton />
        </ToastProvider>
      </NextIntlClientProvider>,
    );
  });
  await flush();
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.resetAllMocks();
});

describe('ProfileButton', () => {
  it('fetches the profile on mount, before the dialog is ever opened', async () => {
    mockApiFetch.mockResolvedValue(PROFILE);

    await renderButton();

    expect(mockApiFetch).toHaveBeenCalledWith('/me', expect.anything());
    expect(document.querySelector('form')).toBeNull();
  });

  it('keeps the button disabled until the profile has loaded', async () => {
    mockApiFetch.mockReturnValue(new Promise(() => undefined));

    await renderButton();

    expect(byLabel(copy.trigger)).toHaveProperty('disabled', true);
  });

  it('opens with the form already there: the email, an empty field, and focus on it', async () => {
    mockApiFetch.mockResolvedValue(PROFILE);
    await renderButton();

    await openDialog();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(document.body.textContent).toContain('ada@example.com');
    expect(byId('profile-name').value).toBe('');
    expect(document.activeElement).toBe(byId('profile-name'));
  });

  it('saves the name with PATCH /me, closes the dialog and confirms with a toast', async () => {
    mockApiFetch.mockResolvedValueOnce(PROFILE);
    await renderButton();
    await openDialog();
    mockApiFetch.mockResolvedValueOnce({ ...PROFILE, name: 'Ada' });

    await act(async () => {
      setInputValue(byId('profile-name'), 'Ada');
      document.querySelector('form')?.requestSubmit();
    });
    await flush();

    expect(mockApiFetch).toHaveBeenLastCalledWith('/me', expect.anything(), {
      method: 'PATCH',
      body: { name: 'Ada' },
    });
    expect(document.querySelector('form')).toBeNull();
    expect(document.body.textContent).toContain(copy.saved);
  });

  it('shows the saved name the next time the dialog opens, without another request', async () => {
    mockApiFetch.mockResolvedValueOnce(PROFILE);
    await renderButton();
    await openDialog();
    mockApiFetch.mockResolvedValueOnce({ ...PROFILE, name: 'Ada' });
    await act(async () => {
      setInputValue(byId('profile-name'), 'Ada');
      document.querySelector('form')?.requestSubmit();
    });
    await flush();

    await openDialog();

    expect(byId('profile-name').value).toBe('Ada');
    expect(mockApiFetch).toHaveBeenCalledTimes(2);
  });

  it('refuses a blank name without calling the API', async () => {
    mockApiFetch.mockResolvedValueOnce(PROFILE);
    await renderButton();
    await openDialog();

    await act(async () => {
      setInputValue(byId('profile-name'), '   ');
      document.querySelector('form')?.requestSubmit();
    });
    await flush();

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain(copy.nameInvalid);
  });

  it('keeps the dialog open with an error when saving fails', async () => {
    mockApiFetch.mockResolvedValueOnce(PROFILE);
    await renderButton();
    await openDialog();
    mockApiFetch.mockRejectedValueOnce(new Error('network'));

    await act(async () => {
      setInputValue(byId('profile-name'), 'Ada');
      document.querySelector('form')?.requestSubmit();
    });
    await flush();

    expect(document.querySelector('form')).not.toBeNull();
    expect(document.body.textContent).toContain(copy.error);
  });

  it('opens on a load error when the profile could not be fetched', async () => {
    mockApiFetch.mockRejectedValue(new Error('network'));
    await renderButton();

    await openDialog();

    expect(document.body.textContent).toContain(copy.loadError);
    expect(document.querySelector('form')).toBeNull();
  });
});
