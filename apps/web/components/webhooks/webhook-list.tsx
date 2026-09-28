'use client';

import type { Webhook } from '@feedback-board/shared';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { apiFetch } from '../../lib/api-client';
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
    return <p>{t('empty')}</p>;
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
        <li
          key={webhook.id}
          className={`rounded-lg border border-brand-100 p-4 ${webhook.isActive ? '' : 'opacity-50'}`}
        >
          <p className="font-medium">{webhook.targetUrl}</p>
          <p className="text-sm">{webhook.events.join(', ')}</p>
          <p className="text-sm">
            {webhook.isActive ? t('status.active') : t('status.disabled')}
          </p>
          <button type="button" onClick={() => void handleDelete(webhook.id)}>
            {t('delete')}
          </button>
          <WebhookDeliveries orgSlug={orgSlug} webhookId={webhook.id} />
        </li>
      ))}
    </ul>
  );
}
