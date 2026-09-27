import { boardSchema, orgDetailSchema } from '@feedback-board/shared';
import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { OrgBoardsOverview } from '../../../components/dashboard/org-boards-overview';
import { serverApiFetch } from '../../../lib/api-client-server';
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
  await requireUser();
  const { orgSlug } = await params;
  const t = await getTranslations('dashboard.orgOverview');

  const [org, boards] = await Promise.all([
    serverApiFetch(`/orgs/${orgSlug}`, orgDetailSchema),
    serverApiFetch(`/orgs/${orgSlug}/boards`, boardListSchema),
  ]);

  return (
    <main>
      <h1>{org.name}</h1>
      <span className="inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800">
        {org.plan}
      </span>
      <h2>{t('boardsTitle')}</h2>
      <OrgBoardsOverview orgSlug={orgSlug} initialBoards={boards} />
    </main>
  );
}
