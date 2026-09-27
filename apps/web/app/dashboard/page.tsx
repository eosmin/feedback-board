import { orgSummarySchema } from '@feedback-board/shared';
import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { OrgPicker } from '../../components/dashboard/org-picker';
import { serverApiFetch } from '../../lib/api-client-server';
import { requireUser } from '../../lib/supabase/require-user';

const orgSummaryListSchema = z.array(orgSummarySchema);

/**
 * `/dashboard` (TDD §12): the org picker — list the caller's orgs, create a new one. A Server
 * Component fetches the initial list; the interactive parts (creation form, optimistic list
 * update) live in the `OrgPicker` client island below it (TDD §13 step 19.1).
 */
export default async function DashboardPage(): Promise<ReactElement> {
  await requireUser();
  const t = await getTranslations('dashboard');

  const orgs = await serverApiFetch('/orgs', orgSummaryListSchema);

  return (
    <main>
      <h1>{t('title')}</h1>
      <OrgPicker initialOrgs={orgs} />
    </main>
  );
}
