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
    <p className="rounded-control border border-dashed border-border-strong bg-surface p-4 text-body text-text-muted">
      {children}
    </p>
  );
}
