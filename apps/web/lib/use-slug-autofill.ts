import { useEffect, useRef } from 'react';
import type { UseFormSetValue } from 'react-hook-form';

import { slugify } from './slugify';

/**
 * Autofills a `slug` field from a watched `name` value until the caller edits `slug` by hand —
 * shared by `CreateOrgForm` and `CreateBoardForm`, which both need the exact same behavior.
 * Returns the `onChange` handler to spread onto the slug field's `register(...)` call so the
 * touched-ref flips the moment the user types into it directly.
 */
export function useSlugAutofill<TFieldValues extends Record<string, unknown>>(
  nameValue: string | undefined,
  setValue: UseFormSetValue<TFieldValues>,
): { onSlugChange: () => void } {
  const slugTouched = useRef(false);

  useEffect(() => {
    if (!slugTouched.current) {
      setValue('slug' as never, slugify(nameValue ?? '') as never, { shouldValidate: false });
    }
  }, [nameValue, setValue]);

  return {
    onSlugChange: () => {
      slugTouched.current = true;
    },
  };
}
