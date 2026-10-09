import { orgSummarySchema } from '@feedback-board/shared';
import type { ReactElement, ReactNode } from 'react';
import { z } from 'zod';

import { DashboardSidebar } from '../../../components/dashboard/dashboard-sidebar';
import { LocaleSwitcher } from '../../../components/dashboard/locale-switcher';
import { OrgSwitcher } from '../../../components/dashboard/org-switcher';
import { SignOutButton } from '../../../components/dashboard/sign-out-button';
import { ThemeToggle } from '../../../components/ui';
import { serverApiFetch } from '../../../lib/api-client-server';
import { getOrgDetail } from '../../../lib/org-detail';
import { requireUser } from '../../../lib/supabase/require-user';

const orgSummaryListSchema = z.array(orgSummarySchema);

interface DashboardOrgLayoutProps {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
}

/**
 * The dashboard shell (TDD.md §13 step 19.7 follow-up): a fixed sidebar + topbar wrapping every
 * `/dashboard/[orgSlug]/**` page, replacing each page's own root `<main>` with one shared frame.
 * `requireUser()` guards here too (same pattern every authenticated page already used, §2.6.13 —
 * there is no middleware in this project) so an unauthenticated request never renders the shell.
 * Membership itself is still enforced by `OrgGuard` on the API side (§11): a caller without
 * access to `orgSlug` gets a `403` from this `serverApiFetch` call, which propagates to Next's
 * error boundary exactly as it did before the shell existed.
 */
export default async function DashboardOrgLayout({
  children,
  params,
}: DashboardOrgLayoutProps): Promise<ReactElement> {
  const { orgSlug } = await params;
  await requireUser(`/dashboard/${orgSlug}`);
  const [org, orgs] = await Promise.all([
    getOrgDetail(orgSlug),
    serverApiFetch('/orgs', orgSummaryListSchema),
  ]);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <DashboardSidebar orgSlug={orgSlug} org={org} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b border-border bg-surface-raised px-4 py-2">
          <OrgSwitcher currentOrgSlug={orgSlug} currentOrgName={org.name} orgs={orgs} />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <LocaleSwitcher />
            <SignOutButton />
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
