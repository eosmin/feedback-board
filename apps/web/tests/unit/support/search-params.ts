import { useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
const replaceState = window.history.replaceState.bind(window.history);

// The Next router does this for real: a `history.replaceState` re-renders every `useSearchParams`
// reader. Outside the router nothing does, so the stand-in patches the call to notify them. The
// patch is installed and removed with the first and last reader, so it never outlives a test.
function patchedReplaceState(...args: Parameters<History['replaceState']>): void {
  replaceState(...args);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    window.history.replaceState = patchedReplaceState;
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.history.replaceState = replaceState;
    }
  };
}

/** A `next/navigation` stand-in for tests: `vi.mock('next/navigation', () => import('.../search-params'))`. */
export function useSearchParams(): URLSearchParams {
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => '',
  );
  return new URLSearchParams(search);
}

/** Sets the query string a test starts from, without notifying anyone. */
export function setLocationSearch(search: string): void {
  replaceState(null, '', search === '' ? window.location.pathname : `?${search}`);
}
