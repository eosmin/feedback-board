'use client';

import { Check, Globe } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import type { KeyboardEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import { AVAILABLE_LOCALES, setLocaleCookie } from '../../lib/locales';
import { useClickOutside } from '../../lib/use-click-outside';
import { useNavigate } from '../../lib/use-navigate';

/**
 * Language switcher: writes the `NEXT_LOCALE` cookie that `i18n/request.ts` reads, then refreshes
 * so server components re-render in the new locale. Options come from `AVAILABLE_LOCALES`, so a
 * new locale is a data entry plus a catalog, not a code change here.
 */
export function LocaleSwitcher(): ReactElement {
  const t = useTranslations('common.language');
  const locale = useLocale();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useClickOutside(containerRef, () => setOpen(false));

  function closeAndRestoreFocus(): void {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function selectLocale(code: string): void {
    setLocaleCookie(code);
    closeAndRestoreFocus();
    navigate.refresh();
  }

  // Focus moves into the menu when it opens (checked item first), so arrows and Escape act on it.
  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  }, [open]);

  function handleMenuKeyDown(event: KeyboardEvent<HTMLUListElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAndRestoreFocus();
      return;
    }
    if (event.key === 'Tab') {
      setOpen(false);
      return;
    }
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitemradio"]'),
    );
    const index = items.indexOf(document.activeElement as HTMLElement);
    items[(index + step + items.length) % items.length]?.focus();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('label')}
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-11 items-center justify-center gap-1.5 rounded-control text-body text-text-muted md:h-auto md:w-auto md:p-2 transition-colors hover:bg-surface-sunken hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <Globe className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && (
        <ul
          ref={menuRef}
          role="menu"
          aria-label={t('label')}
          onKeyDown={handleMenuKeyDown}
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
                {option.code === locale && (
                  <Check className="h-4 w-4 text-accent-text" aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
