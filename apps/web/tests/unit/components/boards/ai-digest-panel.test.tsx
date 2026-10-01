import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../../../lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('../../../../lib/api-client')>(
    '../../../../lib/api-client',
  );
  return { ...actual, apiFetch: vi.fn(), apiFetchWithHeaders: vi.fn() };
});

import { AiDigestPanel } from '../../../../components/boards/ai-digest-panel';
import { apiFetch, apiFetchWithHeaders, ApiError } from '../../../../lib/api-client';
import messages from '../../../../messages/en.json';

const mockApiFetch = vi.mocked(apiFetch);
const mockApiFetchWithHeaders = vi.mocked(apiFetchWithHeaders);

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  // The mount-time quota preview (GET .../ai-digest/quota) — individual tests override this
  // when they care about its value.
  mockApiFetch.mockResolvedValue({ remaining: 5, limit: 5 });
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
});

describe('AiDigestPanel', () => {
  it('shows the remaining quota on mount, before Generate is ever clicked', async () => {
    mockApiFetch.mockResolvedValue({ remaining: 3, limit: 5 });

    await act(async () => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <AiDigestPanel orgSlug="acme" boardSlug="feature-requests" />
        </NextIntlClientProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/orgs/acme/boards/feature-requests/ai-digest/quota',
      expect.anything(),
    );
    expect(container.textContent).toContain('3');
    expect(container.textContent).toContain('5');
    expect(mockApiFetchWithHeaders).not.toHaveBeenCalled();
  });

  it('renders the returned summary, not persisted anywhere else (TDD §3.8, §1.5)', async () => {
    mockApiFetchWithHeaders.mockResolvedValue({
      data: { summary: 'Most feedback is about dark mode.' },
      headers: new Headers({ 'X-RateLimit-Remaining': '4', 'X-RateLimit-Limit': '5' }),
    });

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

    expect(mockApiFetchWithHeaders).toHaveBeenCalledWith(
      '/orgs/acme/boards/feature-requests/ai-digest',
      expect.anything(),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(container.textContent).toContain('Most feedback is about dark mode.');
    expect(container.textContent).toContain('4');
    expect(container.textContent).toContain('5');
  });

  it('renders Markdown in the summary as elements, not literal ** characters', async () => {
    mockApiFetchWithHeaders.mockResolvedValue({
      data: { summary: '**Dark mode** is the top request.' },
      headers: new Headers(),
    });

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
    mockApiFetchWithHeaders.mockRejectedValue(
      new ApiError(429, { error: 'RATE_LIMITED' }, new Headers({ 'X-RateLimit-Remaining': '0', 'X-RateLimit-Limit': '5' })),
    );

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
    // The error message already says the quota is spent — showing `quotaExhausted` too would
    // repeat the same sentence twice on screen.
    expect(container.textContent).not.toContain(t.quotaExhausted);
    expect(button.disabled).toBe(true);
  });

  it('shows quotaExhausted (not an error) when the 5th successful call reaches 0 remaining', async () => {
    mockApiFetchWithHeaders.mockResolvedValue({
      data: { summary: 'Digest.' },
      headers: new Headers({ 'X-RateLimit-Remaining': '0', 'X-RateLimit-Limit': '5' }),
    });

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
    expect(container.textContent).toContain(t.quotaExhausted);
    expect(button.disabled).toBe(true);
  });
});
