'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactElement } from 'react';

const INITIAL_PROGRESS = 8;
const PROGRESS_CEILING = 90;
const TRICKLE_INTERVAL_MS = 200;
/** A navigation that never lands (dropped request, superseded click) must not leave the bar stuck. */
const GIVE_UP_MS = 15_000;

/** Attribute names the stylesheet keys on (`styles/globals.css`): dimming and `cursor: wait`. */
const NAVIGATING_ATTRIBUTE = 'data-navigating';
const PENDING_LINK_ATTRIBUTE = 'data-nav-pending';

/**
 * The anchor a click navigates through Next's client router, or `null` when the click is anything
 * else (new tab, download, external, same URL, hash jump). Runs after Next's own `Link` handler,
 * so `defaultPrevented` is the signal that the router took the click over.
 */
function findSoftNavigationAnchor(event: MouseEvent): HTMLAnchorElement | null {
  if (!event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  if (!(event.target instanceof Element)) return null;

  const anchor = event.target.closest<HTMLAnchorElement>('a[href]');
  if (anchor === null || anchor.hasAttribute('download')) return null;
  if (anchor.target !== '' && anchor.target !== '_self') return null;

  const destination = new URL(anchor.href, window.location.href);
  if (destination.origin !== window.location.origin) return null;
  if (
    destination.pathname + destination.search ===
    window.location.pathname + window.location.search
  ) {
    return null;
  }
  return anchor;
}

/**
 * Top-of-page progress bar for App Router navigations. Next 16 exposes no router
 * events, so it starts on the click that the router handled and finishes when the pathname or
 * query string changes. While pending it also marks `<html data-navigating>` (the stylesheet dims
 * `main`, the sidebar stays interactive) and the pressed anchor `data-nav-pending` (the
 * stylesheet gives only that link `cursor: wait`). Mounted once in the root layout.
 */
export function NavigationProgress(): ReactElement {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  const [pending, setPending] = useState(false);
  const [run, setRun] = useState(0);
  const [progress, setProgress] = useState(INITIAL_PROGRESS);
  const pressedLinkRef = useRef<HTMLAnchorElement | null>(null);

  // The route changed: the navigation landed. Adjusting state during render is the documented
  // pattern for state derived from a prop change, and avoids a frame of stale "pending".
  const [previousRouteKey, setPreviousRouteKey] = useState(routeKey);
  if (routeKey !== previousRouteKey) {
    setPreviousRouteKey(routeKey);
    setPending(false);
  }

  useEffect(() => {
    function handleClick(event: MouseEvent): void {
      const anchor = findSoftNavigationAnchor(event);
      if (anchor === null) return;

      pressedLinkRef.current?.removeAttribute(PENDING_LINK_ATTRIBUTE);
      anchor.setAttribute(PENDING_LINK_ATTRIBUTE, '');
      pressedLinkRef.current = anchor;

      setProgress(INITIAL_PROGRESS);
      setRun((current) => current + 1);
      setPending(true);
    }

    // `window` (not `document`): React's delegated listeners sit on the document, so a bubbling
    // listener on window is guaranteed to run after Next's `Link` has called `preventDefault`.
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    if (!pending) return;

    document.documentElement.setAttribute(NAVIGATING_ATTRIBUTE, '');
    const trickle = setInterval(() => {
      setProgress((current) => current + (PROGRESS_CEILING - current) * 0.1);
    }, TRICKLE_INTERVAL_MS);
    const giveUp = setTimeout(() => setPending(false), GIVE_UP_MS);

    return () => {
      clearInterval(trickle);
      clearTimeout(giveUp);
      document.documentElement.removeAttribute(NAVIGATING_ATTRIBUTE);
    };
  }, [pending, run]);

  // Separate from the effect above, which re-runs on every new click: the pressed link's mark must
  // survive that re-run and clear only once nothing is pending.
  useEffect(() => {
    if (!pending) return;
    return () => {
      pressedLinkRef.current?.removeAttribute(PENDING_LINK_ATTRIBUTE);
      pressedLinkRef.current = null;
    };
  }, [pending]);

  // Keyed by `run` so each navigation mounts a fresh bar at its starting width instead of
  // animating backwards from the previous one's 100%. Once not pending it snaps to full width and
  // fades out. `.nav-progress-bar` pins reduced motion to a static full-width state.
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5">
      <div
        key={run}
        className="nav-progress-bar h-full origin-left bg-accent transition-[transform,opacity] duration-200 ease-out"
        style={{ transform: `scaleX(${pending ? progress / 100 : 1})`, opacity: pending ? 1 : 0 }}
      />
    </div>
  );
}
