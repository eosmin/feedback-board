'use client';

import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useRef } from 'react';
import type { ReactElement, ReactNode } from 'react';

export interface OverlayPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
}

interface OverlayPanelInternalProps extends OverlayPanelProps {
  variant: 'dialog' | 'drawer';
}

// Full class names per variant, never built from strings: Tailwind only emits classes it sees.
const CONTENT_CLASSNAME: Record<OverlayPanelInternalProps['variant'], string> = {
  dialog:
    'fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-xl border border-border bg-surface-raised p-6 shadow-modal outline-none data-[state=open]:animate-dialog-in data-[state=closed]:animate-dialog-out',
  // Full-screen below `sm`, a right-anchored 28rem panel above it.
  drawer:
    'fixed inset-y-0 right-0 z-50 flex h-dvh w-full flex-col gap-4 overflow-y-auto border-l border-border bg-surface-raised p-6 shadow-modal outline-none sm:max-w-md data-[state=open]:animate-drawer-in data-[state=closed]:animate-drawer-out',
};

/**
 * The one Radix `Dialog` wiring behind both `Dialog` and `Drawer`, so focus trap, `Esc`, inert
 * background and scroll lock live in a single place. The wrappers differ only in `variant`.
 */
export function OverlayPanel({
  open,
  onClose,
  title,
  closeLabel,
  children,
  variant,
}: OverlayPanelInternalProps): ReactElement {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <RadixDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out" />
        {/* No description to announce: Radix warns unless this is explicitly undefined. */}
        <RadixDialog.Content
          ref={contentRef}
          aria-describedby={undefined}
          className={CONTENT_CLASSNAME[variant]}
          onOpenAutoFocus={(event) => {
            // The close button precedes the content in the DOM, so Radix's default would focus it
            // and a stray Enter would dismiss a form. Start on the first field when there is one.
            const firstField = contentRef.current?.querySelector<HTMLElement>('input, textarea, select');
            if (firstField) {
              event.preventDefault();
              firstField.focus();
            }
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <RadixDialog.Title className="text-title text-text">{title}</RadixDialog.Title>
            <RadixDialog.Close
              aria-label={closeLabel}
              className="flex h-10 w-10 items-center justify-center rounded-control text-text-muted transition-colors hover:bg-surface-sunken hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </RadixDialog.Close>
          </div>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
