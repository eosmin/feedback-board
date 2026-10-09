import { boardSchema } from '@feedback-board/shared';
import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { OrgBoardsOverview } from '../../../components/dashboard/org-boards-overview';
import { Badge, PageHeader } from '../../../components/ui';
import { serverApiFetch } from '../../../lib/api-client-server';
import { getOrgDetail } from '../../../lib/org-detail';
import { requireUser } from '../../../lib/supabase/require-user';

const boardListSchema = z.array(boardSchema);

interface OrgOverviewPageProps {
  params: Promise<{ orgSlug: string }>;
}

/**
 * `/dashboard/[orgSlug]` (TDD §12): the org's boards overview. A Server Component fetches the
 * org detail (name, plan) and the board list; the interactive parts (creation form, the
 * `PLAN_LIMIT` upgrade prompt) live in the `OrgBoardsOverview` client island (TDD §13 step
 * 19.2). `requireUser()` guards the page the same way Step 19.1's `/dashboard` does — there is
 * no middleware in this project (TDD §2.6.13), so every authenticated page checks itself.
 * Membership itself is enforced by `OrgGuard` on the API side: an org the caller does not
 * belong to answers `403 FORBIDDEN` from `serverApiFetch`, which this page lets propagate to
 * Next's error boundary rather than special-casing it (TDD §11).
 */
export default async function OrgOverviewPage({
  params,
}: OrgOverviewPageProps): Promise<ReactElement> {
  const { orgSlug } = await params;
  await requireUser(`/dashboard/${orgSlug}`);
  const t = await getTranslations('dashboard.orgOverview');

  const [org, boards] = await Promise.all([
    getOrgDetail(orgSlug),
    serverApiFetch(`/orgs/${orgSlug}/boards`, boardListSchema),
  ]);

  return (
    <main className="flex flex-col gap-6 p-6">
      <PageHeader title={org.name} badge={<Badge>{org.plan}</Badge>} />
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-text">{t('boardsTitle')}</h2>
        <OrgBoardsOverview orgSlug={orgSlug} initialBoards={boards} />
      </div>
    </main>
  );
}
