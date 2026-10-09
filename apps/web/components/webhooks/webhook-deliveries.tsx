'use client';

import type { WebhookDelivery } from '@feedback-board/shared';
import { webhookDeliverySchema } from '@feedback-board/shared';
import { useTranslations } from 'next-intl';
import { Fragment, type ReactElement } from 'react';
import { useState } from 'react';
import { z } from 'zod';

import { apiFetch } from '../../lib/api-client';
import { Button, EmptyState } from '../ui';

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
  const [isOpen, setIsOpen] = useState(false);

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

  function handleToggle(): void {
    const next = !isOpen;
    setIsOpen(next);
    if (next && deliveries === null) {
      void load();
    }
  }

  return (
    <Fragment>
      <Button variant="secondary" disabled={isLoading} onClick={handleToggle}>
        {isLoading ? t('loading') : isOpen ? t('hide') : t('show')}
      </Button>
      {isOpen && (
        <div className="mt-3 w-full basis-full">
          {loadError !== null && (
            <p role="alert" className="text-sm text-danger">
              {loadError}
            </p>
          )}
          {loadError === null && deliveries !== null && deliveries.length === 0 && (
            <EmptyState>{t('empty')}</EmptyState>
          )}
          {loadError === null && deliveries !== null && deliveries.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-text-muted">
                  <th className="py-1 pr-2 font-medium">{t('columns.attempt')}</th>
                  <th className="py-1 pr-2 font-medium">{t('columns.event')}</th>
                  <th className="py-1 pr-2 font-medium">{t('columns.status')}</th>
                  <th className="py-1 pr-2 font-medium">{t('columns.createdAt')}</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((delivery) => (
                  <tr key={delivery.id} className="border-b border-border text-text">
                    <td className="py-1 pr-2">{delivery.attempt}</td>
                    <td className="py-1 pr-2">{delivery.event}</td>
                    <td className="py-1 pr-2">{delivery.responseStatus ?? t('noResponse')}</td>
                    <td className="py-1 pr-2">{delivery.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Fragment>
  );
}
