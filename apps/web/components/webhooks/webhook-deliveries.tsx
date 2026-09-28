'use client';

import type { WebhookDelivery } from '@feedback-board/shared';
import { webhookDeliverySchema } from '@feedback-board/shared';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { z } from 'zod';

import { apiFetch } from '../../lib/api-client';

const webhookDeliveryListSchema = z.array(webhookDeliverySchema);

interface WebhookDeliveriesProps {
  orgSlug: string;
  webhookId: string;
}

/**
 * Fetches and renders the delivery log on demand, one row per attempt, newest first — the API
 * already sorts it that way (TDD §3.7, §13 step 19.5). Not PRO-gated on the API side, so this
 * loads the same for a downgraded org.
 */
export function WebhookDeliveries({ orgSlug, webhookId }: WebhookDeliveriesProps): ReactElement {
  const t = useTranslations('dashboard.webhooks.deliveries');
  const [deliveries, setDeliveries] = useState<WebhookDelivery[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function load(): Promise<void> {
    setIsLoading(true);
    setLoadError(null);

    try {
      const rows = await apiFetch(
        `/orgs/${orgSlug}/webhooks/${webhookId}/deliveries`,
        webhookDeliveryListSchema,
      );
      setDeliveries(rows);
    } catch {
      setLoadError(t('error'));
    } finally {
      setIsLoading(false);
    }
  }

  if (loadError !== null) {
    return <p role="alert">{loadError}</p>;
  }

  if (deliveries === null) {
    return (
      <button type="button" disabled={isLoading} onClick={() => void load()}>
        {isLoading ? t('loading') : t('show')}
      </button>
    );
  }

  if (deliveries.length === 0) {
    return <p>{t('empty')}</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>{t('columns.attempt')}</th>
          <th>{t('columns.event')}</th>
          <th>{t('columns.status')}</th>
          <th>{t('columns.createdAt')}</th>
        </tr>
      </thead>
      <tbody>
        {deliveries.map((delivery) => (
          <tr key={delivery.id}>
            <td>{delivery.attempt}</td>
            <td>{delivery.event}</td>
            <td>{delivery.responseStatus ?? t('noResponse')}</td>
            <td>{delivery.createdAt}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
