'use client';

import { Check, Copy, Share2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { useRef, useState } from 'react';

import { useClickOutside } from '../../lib/use-click-outside';
import { Button } from '../ui';

interface ShareBoardButtonProps {
  orgSlug: string;
  boardSlug: string;
  /** A private board has no anonymous-readable `/[orgSlug]/[boardSlug]` route (TDD §11 — it 404s
   * there), so its shareable link instead points through `/login?next=...`: a member who isn't
   * signed in gets sent to sign in and lands back on the board, one already signed in goes
   * straight there. */
  isPublic: boolean;
}

/**
 * Shows the board's shareable URL in an open popover (not a blind clipboard copy) so the user can
 * see and verify what gets copied, and select/copy it manually as a fallback if clipboard access
 * fails.
 */
export function ShareBoardButton({
  orgSlug,
  boardSlug,
  isPublic,
}: ShareBoardButtonProps): ReactElement {
  const t = useTranslations('dashboard.boardDetail.share');
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useClickOutside(containerRef, () => setOpen(false));

  const linkLabel = isPublic ? t('publicLink') : t('memberLink');

  const url =
    typeof window === 'undefined'
      ? ''
      : isPublic
        ? `${window.location.origin}/${orgSlug}/${boardSlug}`
        : `${window.location.origin}/login?next=${encodeURIComponent(`/dashboard/${orgSlug}/boards/${boardSlug}`)}`;

  async function handleCopy(): Promise<void> {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleOpen(): void {
    setOpen((value) => !value);
    setCopied(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="secondary"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={handleOpen}
      >
        <Share2 className="h-4 w-4" aria-hidden="true" />
        {t('trigger')}
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label={linkLabel}
          className="absolute right-0 z-40 mt-1 w-80 rounded-control border border-zinc-200 bg-white p-3 shadow-popover"
        >
          <label htmlFor="share-board-url" className="text-caption text-zinc-500">
            {linkLabel}
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              id="share-board-url"
              ref={inputRef}
              type="text"
              readOnly
              value={url}
              onFocus={(event) => event.currentTarget.select()}
              className="min-w-0 flex-1 rounded-control border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-body text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
            />
            <button
              type="button"
              aria-label={copied ? t('copied') : t('trigger')}
              onClick={() => void handleCopy()}
              className="flex shrink-0 items-center gap-1.5 rounded-control border border-zinc-200 px-2 py-1.5 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
            >
              {copied ? (
                <Check className="h-4 w-4 text-brand-600" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {copied && <p className="mt-1.5 text-caption text-brand-600">{t('copied')}</p>}
        </div>
      )}
    </div>
  );
}
