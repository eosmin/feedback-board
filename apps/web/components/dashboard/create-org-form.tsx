'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  createOrgSchema,
  orgSummarySchema,
  type CreateOrgInput,
  type OrgSummary,
} from '@feedback-board/shared';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { apiFetch, ApiError } from '../../lib/api-client';
import { useSlugAutofill } from '../../lib/use-slug-autofill';
import { Button, Input } from '../ui';

interface CreateOrgFormProps {
  /** Called after a successful creation, so the parent can refresh its org list. */
  onCreated: (org: OrgSummary) => void;
}

/**
 * Creates an org and bootstraps the caller as OWNER (TDD §11, §13 step 19.1). The reserved-slug
 * rule (`RESERVED_ORG_SLUGS`) is enforced by `orgSlugSchema` on both ends — the API's `409
 * CONFLICT` for a reserved or duplicate slug surfaces here as a field error on `slug`, never a
 * generic failure (TDD §7.8, §12).
 */
export function CreateOrgForm({ onCreated }: CreateOrgFormProps): ReactElement {
  const t = useTranslations('dashboard.createOrg');
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [slugTaken, setSlugTaken] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrgInput>({
    resolver: zodResolver(createOrgSchema),
  });

  const nameValue = useWatch({ control, name: 'name' });
  const { onSlugChange } = useSlugAutofill(nameValue, setValue);

  async function onSubmit(values: CreateOrgInput): Promise<void> {
    setSubmitError(null);
    setSlugTaken(false);

    try {
      const org = await apiFetch('/orgs', orgSummarySchema, { method: 'POST', body: values });
      onCreated(org);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.body.error === 'CONFLICT') {
        setSlugTaken(true);
        return;
      }
      setSubmitError(t('error'));
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      noValidate
      className="flex flex-col gap-3"
    >
      <label htmlFor="org-name" className="text-sm font-medium text-zinc-700">
        {t('nameLabel')}
      </label>
      <Input id="org-name" type="text" aria-invalid={errors.name !== undefined} {...register('name')} />
      {errors.name !== undefined && (
        <p role="alert" className="text-sm text-red-600">
          {t('nameInvalid')}
        </p>
      )}

      <label htmlFor="org-slug" className="text-sm font-medium text-zinc-700">
        {t('slugLabel')}
      </label>
      <Input
        id="org-slug"
        type="text"
        aria-invalid={errors.slug !== undefined || slugTaken}
        {...register('slug', { onChange: onSlugChange })}
      />
      <p className="text-sm text-zinc-500">{t('slugHelp')}</p>
      {errors.slug !== undefined && (
        <p role="alert" className="text-sm text-red-600">
          {t('slugInvalid')}
        </p>
      )}
      {slugTaken && (
        <p role="alert" className="text-sm text-red-600">
          {t('slugReserved')}
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
