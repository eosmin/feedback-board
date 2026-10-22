'use client';

import * as RadixToast from '@radix-ui/react-toast';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';

export type ToastTone = 'success' | 'error';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  /** `message` is already translated: callers own the copy, this component owns the pattern. */
  toast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

// Longer than the 120ms exit animation, so the item is only dropped after it has played.
const EXIT_MS = 300;

const TONE_CLASSNAME: Record<ToastTone, string> = {
  success: 'border-success-border bg-success-soft text-success',
  error: 'border-danger-border bg-danger-soft text-danger',
};

/**
 * One success/failure feedback pattern for the whole app. Radix owns the `aria-live` announcer,
 * so a toast is read out without stealing focus. `PLAN_LIMIT` is deliberately not a toast: it stays
 * an inline upgrade prompt.
 */
export function ToastProvider({ children }: { children: ReactNode }): ReactElement {
  const t = useTranslations('common');
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const toast = useCallback((message: string, tone: ToastTone = 'success') => {
    nextId.current += 1;
    const id = nextId.current;
    setItems((current) => [...current, { id, tone, message }]);
  }, []);

  const api = useMemo<ToastApi>(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      <RadixToast.Provider label={t('toast.region')}>
        {children}
        {items.map((item) => (
          <RadixToast.Root
            key={item.id}
            type="foreground"
            onOpenChange={(open) => {
              if (!open) {
                setTimeout(() => {
                  setItems((current) => current.filter((candidate) => candidate.id !== item.id));
                }, EXIT_MS);
              }
            }}
            className={`flex items-start gap-3 rounded-control border p-3 shadow-popover data-[state=open]:animate-toast-in data-[state=closed]:animate-toast-out ${TONE_CLASSNAME[item.tone]}`}
          >
            {item.tone === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <RadixToast.Description className="flex-1 text-body">
              {item.message}
            </RadixToast.Description>
            <RadixToast.Close
              aria-label={t('close')}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-control hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </RadixToast.Close>
          </RadixToast.Root>
        ))}
        {/* Fixed, out of flow: a toast appearing never shifts the page. */}
        <RadixToast.Viewport className="fixed bottom-0 right-0 z-[60] m-0 flex w-full max-w-sm list-none flex-col gap-2 p-4 outline-none" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (api === null) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return api;
}
