import type { OrgDetail } from '@feedback-board/shared';
import { CreditCard, KanbanSquare, Webhook } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { Badge, NavLink } from '../ui';

/**
 * Shared with `dashboard-sidebar-skeleton.tsx` so the placeholder has the real sidebar's box.
 * Hidden below the tablet breakpoint, where `MobileNav` shows the same content in a drawer.
 */
export const SIDEBAR_CLASSNAME =
  'hidden w-56 shrink-0 flex-col gap-1 border-r border-border bg-surface-raised p-4 md:sticky md:top-0 md:flex md:h-dvh md:self-start md:overflow-y-auto';

interface OrgNavContentProps {
  orgSlug: string;
  org: OrgDetail;
}

/**
 * The org's nav: plan badge and links. Billing is OWNER-only and webhooks is OWNER/ADMIN-only in
 * the API route table (TDD §11); the same links a MEMBER would 404 on if they typed the URL are
 * hidden here, since a role check that only exists as `notFound()` inside the page reads as a
 * broken link, not a boundary. The org name lives in the header breadcrumb, not here.
 */
export async function OrgNavContent({ orgSlug, org }: OrgNavContentProps): Promise<ReactElement> {
  const t = await getTranslations('dashboard');
  const base = `/dashboard/${orgSlug}`;
  const canBill = org.role === 'OWNER';
  const canManageWebhooks = org.role === 'OWNER' || org.role === 'ADMIN';

  return (
    <>
      <div className="mb-3 px-2">
        <Badge>{t(`planBadge.${org.plan}`)}</Badge>
      </div>

      <NavLink
        href={base}
        end
        // A board's detail page lives under `/boards` but belongs to this entry.
        activePaths={[`${base}/boards`]}
        icon={<KanbanSquare className="h-4 w-4 text-text-subtle" aria-hidden="true" />}
      >
        {t('shell.nav.boards')}
      </NavLink>

      {canBill && (
        <NavLink
          href={`${base}/billing`}
          icon={<CreditCard className="h-4 w-4 text-text-subtle" aria-hidden="true" />}
        >
          {t('shell.nav.billing')}
        </NavLink>
      )}

      {canManageWebhooks && (
        <NavLink
          href={`${base}/webhooks`}
          icon={<Webhook className="h-4 w-4 text-text-subtle" aria-hidden="true" />}
        >
          {t('shell.nav.webhooks')}
        </NavLink>
      )}
    </>
  );
}

/** The desktop sidebar (TDD.md §13 step 19.7 follow-up — a real layout shell, not per-page markup). */
export async function DashboardSidebar({
  orgSlug,
  org,
}: OrgNavContentProps): Promise<ReactElement> {
  const t = await getTranslations('dashboard');

  return (
    <nav aria-label={t('shell.nav.label')} className={SIDEBAR_CLASSNAME}>
      <OrgNavContent orgSlug={orgSlug} org={org} />
    </nav>
  );
}
