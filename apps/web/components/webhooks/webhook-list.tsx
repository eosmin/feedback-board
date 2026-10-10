'use client';

import type { Webhook } from '@feedback-board/shared';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { apiFetch } from '../../lib/api-client';
import { Badge, Button, Card, EmptyState } from '../ui';
import { WebhookDeliveries } from './webhook-deliveries';

/** `DELETE` returns `204 No Content`, which `apiFetch` surfaces as `null` (TDD §7.1). */
const deleteResponseSchema = z.null();

interface WebhookListProps {
  orgSlug: string;
  webhooks: Webhook[];
  onDeleted: (webhookId: string) => void;
}

/**
 * Renders every webhook the org owns (TDD §3.7, §11, §13 step 19.5). `isActive: false` — set
 * server-side on downgrade, never by this page — renders the row disabled with the upgrade
 * prompt already shown above the list by `WebhooksManager`; `DELETE` stays un-gated on the API
 * (§3.7 step 6), so the button is never disabled here.
 */
export function WebhookList({ orgSlug, webhooks, onDeleted }: WebhookListProps): ReactElement {
  const t = useTranslations('dashboard.webhooks.list');

  if (webhooks.length === 0) {
    return <EmptyState>{t('empty')}</EmptyState>;
  }

  async function handleDelete(webhookId: string): Promise<void> {
    await apiFetch(`/orgs/${orgSlug}/webhooks/${webhookId}`, deleteResponseSchema, {
      method: 'DELETE',
    });
    onDeleted(webhookId);
  }

  return (
    <ul className="flex flex-col gap-3">
      {webhooks.map((webhook) => (
        <Card as="li" key={webhook.id} className={webhook.isActive ? undefined : 'opacity-50'}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium text-text">{webhook.targetUrl}</p>
              <p className="text-sm text-text-muted">{webhook.events.join(', ')}</p>
            </div>
            <Badge tone={webhook.isActive ? 'accent' : 'neutral'}>
              {webhook.isActive ? t('status.active') : t('status.disabled')}
            </Badge>
          </div>
          <div className="mt-3 flex flex-wrap items-start gap-3">
            <Button variant="secondary" onClick={() => void handleDelete(webhook.id)}>
              {t('delete')}
            </Button>
            <WebhookDeliveries orgSlug={orgSlug} webhookId={webhook.id} />
          </div>
        </Card>
      ))}
    </ul>
  );
}
