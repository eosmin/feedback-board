import type { OrgDetail } from '@feedback-board/shared';
import { CreditCard, KanbanSquare, Webhook } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { Badge, NavLink } from '../ui';

/** Shared with `dashboard-sidebar-skeleton.tsx` so the placeholder has the real sidebar's box. */
export const SIDEBAR_CLASSNAME =
  'flex w-full shrink-0 flex-col gap-1 border-b border-border bg-surface-raised p-4 md:sticky md:top-0 md:h-dvh md:w-56 md:self-start md:overflow-y-auto md:border-b-0 md:border-r';

interface DashboardSidebarProps {
  orgSlug: string;
  org: OrgDetail;
}

/**
 * The dashboard's nav (TDD.md §13 step 19.7 follow-up — a real layout shell instead of each page
 * owning its own root markup). Billing is OWNER-only and webhooks is OWNER/ADMIN-only in the API
 * route table (TDD §11); the same links a MEMBER would 404 on if they typed the URL are hidden
 * here, since a role check that only exists as `notFound()` inside the page reads as a broken
 * link, not a boundary.
 */
export async function DashboardSidebar({
  orgSlug,
  org,
}: DashboardSidebarProps): Promise<ReactElement> {
  const t = await getTranslations('dashboard');
  const canBill = org.role === 'OWNER';
  const canManageWebhooks = org.role === 'OWNER' || org.role === 'ADMIN';

  return (
    <nav
      aria-label={t('shell.nav.boards')}
      className={SIDEBAR_CLASSNAME}
    >
      <div className="mb-3 flex min-w-0 items-center justify-between gap-2 px-2">
        <span className="min-w-0 truncate text-title text-text">{org.name}</span>
        <span className="shrink-0">
          <Badge>{t(`planBadge.${org.plan}`)}</Badge>
        </span>
      </div>

      <NavLink
        href={`/dashboard/${orgSlug}`}
        icon={<KanbanSquare className="h-4 w-4 text-text-subtle" aria-hidden="true" />}
      >
        {t('shell.nav.boards')}
      </NavLink>

      {canBill && (
        <NavLink
          href={`/dashboard/${orgSlug}/billing`}
          icon={<CreditCard className="h-4 w-4 text-text-subtle" aria-hidden="true" />}
        >
          {t('shell.nav.billing')}
        </NavLink>
      )}

      {canManageWebhooks && (
        <NavLink
          href={`/dashboard/${orgSlug}/webhooks`}
          icon={<Webhook className="h-4 w-4 text-text-subtle" aria-hidden="true" />}
        >
          {t('shell.nav.webhooks')}
        </NavLink>
      )}

      <NavLink href="/dashboard" className="mt-auto">
        {t('shell.backToOrgs')}
      </NavLink>
    </nav>
  );
}
