import type { ReactElement, ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  /** A plan/status pill rendered next to the title (org overview, billing). */
  badge?: ReactNode;
  /** A primary action (e.g. the "New board"/"Share feedback" dialog trigger), right-aligned. */
  action?: ReactNode;
}

/**
 * The `<h1>` (optionally paired with a plan badge and a primary action) that opens every
 * dashboard and public page — previously an ad hoc `<h1>` per page, sometimes followed by an
 * inline badge `<span>` with its own copy-pasted classes.
 */
export function PageHeader({ title, badge, action }: PageHeaderProps): ReactElement {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <h1 className="text-display text-text">{title}</h1>
        {badge}
      </div>
      {action}
    </div>
  );
}
