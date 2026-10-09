'use client';

import { Check, Globe } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { ReactElement } from 'react';
import { useRef, useState } from 'react';

import { AVAILABLE_LOCALES, setLocaleCookie } from '../../lib/locales';
import { useClickOutside } from '../../lib/use-click-outside';

/**
 * Language switcher shell (TDD.md §13 step 19.7 follow-up). Only `en` exists in
 * `AVAILABLE_LOCALES` today, so this renders one checked item — the point is that the switch
 * itself, the cookie plumbing, and `i18n/request.ts` reading it are all real and working, so a
 * second locale later is a data file, not a rewrite.
 */
export function LocaleSwitcher(): ReactElement {
  const t = useTranslations('common.language');
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setOpen(false));

  function selectLocale(code: string): void {
    setLocaleCookie(code);
    setOpen(false);
    router.refresh();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('label')}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1.5 rounded-control p-2 text-body text-text-muted transition-colors hover:bg-surface-sunken hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <Globe className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && (
        <ul
          role="menu"
          aria-label={t('label')}
          className="absolute right-0 z-40 mt-1 w-40 rounded-control border border-border bg-surface-raised py-1 shadow-popover"
        >
          {AVAILABLE_LOCALES.map((option) => (
            <li key={option.code} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={option.code === locale}
                onClick={() => selectLocale(option.code)}
                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-body text-text hover:bg-surface"
              >
                {option.label}
                {option.code === locale && <Check className="h-4 w-4 text-accent-text" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
