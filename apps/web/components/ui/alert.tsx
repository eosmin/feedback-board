import type { ReactElement, ReactNode } from 'react';

export interface AlertProps {
  title: string;
  description: string;
  /** `warning` for plan-limit prompts and the secret banner; `danger` for failures. */
  variant?: 'warning' | 'danger';
  /** The action below the description — an upgrade `Link` or a dismiss `Button`. */
  children?: ReactNode;
}

const VARIANT_CLASSNAME: Record<NonNullable<AlertProps['variant']>, string> = {
  warning: 'border-warning-border bg-warning-soft text-warning',
  danger: 'border-danger-border bg-danger-soft text-danger',
};

/**
 * The notice box for plan-limit prompts, the one-time webhook secret banner and failures — the
 * same markup (`role="alert"`, title, description, action) was duplicated verbatim across
 * `PlanLimitUpgradePrompt`, `PostLimitUpgradePrompt`, `WebhookUpgradePrompt` and
 * `WebhookSecretBanner`. The title is a `<p>`, not a heading, so the alert never skips a level
 * under the page's `<h1>`.
 */
export function Alert({
  title,
  description,
  variant = 'warning',
  children,
}: AlertProps): ReactElement {
  return (
    <div role="alert" className={`rounded-control border p-4 ${VARIANT_CLASSNAME[variant]}`}>
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-body">{description}</p>
      {children !== undefined && <div className="mt-2">{children}</div>}
    </div>
  );
}
