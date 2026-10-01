import type { ReactElement, ReactNode } from 'react';

export interface BadgeProps {
  children: ReactNode;
  /** `solid` for plan/status pills, `soft` for the lower-emphasis AI classification pills. */
  variant?: 'solid' | 'soft';
}

const VARIANT_CLASSNAME: Record<NonNullable<BadgeProps['variant']>, string> = {
  // Accent stays deliberate: `solid` is for the plan badge — the one pill worth calling out.
  solid: 'bg-brand-100 text-brand-800',
  // Everything lower-stakes (status pills, AI category/priority tags) reads as neutral metadata,
  // not a second accent color competing with primary actions.
  soft: 'bg-zinc-100 text-zinc-600',
};

/**
 * The small rounded pill used for plan badges, post status, and AI category/priority tags —
 * previously the same four Tailwind classes copy-pasted at each call site.
 */
export function Badge({ children, variant = 'solid' }: BadgeProps): ReactElement {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium ${VARIANT_CLASSNAME[variant]}`}
    >
      {children}
    </span>
  );
}
