'use client';

import { X } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
}

/**
 * Hand-rolled instead of a Radix dependency (TDD.md §13 step 19.7 follow-up): the dashboard's
 * create-board/create-org/create-post/create-webhook forms move from inline page markup into a
 * modal, and this is the one primitive that needed net-new behavior rather than a markup
 * extraction. A single controlled `<dialog>`-pattern component covers it without a new package.
 */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({ open, onClose, title, closeLabel, children }: DialogProps): ReactElement | null {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    // Mark every other top-level element as inert so Tab, screen-reader virtual cursors, and
    // find-in-page can't reach background content hidden behind the overlay.
    const portalRoot = panelRef.current?.closest('body > *') ?? null;
    const inertedSiblings = Array.from(document.body.children).filter((node) => node !== portalRoot);
    for (const node of inertedSiblings) {
      node.setAttribute('inert', '');
      node.setAttribute('aria-hidden', 'true');
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab' || panelRef.current === null) {
        return;
      }

      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      for (const node of inertedSiblings) {
        node.removeAttribute('inert');
        node.removeAttribute('aria-hidden');
      }
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="flex max-h-[90vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-xl border border-border bg-surface-raised p-6 shadow-modal outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-title text-text">{title}</h2>
          <button
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            className="rounded-control p-1 text-text-muted transition-colors hover:bg-surface-sunken hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
