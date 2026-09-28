'use client';

import type { Webhook, WebhookCreated } from '@feedback-board/shared';
import type { ReactElement } from 'react';
import { useState } from 'react';

import { CreateWebhookForm } from './create-webhook-form';
import { WebhookList } from './webhook-list';
import { WebhookSecretBanner } from './webhook-secret-banner';
import { WebhookUpgradePrompt } from './webhook-upgrade-prompt';

interface WebhooksManagerProps {
  orgSlug: string;
  /** The org's webhooks fetched server-side by the parent Server Component (TDD §12). */
  initialWebhooks: Webhook[];
  /** `org.usage.webhooks.available` — whether `POST` is currently allowed (TDD §3.9, §11). */
  webhooksAvailable: boolean;
}

/**
 * Client island for `/dashboard/[orgSlug]/webhooks` (TDD §13 step 19.5): combines the creation
 * form (or, on a downgraded org, `WebhookUpgradePrompt` in its place — `create()` is the only
 * PRO-gated route, TDD §11), the one-time secret banner, and the read-only list. A freshly
 * created webhook is appended locally, mirroring `OrgBoardsOverview`'s pattern (Step 19.2).
 */
export function WebhooksManager({
  orgSlug,
  initialWebhooks,
  webhooksAvailable,
}: WebhooksManagerProps): ReactElement {
  const [webhooks, setWebhooks] = useState(initialWebhooks);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  function handleCreated(webhook: WebhookCreated): void {
    const { secret, ...rest } = webhook;
    setWebhooks((current) => [...current, rest]);
    setNewSecret(secret);
  }

  function handleDeleted(webhookId: string): void {
    setWebhooks((current) => current.filter((webhook) => webhook.id !== webhookId));
  }

  return (
    <>
      {newSecret !== null && (
        <WebhookSecretBanner secret={newSecret} onDismiss={() => setNewSecret(null)} />
      )}
      {webhooksAvailable ? (
        <CreateWebhookForm orgSlug={orgSlug} onCreated={handleCreated} />
      ) : (
        <WebhookUpgradePrompt orgSlug={orgSlug} />
      )}
      <WebhookList orgSlug={orgSlug} webhooks={webhooks} onDeleted={handleDeleted} />
    </>
  );
}
