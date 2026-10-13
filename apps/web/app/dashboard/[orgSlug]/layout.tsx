import { orgSummarySchema } from '@feedback-board/shared';
import type { ReactElement, ReactNode } from 'react';
import { Suspense } from 'react';
import { z } from 'zod';

import { DashboardHeader } from '../../../components/dashboard/dashboard-header';
import { DashboardSidebar } from '../../../components/dashboard/dashboard-sidebar';
import { DashboardSidebarSkeleton } from '../../../components/dashboard/dashboard-sidebar-skeleton';
import { OrgSwitcher } from '../../../components/dashboard/org-switcher';
import { Skeleton } from '../../../components/ui';
import { serverApiFetch } from '../../../lib/api-client-server';
import { getOrgDetail } from '../../../lib/org-detail';
import { requireUser } from '../../../lib/supabase/require-user';

const orgSummaryListSchema = z.array(orgSummarySchema);

interface DashboardOrgLayoutProps {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
}

async function OrgSidebar({ orgSlug }: { orgSlug: string }): Promise<ReactElement> {
  const org = await getOrgDetail(orgSlug);
  return <DashboardSidebar orgSlug={orgSlug} org={org} />;
}

async function OrgSwitcherSlot({ orgSlug }: { orgSlug: string }): Promise<ReactElement> {
  const [org, orgs] = await Promise.all([
    getOrgDetail(orgSlug),
    serverApiFetch('/orgs', orgSummaryListSchema),
  ]);
  return <OrgSwitcher currentOrgSlug={orgSlug} currentOrgName={org.name} orgs={orgs} />;
}

/**
 * The dashboard shell (TDD.md §13 step 19.7 follow-up): a fixed sidebar + topbar wrapping every
 * `/dashboard/[orgSlug]/**` page, replacing each page's own root `<main>` with one shared frame.
 * `requireUser()` guards here too (same pattern every authenticated page already used, §2.6.13 —
 * there is no middleware in this project) so an unauthenticated request never renders the shell.
 * Membership itself is still enforced by `OrgGuard` on the API side (§11): a caller without
 * access to `orgSlug` gets a `403` from the org fetch, which propagates to Next's error boundary.
 *
 * The layout itself never waits on the org data: the frame renders at once and only the sidebar
 * and the switcher, which need it, sit in their own `Suspense`. A layout that awaited the fetch
 * would hold the whole shell behind a fallback chosen by whichever route was prefetched, which
 * could be the wrong one when navigating in from outside an org.
 */
export default async function DashboardOrgLayout({
  children,
  params,
}: DashboardOrgLayoutProps): Promise<ReactElement> {
  const { orgSlug } = await params;
  await requireUser(`/dashboard/${orgSlug}`);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Suspense fallback={<DashboardSidebarSkeleton />}>
        <OrgSidebar orgSlug={orgSlug} />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader>
          <Suspense fallback={<Skeleton className="h-9 w-40" />}>
            <OrgSwitcherSlot orgSlug={orgSlug} />
          </Suspense>
        </DashboardHeader>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
