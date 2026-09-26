import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// React 18+ checks this flag before honoring act(...) (see https://react.dev/warnings/react-dom-test-utils
// for the exact contract). Libraries like @testing-library/react set it automatically on import;
// this project intentionally has no such dependency pinned in TDD §2.3, so this file sets it itself.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../../../lib/supabase/client', () => ({
  createSupabaseBrowserClient: vi.fn(),
}));

import { MagicLinkForm } from '../../../../components/auth/magic-link-form';
import { createSupabaseBrowserClient } from '../../../../lib/supabase/client';
import messages from '../../../../messages/en.json';

const mockCreateSupabaseBrowserClient = vi.mocked(createSupabaseBrowserClient);

let container: HTMLDivElement;
let root: Root;

function renderForm(): void {
  act(() => {
    root.render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <MagicLinkForm />
      </NextIntlClientProvider>,
    );
  });
}

function signInWithOtpMock(result: {
  error: { message: string } | null;
}): ReturnType<typeof vi.fn> {
  const signInWithOtp = vi.fn().mockResolvedValue(result);
  mockCreateSupabaseBrowserClient.mockReturnValue({
    auth: { signInWithOtp },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  return signInWithOtp;
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
});

describe('MagicLinkForm', () => {
  it('renders the emailLabel and submit copy from the message catalog', () => {
    signInWithOtpMock({ error: null });
    renderForm();

    expect(container.textContent).toContain(messages.login.emailLabel);
    expect(container.textContent).toContain(messages.login.submit);
  });

  it('shows a field error and never calls signInWithOtp for an invalid email', async () => {
    const signInWithOtp = signInWithOtpMock({ error: null });
    renderForm();

    const input = container.querySelector('input[type="email"]') as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    await act(async () => {
      Object.defineProperty(input, 'value', { value: 'not-an-email', configurable: true });
      input.dispatchEvent(new Event('input', { bubbles: true }));
      form.requestSubmit();
      await Promise.resolve();
    });

    expect(container.textContent).toContain(messages.login.emailInvalid);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it('calls signInWithOtp with the redirect target and shows the checkEmail state on success', async () => {
    const signInWithOtp = signInWithOtpMock({ error: null });
    renderForm();

    const input = container.querySelector('input[type="email"]') as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    await act(async () => {
      Object.defineProperty(input, 'value', { value: 'erick@example.com', configurable: true });
      input.dispatchEvent(new Event('input', { bubbles: true }));
      form.requestSubmit();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'erick@example.com',
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    expect(container.textContent).toContain('erick@example.com');
  });

  it('shows the generic error message when signInWithOtp fails', async () => {
    signInWithOtpMock({ error: { message: 'network down' } });
    renderForm();

    const input = container.querySelector('input[type="email"]') as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    await act(async () => {
      Object.defineProperty(input, 'value', { value: 'erick@example.com', configurable: true });
      input.dispatchEvent(new Event('input', { bubbles: true }));
      form.requestSubmit();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain(messages.login.error);
  });
});
