import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';

/**
 * Closes a dropdown (org switcher, locale switcher) on an outside click. Shared instead of
 * duplicated because both switchers need the identical listener/cleanup pair.
 *
 * `onOutsideClick` is read through a ref rather than listed as an effect dependency: every
 * caller passes a fresh inline arrow function, so depending on it directly would tear down and
 * re-attach the global `pointerdown` listener on every render of the caller's parent, not just
 * when `ref` changes.
 */
export function useClickOutside(ref: RefObject<HTMLElement | null>, onOutsideClick: () => void): void {
  const callbackRef = useRef(onOutsideClick);
  callbackRef.current = onOutsideClick;

  useEffect(() => {
    function handlePointerDown(event: PointerEvent): void {
      if (ref.current !== null && !ref.current.contains(event.target as Node)) {
        callbackRef.current();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [ref]);
}
