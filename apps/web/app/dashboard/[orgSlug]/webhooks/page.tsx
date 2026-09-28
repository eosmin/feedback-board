import { orgDetailSchema, webhookSchema } from '@feedback-board/shared';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { WebhooksManager } from '../../../../components/webhooks/webhooks-manager';
import { serverApiFetch } from '../../../../lib/api-client-server';
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
  await requireUser();
  const { orgSlug } = await params;
  const t = await getTranslations('dashboard.webhooks');

  const org = await serverApiFetch(`/orgs/${orgSlug}`, orgDetailSchema);

  if (org.role !== 'OWNER' && org.role !== 'ADMIN') {
    notFound();
  }

  const webhooks = await serverApiFetch(`/orgs/${orgSlug}/webhooks`, webhookListSchema);

  return (
    <main>
      <h1>{t('title')}</h1>
      <WebhooksManager
        orgSlug={orgSlug}
        initialWebhooks={webhooks}
        webhooksAvailable={org.usage.webhooks.available}
      />
    </main>
  );
}
