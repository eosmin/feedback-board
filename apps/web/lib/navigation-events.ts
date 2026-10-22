const NAVIGATION_START_EVENT = 'app:navigation-start';

/**
 * Tells `NavigationProgress` that a navigation the router will perform has just been requested
 * by code rather than by a click on a link, so the bar and the dimmed content start at once.
 */
export function announceNavigation(): void {
  window.dispatchEvent(new Event(NAVIGATION_START_EVENT));
}

/** Subscribes to `announceNavigation`; returns the unsubscribe function. */
export function onNavigationStart(listener: () => void): () => void {
  window.addEventListener(NAVIGATION_START_EVENT, listener);
  return () => window.removeEventListener(NAVIGATION_START_EVENT, listener);
}
