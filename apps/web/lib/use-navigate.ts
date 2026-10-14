'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { announceNavigation } from './navigation-events';

/** `true` when `href` is the URL already shown, which the router answers without a route change. */
function isCurrentLocation(href: string): boolean {
  try {
    const target = new URL(href, window.location.href);
    return (
      target.origin === window.location.origin &&
      target.pathname + target.search === window.location.pathname + window.location.search
    );
  } catch {
    // Not a URL the browser can parse: let the router deal with it, and announce.
    return false;
  }
}

/** The bar ends when the route changes, so announcing a navigation that cannot change it would
 * leave the page dimmed until the give-up timeout. */
function announceIfRouteChanges(href: string): void {
  if (!isCurrentLocation(href)) announceNavigation();
}

export interface Navigate {
  /** `true` from the call until the destination has rendered, so a form can stay pending. */
  isPending: boolean;
  push: (href: string) => void;
  replace: (href: string) => void;
  /** Re-fetches the current route's server data. No bar: the URL does not change. */
  refresh: () => void;
}

/**
 * The one way to navigate from code. Next's `useRouter` is restricted by lint to this file: a bare
 * `router.push` shows nothing between the request and the arrival of the next page, which on a
 * slow network reads as a freeze. Here every `push`/`replace` starts the global progress bar and
 * runs inside a transition, so `isPending` stays true until the new route has rendered.
 */
export function useNavigate(): Navigate {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return {
    isPending,
    push: (href) => {
      announceIfRouteChanges(href);
      startTransition(() => router.push(href));
    },
    replace: (href) => {
      announceIfRouteChanges(href);
      startTransition(() => router.replace(href));
    },
    refresh: () => {
      startTransition(() => router.refresh());
    },
  };
}
