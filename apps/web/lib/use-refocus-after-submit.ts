'use client';

import { useEffect, useRef } from 'react';

/**
 * Puts focus back on a field once a submit has settled. A `<fieldset disabled>` (see `Form`)
 * drops focus from the field the user was in, and a disabled field cannot be focused, so the
 * call has to wait for the form to be enabled again: request it from the submit handler and it
 * runs when `isSubmitting` turns false.
 */
export function useRefocusAfterSubmit<F extends string>(
  focus: (field: F) => void,
  isSubmitting: boolean,
): (field: F) => void {
  const requested = useRef<F | null>(null);

  useEffect(() => {
    if (isSubmitting || requested.current === null) return;
    const field = requested.current;
    requested.current = null;
    focus(field);
  }, [isSubmitting, focus]);

  return (field) => {
    requested.current = field;
  };
}
