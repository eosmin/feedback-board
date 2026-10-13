'use client';

import { AlertCircle, Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';

const FEEDBACK_MS = 2000;

export interface CopyButtonProps {
  value: string;
  /** Names what is being copied for screen readers ("Copy signing secret"). */
  label: string;
  /**
   * Show the status text instead of only announcing it. The span then takes a full row, so the
   * parent must be a wrapping flex row; its height is reserved so the text never shifts the layout.
   */
  visibleStatus?: boolean;
}

/**
 * Copy-to-clipboard with visible and announced feedback, including failure: a one-time secret
 * must never leave the user believing it was copied when it was not. The caller keeps the value
 * visible as selectable text for the manual fallback.
 */
export function CopyButton({ value, label, visibleStatus = false }: CopyButtonProps): ReactElement {
  const t = useTranslations('common.copy');
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  function showStatus(next: 'copied' | 'failed'): void {
    setStatus(next);
    if (timer.current !== null) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => setStatus('idle'), FEEDBACK_MS);
  }

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      showStatus('copied');
    } catch {
      showStatus('failed');
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={label}
        onClick={() => void handleCopy()}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-border text-text-muted transition-colors hover:bg-surface-sunken hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        {status === 'copied' && <Check className="h-4 w-4 text-accent-text" aria-hidden="true" />}
        {status === 'failed' && <AlertCircle className="h-4 w-4 text-danger" aria-hidden="true" />}
        {status === 'idle' && <Copy className="h-4 w-4" aria-hidden="true" />}
      </button>
      {/* Always mounted so the live region exists before its text changes and gets announced. */}
      <span
        role="status"
        className={
          visibleStatus
            ? `min-h-5 basis-full text-caption ${status === 'failed' ? 'text-danger' : 'text-accent-text'}`
            : 'sr-only'
        }
      >
        {status === 'idle' ? '' : t(status)}
      </span>
    </>
  );
}
