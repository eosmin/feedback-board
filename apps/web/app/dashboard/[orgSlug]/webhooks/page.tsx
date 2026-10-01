import { webhookSchema } from '@feedback-board/shared';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { PageHeader } from '../../../../components/ui';
import { WebhooksManager } from '../../../../components/webhooks/webhooks-manager';
import { serverApiFetch } from '../../../../lib/api-client-server';
import { getOrgDetail } from '../../../../lib/org-detail';
import { requireUser } from '../../../../lib/supabase/require-user';

const webhookListSchema = z.array(webhookSchema);

interface WebhooksPageProps {
  params: Promise<{ orgSlug: string }>;
}

/**
 * `/dashboard/[orgSlug]/webhooks` (TDD §3.7, §11, §12, §13 step 19.5): a Server Component fetches
 * the org detail (role, plan availability) and the webhook list; the interactive parts (create
 * form, secret banner, delivery log, delete) live in the `WebhooksManager` client island. No
 * plan gate on the page itself — a downgraded org still reaches it, same pattern as
 * `BillingPage`'s OWNER-only `notFound()` guard, but here OWNER **and** ADMIN pass (§11), since
 * `WebhooksController`'s routes are `@Roles('OWNER', 'ADMIN')` rather than OWNER-only.
 */
export default async function WebhooksPage({ params }: WebhooksPageProps): Promise<ReactElement> {
  const { orgSlug } = await params;
  await requireUser(`/dashboard/${orgSlug}/webhooks`);
  const t = await getTranslations('dashboard.webhooks');

  const org = await getOrgDetail(orgSlug);

  if (org.role !== 'OWNER' && org.role !== 'ADMIN') {
    notFound();
  }

  const webhooks = await serverApiFetch(`/orgs/${orgSlug}/webhooks`, webhookListSchema);

  return (
    <main className="flex flex-col gap-6 p-6">
      <PageHeader title={t('title')} />
      <WebhooksManager
        orgSlug={orgSlug}
        initialWebhooks={webhooks}
        webhooksAvailable={org.usage.webhooks.available}
      />
    </main>
  );
}
