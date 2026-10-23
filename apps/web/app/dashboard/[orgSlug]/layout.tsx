import { orgSummarySchema } from '@feedback-board/shared';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { ReactElement, ReactNode } from 'react';
import { Suspense } from 'react';
import { z } from 'zod';

import { BoardLabelProvider } from '../../../components/dashboard/board-breadcrumb-label';
import { DashboardHeader } from '../../../components/dashboard/dashboard-header';
import { DashboardSidebar, OrgNavContent } from '../../../components/dashboard/dashboard-sidebar';
import { DashboardSidebarSkeleton } from '../../../components/dashboard/dashboard-sidebar-skeleton';
import { MobileNav } from '../../../components/dashboard/mobile-nav';
import { OrgBreadcrumb } from '../../../components/dashboard/org-breadcrumb';
import { Skeleton } from '../../../components/ui';
import { serverApiFetch } from '../../../lib/api-client-server';
import { getOrgDetail } from '../../../lib/org-detail';
import { requireUser } from '../../../lib/supabase/require-user';
import { titleTemplate } from '../../../lib/title-template';

const orgSummaryListSchema = z.array(orgSummarySchema);

interface DashboardOrgLayoutProps {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
}

/**
 * The org's name as the default tab title for every page below. A page that sets its own `title`
 * replaces it, and the template (restated here, see `titleTemplate`) appends the app name either
 * way. Metadata streams after the frame for a browser, so awaiting the org here does not hold the
 * shell back.
 */
export async function generateMetadata({ params }: DashboardOrgLayoutProps): Promise<Metadata> {
  const { orgSlug } = await params;
  const [org, t] = await Promise.all([getOrgDetail(orgSlug), getTranslations('common')]);
  return { title: { default: org.name, template: titleTemplate(t('appName')) } };
}

async function OrgSidebar({ orgSlug }: { orgSlug: string }): Promise<ReactElement> {
  const org = await getOrgDetail(orgSlug);
  return <DashboardSidebar orgSlug={orgSlug} org={org} />;
}

async function OrgMobileNav({ orgSlug }: { orgSlug: string }): Promise<ReactElement> {
  const org = await getOrgDetail(orgSlug);
  return (
    <MobileNav>
      <OrgNavContent orgSlug={orgSlug} org={org} />
    </MobileNav>
  );
}

async function OrgBreadcrumbSlot({ orgSlug }: { orgSlug: string }): Promise<ReactElement> {
  const [org, orgs] = await Promise.all([
    getOrgDetail(orgSlug),
    serverApiFetch('/orgs', orgSummaryListSchema),
  ]);
  return <OrgBreadcrumb orgSlug={orgSlug} orgName={org.name} orgs={orgs} />;
}

/**
 * The dashboard shell (TDD.md §13 step 19.7 follow-up): a fixed sidebar + topbar wrapping every
 * `/dashboard/[orgSlug]/**` page, replacing each page's own root `<main>` with one shared frame.
 * `requireUser()` guards here too (same pattern every authenticated page already used, §2.6.13 —
 * there is no middleware in this project) so an unauthenticated request never renders the shell.
 * Membership itself is still enforced by `OrgGuard` on the API side (§11): a caller without
 * access to `orgSlug` gets a `403` from the org fetch, which propagates to Next's error boundary.
 *
 * The layout itself never waits on the org data: the frame renders at once and only the sidebar,
 * the menu button and the breadcrumb, which need it, sit in their own `Suspense`. A layout that
 * awaited the fetch would hold the whole shell behind a fallback chosen by whichever route was
 * prefetched, which could be the wrong one when navigating in from outside an org.
 */
export default async function DashboardOrgLayout({
  children,
  params,
}: DashboardOrgLayoutProps): Promise<ReactElement> {
  const { orgSlug } = await params;
  await requireUser(`/dashboard/${orgSlug}`);

  return (
    <BoardLabelProvider>
      <div className="flex min-h-dvh flex-col md:flex-row">
        <Suspense fallback={<DashboardSidebarSkeleton />}>
          <OrgSidebar orgSlug={orgSlug} />
        </Suspense>
        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardHeader>
            <div className="flex min-w-0 items-center gap-1">
              <Suspense fallback={<Skeleton className="h-11 w-11 md:hidden" />}>
                <OrgMobileNav orgSlug={orgSlug} />
              </Suspense>
              <Suspense fallback={<Skeleton className="h-9 w-40" />}>
                <OrgBreadcrumbSlot orgSlug={orgSlug} />
              </Suspense>
            </div>
          </DashboardHeader>
          <div className="flex-1">{children}</div>
        </div>
      </div>
    </BoardLabelProvider>
  );
}
