import type { ReactElement, ReactNode } from 'react';

export interface EmptyStateProps {
  children: ReactNode;
}

/**
 * The "nothing here yet" message repeated across every list (orgs, boards, posts, public posts,
 * comments, webhooks) — previously a bare `<p>` with no shared styling.
 */
export function EmptyState({ children }: EmptyStateProps): ReactElement {
  return (
    <p className="rounded-control border border-dashed border-zinc-300 bg-zinc-50/60 p-4 text-body text-zinc-500">
      {children}
    </p>
  );
}
