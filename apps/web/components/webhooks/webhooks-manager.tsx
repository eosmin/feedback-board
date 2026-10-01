'use client';

import type { Webhook, WebhookCreated } from '@feedback-board/shared';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { useState } from 'react';

import { Button, Dialog } from '../ui';
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
 * form — opened in a `Dialog` instead of sitting inline (§13 step 19.7 follow-up), or replaced by
 * `WebhookUpgradePrompt` on a downgraded org, since `create()` is the only PRO-gated route
 * (TDD §11) — the one-time secret banner, and the read-only list. A freshly created webhook is
 * appended locally, mirroring `OrgBoardsOverview`'s pattern (Step 19.2).
 */
export function WebhooksManager({
  orgSlug,
  initialWebhooks,
  webhooksAvailable,
}: WebhooksManagerProps): ReactElement {
  const t = useTranslations('dashboard.webhooks.createForm');
  const tCommon = useTranslations('common');
  const [webhooks, setWebhooks] = useState(initialWebhooks);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  function handleCreated(webhook: WebhookCreated): void {
    const { secret, ...rest } = webhook;
    setWebhooks((current) => [...current, rest]);
    setNewSecret(secret);
    setDialogOpen(false);
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
        <div className="flex justify-end">
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('trigger')}
          </Button>
        </div>
      ) : (
        <WebhookUpgradePrompt orgSlug={orgSlug} />
      )}
      <WebhookList orgSlug={orgSlug} webhooks={webhooks} onDeleted={handleDeleted} />
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={t('title')}
        closeLabel={tCommon('close')}
      >
        <CreateWebhookForm orgSlug={orgSlug} onCreated={handleCreated} />
      </Dialog>
    </>
  );
}
