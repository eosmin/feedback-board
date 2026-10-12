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
  it('shows the callback error until a new link is requested', async () => {
    signInWithOtpMock({ error: { message: 'network down' } });
    act(() => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <MagicLinkForm callbackFailed />
        </NextIntlClientProvider>,
      );
    });
    expect(container.textContent).toContain(messages.login.callbackError.title);

    const input = container.querySelector('input[type="email"]') as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;
    await act(async () => {
      Object.defineProperty(input, 'value', { value: 'erick@example.com', configurable: true });
      input.dispatchEvent(new Event('input', { bubbles: true }));
      form.requestSubmit();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain(messages.login.callbackError.title);
  });

  describe('after the link is sent', () => {
    async function submitValidEmail(): Promise<void> {
      const input = container.querySelector('input[type="email"]') as HTMLInputElement;
      const form = container.querySelector('form') as HTMLFormElement;
      await act(async () => {
        Object.defineProperty(input, 'value', { value: 'erick@example.com', configurable: true });
        input.dispatchEvent(new Event('input', { bubbles: true }));
        form.requestSubmit();
        await Promise.resolve();
        await Promise.resolve();
      });
    }

    function buttonByText(text: string): HTMLButtonElement {
      const button = Array.from(container.querySelectorAll('button')).find((candidate) =>
        candidate.textContent?.includes(text),
      );
      if (button === undefined) {
        throw new Error(`no button containing "${text}"`);
      }
      return button;
    }

    it('disables resend during the cooldown and re-enables it afterwards', async () => {
      vi.useFakeTimers();
      try {
        signInWithOtpMock({ error: null });
        renderForm();
        await submitValidEmail();

        expect(buttonByText('Resend in 30s').disabled).toBe(true);

        // One act per tick: each re-render schedules the next one-second timer.
        for (let second = 0; second < 30; second += 1) {
          await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
          });
        }

        expect(buttonByText(messages.login.resend).disabled).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it('sends a second link on resend and restarts the cooldown', async () => {
      vi.useFakeTimers();
      try {
        const signInWithOtp = signInWithOtpMock({ error: null });
        renderForm();
        await submitValidEmail();
        for (let second = 0; second < 30; second += 1) {
          await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
          });
        }

        await act(async () => {
          buttonByText(messages.login.resend).click();
          await Promise.resolve();
          await Promise.resolve();
        });

        expect(signInWithOtp).toHaveBeenCalledTimes(2);
        expect(buttonByText('Resend in 30s').disabled).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it('shows the error and releases the button when a resend throws', async () => {
      vi.useFakeTimers();
      try {
        const signInWithOtp = signInWithOtpMock({ error: null });
        renderForm();
        await submitValidEmail();
        for (let second = 0; second < 30; second += 1) {
          await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
          });
        }
        signInWithOtp.mockRejectedValueOnce(new Error('offline'));

        await act(async () => {
          buttonByText(messages.login.resend).click();
          await Promise.resolve();
          await Promise.resolve();
        });

        expect(buttonByText(messages.login.resend).getAttribute('aria-busy')).toBeNull();
        expect(container.textContent).toContain(messages.login.error);
      } finally {
        vi.useRealTimers();
      }
    });

    it('goes back to the empty form when the user picks a different email', async () => {
      signInWithOtpMock({ error: null });
      renderForm();
      await submitValidEmail();

      act(() => {
        buttonByText(messages.login.changeEmail).click();
      });

      const input = container.querySelector<HTMLInputElement>('input[type="email"]');
      expect(input).not.toBeNull();
      expect(input?.value).toBe('');
      expect(container.textContent).not.toContain(messages.login.checkEmailTitle);
    });
  });
});
