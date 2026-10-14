'use client';

import { Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

import { NavDrawer } from '../ui';

/** Tailwind's `md` breakpoint, where the sidebar replaces this drawer. */
const DESKTOP_QUERY = '(min-width: 768px)';

interface MobileNavProps {
  /** The org nav, rendered on the server: the same content the desktop sidebar shows. */
  children: ReactNode;
}

/**
 * The sidebar below the tablet breakpoint: a menu button in the header and the nav in a drawer.
 * Any link inside closes it, since the layout (and so this component) survives the navigation.
 */
export function MobileNav({ children }: MobileNavProps): ReactElement {
  const t = useTranslations('dashboard.shell.menu');
  const tCommon = useTranslations('common');
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // The button is `md:hidden` but the drawer is a portaled modal: on a rotation or a resize past
  // the sidebar breakpoint it would stay open, with its scroll lock, over the desktop layout.
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const desktop = window.matchMedia(DESKTOP_QUERY);
    // Safari before 14 only has the deprecated `addListener`; there the drawer simply stays put.
    if (typeof desktop.addEventListener !== 'function') return;
    function closeOnDesktop(event: MediaQueryListEvent): void {
      if (event.matches) setOpen(false);
    }
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  return (
    <div className="md:hidden">
      <button
        ref={triggerRef}
        type="button"
        aria-label={t('open')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 items-center justify-center rounded-control text-text-muted transition-colors hover:bg-surface-sunken hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <NavDrawer
        open={open}
        onClose={() => setOpen(false)}
        title={t('title')}
        closeLabel={tCommon('close')}
        fallbackFocusRef={triggerRef}
      >
        <nav
          aria-label={t('title')}
          className="flex flex-col gap-1"
          onClick={(event) => {
            if (event.target instanceof Element && event.target.closest('a') !== null) {
              setOpen(false);
            }
          }}
        >
          {children}
        </nav>
      </NavDrawer>
    </div>
  );
}
