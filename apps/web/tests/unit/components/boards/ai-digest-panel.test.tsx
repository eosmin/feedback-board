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
import { getBySelector, getButton } from '../../support/dom';

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
    expect(container.textContent).toContain('3 of 5 AI summaries left this hour');
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
    expect(container.textContent).toContain('4 of 5 AI summaries left this hour');
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
      new ApiError(
        429,
        { error: 'RATE_LIMITED' },
        new Headers({ 'X-RateLimit-Remaining': '0', 'X-RateLimit-Limit': '5' }),
      ),
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
  describe('the quota line when responses arrive out of order or without headers', () => {
    const t = messages.dashboard.boardDetail.aiDigest;

    async function render(): Promise<void> {
      await act(async () => {
        root.render(
          <NextIntlClientProvider locale="en" messages={messages}>
            <AiDigestPanel orgSlug="acme" boardSlug="feature-requests" />
          </NextIntlClientProvider>,
        );
        await Promise.resolve();
      });
    }

    async function clickGenerate(): Promise<void> {
      await act(async () => {
        getButton(container, t.submit).click();
        await Promise.resolve();
        await Promise.resolve();
      });
    }

    it('does not let a slow quota read undo the count a Generate has already reported', async () => {
      let landQuotaRead: (quota: { remaining: number; limit: number }) => void = () => {};
      mockApiFetch.mockReturnValue(
        new Promise((resolve) => {
          landQuotaRead = resolve;
        }),
      );
      mockApiFetchWithHeaders.mockResolvedValue({
        data: { summary: 'Done.' },
        headers: new Headers({ 'X-RateLimit-Remaining': '0', 'X-RateLimit-Limit': '5' }),
      });
      await render();

      await clickGenerate();
      expect(container.textContent).toContain(t.quotaExhausted);

      // The read was sent before the Generate and lands after it, with an older count.
      await act(async () => {
        landQuotaRead({ remaining: 1, limit: 5 });
        await Promise.resolve();
      });

      expect(container.textContent).toContain(t.quotaExhausted);
      expect(container.textContent).not.toContain('1 of 5');
      expect(getButton(container, t.submit).disabled).toBe(true);
    });

    it('keeps the last known quota when a response carries no quota headers', async () => {
      mockApiFetch.mockResolvedValue({ remaining: 3, limit: 5 });
      mockApiFetchWithHeaders.mockResolvedValue({
        data: { summary: 'Done.' },
        headers: new Headers(),
      });
      await render();
      expect(container.textContent).toContain('3 of 5 AI summaries left this hour');

      await clickGenerate();

      expect(container.textContent).toContain('3 of 5 AI summaries left this hour');
    });

    it('keeps the last known quota through a failure that carries no quota headers', async () => {
      mockApiFetch.mockResolvedValue({ remaining: 1, limit: 5 });
      mockApiFetchWithHeaders
        .mockRejectedValueOnce(new ApiError(500, { error: 'INTERNAL_ERROR' }))
        .mockResolvedValueOnce({ data: { summary: 'Done.' }, headers: new Headers() });
      await render();

      await clickGenerate();
      // The quota line is hidden while an error is up; the failure is what shows.
      expect(container.textContent).toContain(t.error);

      await clickGenerate();

      // The error is gone and the quota is still what the read said, not wiped by the failure.
      expect(container.textContent).not.toContain(t.error);
      expect(container.textContent).toContain('1 of 5 AI summaries left this hour');
    });
  });

  describe('the result panel', () => {
    const t = messages.dashboard.boardDetail.aiDigest;

    async function generate(): Promise<void> {
      mockApiFetchWithHeaders.mockResolvedValue({
        data: { summary: 'Most feedback is about dark mode.' },
        headers: new Headers({ 'X-RateLimit-Remaining': '4', 'X-RateLimit-Limit': '5' }),
      });
      await act(async () => {
        root.render(
          <NextIntlClientProvider locale="en" messages={messages}>
            <AiDigestPanel orgSlug="acme" boardSlug="feature-requests" />
          </NextIntlClientProvider>,
        );
        await Promise.resolve();
        await Promise.resolve();
      });
      await act(async () => {
        getButton(container, t.submit).click();
        await Promise.resolve();
        await Promise.resolve();
      });
    }

    it('shows no panel before there is a result', async () => {
      await act(async () => {
        root.render(
          <NextIntlClientProvider locale="en" messages={messages}>
            <AiDigestPanel orgSlug="acme" boardSlug="feature-requests" />
          </NextIntlClientProvider>,
        );
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(container.querySelector('[aria-expanded]')).toBeNull();
    });

    it('opens the result expanded and lets it be collapsed and expanded again', async () => {
      await generate();

      const toggle = getButton(container, t.hideSummary);
      const panel = getBySelector(
        container,
        `#${toggle.getAttribute('aria-controls')}`,
        HTMLElement,
      );
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(panel.hidden).toBe(false);
      expect(panel.textContent).toContain('Most feedback is about dark mode.');

      act(() => {
        toggle.click();
      });
      // The element stays in the DOM, so `aria-controls` always names something that exists.
      expect(getButton(container, t.showSummary).getAttribute('aria-expanded')).toBe('false');
      expect(panel.hidden).toBe(true);

      act(() => {
        getButton(container, t.showSummary).click();
      });
      expect(panel.hidden).toBe(false);
    });

    it('marks the Generate button pending while the summary is being written', async () => {
      mockApiFetchWithHeaders.mockReturnValue(new Promise(() => {}));
      await act(async () => {
        root.render(
          <NextIntlClientProvider locale="en" messages={messages}>
            <AiDigestPanel orgSlug="acme" boardSlug="feature-requests" />
          </NextIntlClientProvider>,
        );
        await Promise.resolve();
        await Promise.resolve();
      });

      await act(async () => {
        getButton(container, t.submit).click();
      });

      const pending = getButton(container, t.generating);
      expect(pending.disabled).toBe(true);
      expect(pending.getAttribute('aria-busy')).toBe('true');
    });

    it('reserves the quota line before the quota arrives, so the bar does not grow', async () => {
      mockApiFetch.mockReturnValue(new Promise(() => {}));

      act(() => {
        root.render(
          <NextIntlClientProvider locale="en" messages={messages}>
            <AiDigestPanel orgSlug="acme" boardSlug="feature-requests" />
          </NextIntlClientProvider>,
        );
      });

      const reserved = container.querySelector('.min-h-4');
      expect(reserved?.querySelector('[aria-hidden="true"]')).not.toBeNull();
    });
  });
});
