import { orgSummarySchema } from '@feedback-board/shared';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { OrgPicker } from '../../../components/dashboard/org-picker';
import { PickerHeader } from '../../../components/dashboard/picker-header';
import { serverApiFetch } from '../../../lib/api-client-server';
import { requireUser } from '../../../lib/supabase/require-user';

const orgSummaryListSchema = z.array(orgSummarySchema);

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard');
  return { title: t('title') };
}

/**
 * `/dashboard` (TDD §12): the org picker — list the caller's orgs, create a new one. A Server
 * Component fetches the initial list; the interactive parts (creation form, optimistic list
 * update) live in the `OrgPicker` client island below it (TDD §13 step 19.1). The
 * account header (sign out included) is part of the page and of its loading state, not of a
 * layout: a layout is on screen before the page's own boundary, which left it alone on a blank
 * page while the list loaded.
 */
export default async function DashboardPage(): Promise<ReactElement> {
  await requireUser('/dashboard');

  const orgs = await serverApiFetch('/orgs', orgSummaryListSchema);

  return (
    <>
      <PickerHeader />
      <main className="flex flex-col gap-6 p-6">
        <OrgPicker initialOrgs={orgs} />
      </main>
    </>
  );
}
