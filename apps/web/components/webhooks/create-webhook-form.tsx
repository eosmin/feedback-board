'use client';

import { createWebhookSchema, webhookCreatedSchema, WEBHOOK_EVENTS } from '@feedback-board/shared';
import type { WebhookCreated, WebhookEvent } from '@feedback-board/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { apiFetch } from '../../lib/api-client';
import { Button, Input } from '../ui';

interface CreateWebhookFormProps {
  orgSlug: string;
  onCreated: (webhook: WebhookCreated) => void;
}

type CreateWebhookFormValues = z.input<typeof createWebhookSchema>;

/**
 * Message keys are statically checked (TDD §2.6.13), so a template-literal `t(`event.${event}`)`
 * does not typecheck — this maps each `WebhookEvent` to its literal key instead.
 */
const EVENT_LABEL_KEY: Record<WebhookEvent, 'event.post_created' | 'event.post_status_changed'> = {
  'post.created': 'event.post_created',
  'post.status_changed': 'event.post_status_changed',
};

/**
 * Creates a webhook for the current org (TDD §3.5, §3.7, §11, §13 step 19.5). Only rendered by
 * `WebhooksManager` when `usage.webhooks.available` is true — a downgraded org sees
 * `WebhookUpgradePrompt` in its place, since `POST` is the only PRO-gated route here.
 */
export function CreateWebhookForm({ orgSlug, onCreated }: CreateWebhookFormProps): ReactElement {
  const t = useTranslations('dashboard.webhooks.createForm');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateWebhookFormValues>({
    resolver: zodResolver(createWebhookSchema),
  });

  async function onSubmit(values: CreateWebhookFormValues): Promise<void> {
    setSubmitError(null);

    try {
      const webhook = await apiFetch(`/orgs/${orgSlug}/webhooks`, webhookCreatedSchema, {
        method: 'POST',
        body: values,
      });
      onCreated(webhook);
      reset();
    } catch {
      setSubmitError(t('error'));
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      noValidate
      className="flex flex-col gap-3"
    >
      <label htmlFor="webhook-target-url" className="text-sm font-medium text-zinc-700">
        {t('targetUrlLabel')}
      </label>
      <Input
        id="webhook-target-url"
        type="url"
        aria-invalid={errors.targetUrl !== undefined}
        {...register('targetUrl')}
      />
      {errors.targetUrl !== undefined && (
        <p role="alert" className="text-sm text-red-600">
          {t('targetUrlInvalid')}
        </p>
      )}

      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-medium text-zinc-700">{t('eventsLabel')}</legend>
        {(WEBHOOK_EVENTS as WebhookEvent[]).map((event) => (
          <label
            key={event}
            htmlFor={`webhook-event-${event}`}
            className="flex items-center gap-2 text-sm text-zinc-700"
          >
            <input
              id={`webhook-event-${event}`}
              type="checkbox"
              value={event}
              {...register('events')}
            />
            {t(EVENT_LABEL_KEY[event])}
          </label>
        ))}
      </fieldset>
      {errors.events !== undefined && (
        <p role="alert" className="text-sm text-red-600">
          {t('eventsInvalid')}
        </p>
      )}

      {submitError !== null && (
        <p role="alert" className="text-sm text-red-600">
          {submitError}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? t('creating') : t('submit')}
      </Button>
    </form>
  );
}
