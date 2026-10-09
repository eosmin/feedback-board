'use client';

import { Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { useSyncExternalStore } from 'react';

import { applyTheme, readCurrentTheme, subscribeTheme } from '../../lib/theme';
import type { ThemeChoice } from '../../lib/theme';

/**
 * One button that flips light/dark. The class on `<html>` is already right at first paint
 * (inline script in `app/layout.tsx`, which defaults to the OS preference); this only reflects
 * it after hydration, so server and first client render agree and nothing flashes.
 */
export function ThemeToggle(): ReactElement {
  const t = useTranslations('common.theme');
  // `null` on the server and during hydration: the real theme is only known in the browser, and
  // guessing one would show the wrong icon and label to a dark-mode user until hydration ends.
  const theme = useSyncExternalStore<ThemeChoice | null>(subscribeTheme, readCurrentTheme, () => null);
  const next = theme === 'dark' ? 'light' : 'dark';
  const Icon = theme === 'dark' ? Sun : Moon;
  const label = theme === null ? t('label') : t(next === 'dark' ? 'switchToDark' : 'switchToLight');

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={theme === null}
      onClick={() => applyTheme(next)}
      className="rounded-control p-2 text-text-muted transition-colors hover:bg-surface-sunken hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      {theme === null ? <span className="block h-4 w-4" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}
