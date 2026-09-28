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

import { AiDigestPanel } from '../../../../components/boards/ai-digest-panel';
import { apiFetch, ApiError } from '../../../../lib/api-client';
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
});

describe('AiDigestPanel', () => {
  it('renders the returned summary, not persisted anywhere else (TDD §3.8, §1.5)', async () => {
    mockApiFetch.mockResolvedValue({ summary: 'Most feedback is about dark mode.' });

    act(() => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <AiDigestPanel orgSlug="acme" boardSlug="feature-requests" />
        </NextIntlClientProvider>,
      );
    });

    const button = container.querySelector('button') as HTMLButtonElement;

    await act(async () => {
      button.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/orgs/acme/boards/feature-requests/ai-digest',
      expect.anything(),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(container.textContent).toContain('Most feedback is about dark mode.');
  });

  it('renders Markdown in the summary as elements, not literal ** characters', async () => {
    mockApiFetch.mockResolvedValue({ summary: '**Dark mode** is the top request.' });

    act(() => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <AiDigestPanel orgSlug="acme" boardSlug="feature-requests" />
        </NextIntlClientProvider>,
      );
    });

    const button = container.querySelector('button') as HTMLButtonElement;

    await act(async () => {
      button.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const strong = container.querySelector('strong');
    expect(strong?.textContent).toBe('Dark mode');
    expect(container.textContent).not.toContain('**Dark mode**');
  });

  it('shows the rate-limit copy for a 429 RATE_LIMITED response, not the generic error', async () => {
    mockApiFetch.mockRejectedValue(new ApiError(429, { error: 'RATE_LIMITED' }));

    act(() => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <AiDigestPanel orgSlug="acme" boardSlug="feature-requests" />
        </NextIntlClientProvider>,
      );
    });

    const button = container.querySelector('button') as HTMLButtonElement;

    await act(async () => {
      button.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const t = messages.dashboard.boardDetail.aiDigest;
    expect(container.textContent).toContain(t.rateLimited);
    expect(container.textContent).not.toContain(t.error);
  });
});
