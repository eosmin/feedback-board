import type { OrgDetail } from '@feedback-board/shared';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

interface BoardsUsageProps {
  usage: OrgDetail['usage']['boards'];
}

/**
 * How much of the plan's board allowance the org has used: a labelled bar under a cap, plain text
 * on a plan without one. The numbers come from `GET /orgs/:orgSlug` (the same record the API
 * enforces), never from counting the list here.
 */
export function BoardsUsage({ usage }: BoardsUsageProps): ReactElement {
  const t = useTranslations('dashboard.orgOverview.usage');

  if (usage.cap === null) {
    return (
      <p className="flex min-h-10 items-center text-body text-text-muted">
        {t('unlimited', { used: usage.used })}
      </p>
    );
  }

  const atCap = usage.used >= usage.cap;
  const label = t('capped', { used: usage.used, cap: usage.cap });

  return (
    <div className="flex min-h-10 w-56 flex-col justify-center gap-1.5">
      <p className="text-body text-text-muted">{label}</p>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={usage.cap}
        aria-valuenow={Math.min(usage.used, usage.cap)}
        className="h-1.5 overflow-hidden rounded-full bg-border"
      >
        <div
          className={`h-full rounded-full ${atCap ? 'bg-warning' : 'bg-accent'}`}
          style={{ width: `${Math.min(100, (usage.used / usage.cap) * 100)}%` }}
        />
      </div>
    </div>
  );
}
