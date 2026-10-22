'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  createOrgSchema,
  orgSummarySchema,
  type CreateOrgInput,
  type OrgSummary,
} from '@feedback-board/shared';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { apiFetch, ApiError } from '../../lib/api-client';
import { useRefocusAfterSubmit } from '../../lib/use-refocus-after-submit';
import { useSlugAutofill } from '../../lib/use-slug-autofill';
import { Button, Form, Input } from '../ui';

interface CreateOrgFormProps {
  /** Called after a successful creation; the parent decides where to go next. */
  onCreated: (org: OrgSummary) => void;
  /** The parent is navigating to the new org: keep the submit button pending until it lands. */
  navigating?: boolean;
}

/**
 * Creates an org and bootstraps the caller as OWNER (TDD §11, §13 step 19.1). The reserved-slug
 * rule (`RESERVED_ORG_SLUGS`) is enforced by `orgSlugSchema` on both ends — the API's `409
 * CONFLICT` for a reserved or duplicate slug surfaces here as a field error on `slug`, never a
 * generic failure (TDD §7.8, §12).
 */
export function CreateOrgForm({ onCreated, navigating = false }: CreateOrgFormProps): ReactElement {
  const t = useTranslations('dashboard.createOrg');
  const [submitError, setSubmitError] = useState<string | null>(null);
  // The slug the server turned down: the error shows only while the field still holds it, so it
  // goes away on the next keystroke (or an autofill from the name) instead of lingering.
  const [takenSlug, setTakenSlug] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setFocus,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrgInput>({
    resolver: zodResolver(createOrgSchema),
  });
  const requestFocus = useRefocusAfterSubmit(setFocus, isSubmitting);

  const nameValue = useWatch({ control, name: 'name' });
  const slugValue = useWatch({ control, name: 'slug' });
  const slugTaken = takenSlug !== null && takenSlug === slugValue;
  const { onSlugChange } = useSlugAutofill(nameValue, setValue);

  async function onSubmit(values: CreateOrgInput): Promise<void> {
    setSubmitError(null);
    setTakenSlug(null);

    let org: OrgSummary;
    try {
      org = await apiFetch('/orgs', orgSummarySchema, { method: 'POST', body: values });
    } catch (error) {
      if (error instanceof ApiError && error.body.error === 'CONFLICT') {
        setTakenSlug(values.slug);
        requestFocus('slug');
        return;
      }
      setSubmitError(t('error'));
      requestFocus('name');
      return;
    }

    // Outside the `try`: the org exists now, so a failure in the parent's handler must not read
    // as "could not create".
    onCreated(org);
  }

  const slugDescribedBy = [
    'org-slug-help',
    errors.slug !== undefined ? 'org-slug-error' : null,
    slugTaken ? 'org-slug-taken' : null,
  ]
    .filter((id) => id !== null)
    .join(' ');

  return (
    <Form
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      pending={isSubmitting || navigating}
      onEdit={() => setSubmitError(null)}
      className="flex flex-col gap-3"
    >
      <label htmlFor="org-name" className="text-sm font-medium text-text">
        {t('nameLabel')}
      </label>
      <Input
        id="org-name"
        type="text"
        aria-invalid={errors.name !== undefined}
        aria-describedby={errors.name !== undefined ? 'org-name-error' : undefined}
        {...register('name')}
      />
      {errors.name !== undefined && (
        <p id="org-name-error" role="alert" className="text-sm text-danger">
          {t('nameInvalid')}
        </p>
      )}

      <label htmlFor="org-slug" className="text-sm font-medium text-text">
        {t('slugLabel')}
      </label>
      <Input
        id="org-slug"
        type="text"
        aria-invalid={errors.slug !== undefined || slugTaken}
        aria-describedby={slugDescribedBy}
        {...register('slug', { onChange: onSlugChange })}
      />
      <p id="org-slug-help" className="text-sm text-text-muted">
        {t('slugHelp')}
      </p>
      {errors.slug !== undefined && (
        <p id="org-slug-error" role="alert" className="text-sm text-danger">
          {t('slugInvalid')}
        </p>
      )}
      {slugTaken && (
        <p id="org-slug-taken" role="alert" className="text-sm text-danger">
          {t('slugReserved')}
        </p>
      )}
      {submitError !== null && (
        <p role="alert" className="text-sm text-danger">
          {submitError}
        </p>
      )}

      <Button type="submit" pending={isSubmitting || navigating}>
        {isSubmitting || navigating ? t('creating') : t('submit')}
      </Button>
    </Form>
  );
}
