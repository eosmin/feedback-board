import { orgSummarySchema } from '@feedback-board/shared';
import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { OrgPicker } from '../../components/dashboard/org-picker';
import { PageHeader } from '../../components/ui';
import { serverApiFetch } from '../../lib/api-client-server';
import { requireUser } from '../../lib/supabase/require-user';

const orgSummaryListSchema = z.array(orgSummarySchema);

/**
 * `/dashboard` (TDD §12): the org picker — list the caller's orgs, create a new one. A Server
 * Component fetches the initial list; the interactive parts (creation form, optimistic list
 * update) live in the `OrgPicker` client island below it (TDD §13 step 19.1).
 */
export default async function DashboardPage(): Promise<ReactElement> {
  await requireUser('/dashboard');
  const t = await getTranslations('dashboard');

  const orgs = await serverApiFetch('/orgs', orgSummaryListSchema);

  return (
    <main className="flex flex-col gap-6 p-6">
      <PageHeader title={t('title')} />
      <OrgPicker initialOrgs={orgs} />
    </main>
  );
}
