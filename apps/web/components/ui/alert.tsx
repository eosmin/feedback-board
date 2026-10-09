import type { ReactElement, ReactNode } from 'react';

export interface AlertProps {
  title: string;
  description: string;
  /** The action below the description — an upgrade `Link` or a dismiss `Button`. */
  children?: ReactNode;
}

/**
 * The amber notice box for plan-limit prompts and the one-time webhook secret banner — the same
 * markup (`role="alert"`, title, description, action) was duplicated verbatim across
 * `PlanLimitUpgradePrompt`, `PostLimitUpgradePrompt`, `WebhookUpgradePrompt` and
 * `WebhookSecretBanner`.
 */
export function Alert({ title, description, children }: AlertProps): ReactElement {
  return (
    <div role="alert" className="rounded-control border border-warning-border bg-warning-soft p-4">
      <h3 className="font-medium text-warning">{title}</h3>
      <p className="mt-1 text-body text-warning">{description}</p>
      {children !== undefined && <div className="mt-2">{children}</div>}
    </div>
  );
}
