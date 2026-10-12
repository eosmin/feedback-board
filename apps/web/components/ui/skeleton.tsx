import type { ReactElement } from 'react';

export interface SkeletonProps {
  /** Size the placeholder to the box the real content will occupy (`h-8 w-48`, `h-20`). */
  className?: string;
}

/**
 * A placeholder block. Decorative (`aria-hidden`): the surrounding region carries the busy state.
 * Pulses only when motion is allowed.
 */
export function Skeleton({ className }: SkeletonProps): ReactElement {
  const classes = ['rounded-control bg-surface-sunken motion-safe:animate-pulse', className]
    .filter(Boolean)
    .join(' ');
  return <div aria-hidden="true" className={classes} />;
}
