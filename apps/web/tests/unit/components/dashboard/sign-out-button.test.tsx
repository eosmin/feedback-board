import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
const auth = vi.hoisted(() => ({ signOut: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('../../../../lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({ auth }),
}));

import { SignOutButton } from '../../../../components/dashboard/sign-out-button';
import messages from '../../../../messages/en.json';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <SignOutButton />
      </NextIntlClientProvider>,
    );
  });
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.clearAllMocks();
});

async function clickSignOut(): Promise<HTMLButtonElement> {
  const button = container.querySelector('button') as HTMLButtonElement;
  await act(async () => {
    button.click();
    await Promise.resolve();
    await Promise.resolve();
  });
  return button;
}

describe('SignOutButton', () => {
  it('goes to the login page once the session is closed', async () => {
    auth.signOut.mockResolvedValue({ error: null });

    await clickSignOut();

    expect(router.push).toHaveBeenCalledWith('/login');
    expect(router.refresh).toHaveBeenCalled();
  });

  it('still goes to the login page when the server call fails, since the local session is gone', async () => {
    auth.signOut.mockResolvedValue({ error: new Error('network down') });

    await clickSignOut();

    expect(router.push).toHaveBeenCalledWith('/login');
  });

  it('still goes to the login page when the sign-out throws', async () => {
    auth.signOut.mockRejectedValue(new Error('boom'));

    await clickSignOut();

    expect(router.push).toHaveBeenCalledWith('/login');
  });
});
