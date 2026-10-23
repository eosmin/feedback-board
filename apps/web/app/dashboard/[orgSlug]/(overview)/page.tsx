import { boardSummarySchema } from '@feedback-board/shared';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { OrgBoardsOverview } from '../../../../components/dashboard/org-boards-overview';
import { Badge, PageHeader } from '../../../../components/ui';
import { serverApiFetch } from '../../../../lib/api-client-server';
import { getOrgDetail, rethrowNoAccessAsNotFound } from '../../../../lib/org-detail';
import { requireUser } from '../../../../lib/supabase/require-user';

const boardListSchema = z.array(boardSummarySchema);

interface OrgOverviewPageProps {
  params: Promise<{ orgSlug: string }>;
}

/** The tab reads "Boards · FeedbackBoard"; the layout's org name stays the fallback elsewhere. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard.orgOverview');
  return { title: t('boardsTitle') };
}

/**
 * `/dashboard/[orgSlug]` (TDD §12): the org's boards overview. A Server Component fetches the
 * org detail (name, plan) and the board list; the interactive parts (creation form, the
 * `PLAN_LIMIT` upgrade prompt) live in the `OrgBoardsOverview` client island (TDD §13 step
 * 19.2). `requireUser()` guards the page the same way Step 19.1's `/dashboard` does — there is
 * no middleware in this project (TDD §2.6.13), so every authenticated page checks itself.
 * Membership itself is enforced by `OrgGuard` on the API side: an org the caller does not
 * belong to answers `403 FORBIDDEN` from `serverApiFetch`, which `rethrowNoAccessAsNotFound`
 * turns into the not-found screen: an org one cannot open reads the same as one that does not
 * exist (TDD §11).
 */
export default async function OrgOverviewPage({
  params,
}: OrgOverviewPageProps): Promise<ReactElement> {
  const { orgSlug } = await params;
  await requireUser(`/dashboard/${orgSlug}`);
  const t = await getTranslations('dashboard.orgOverview');
  const tPlan = await getTranslations('dashboard.planBadge');

  const [org, boards] = await Promise.all([
    getOrgDetail(orgSlug),
    serverApiFetch(`/orgs/${orgSlug}/boards`, boardListSchema).catch(rethrowNoAccessAsNotFound),
  ]);

  return (
    <main className="flex flex-col gap-6 p-6">
      <PageHeader title={t('boardsTitle')} badge={<Badge>{tPlan(org.plan)}</Badge>} />
      <OrgBoardsOverview orgSlug={orgSlug} initialBoards={boards} usage={org.usage.boards} />
    </main>
  );
}
