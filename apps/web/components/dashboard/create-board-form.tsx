'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { boardSchema, createBoardSchema, type Board } from '@feedback-board/shared';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { apiFetch, ApiError } from '../../lib/api-client';
import { PlanLimitUpgradePrompt } from './plan-limit-upgrade-prompt';

interface CreateBoardFormProps {
  orgSlug: string;
  /** Called after a successful creation, so the parent can refresh its board list. */
  onCreated: (board: Board) => void;
}

/**
 * `createBoardSchema`'s `isPublic` field carries a `.default(true)`, so its Zod **input** type
 * (`isPublic?: boolean`) differs from its **output** type (`isPublic: boolean`) — and with
 * `exactOptionalPropertyTypes: true` (TDD §6) the two are not assignable to one another.
 * `zodResolver` types itself against the input shape, so the form must too; `onSubmit` below
 * receives this same pre-default shape, and the default is applied server-side by the DTO
 * (`CreateBoardDto.isPublic` is `@IsOptional`), not read back out of the resolver here.
 */
type CreateBoardFormValues = z.input<typeof createBoardSchema>;

/**
 * Creates a board for the current org (TDD §11, §13 step 19.2). A `403 PLAN_LIMIT` response —
 * the FREE org's 2nd board — renders `PlanLimitUpgradePrompt` inline instead of a generic error
 * (TDD §3.9); a `409 CONFLICT` (duplicate board slug within the org) surfaces as a field error,
 * the same pattern `CreateOrgForm` uses for reserved/duplicate org slugs (Step 19.1).
 */
export function CreateBoardForm({ orgSlug, onCreated }: CreateBoardFormProps): ReactElement {
  const t = useTranslations('dashboard.orgOverview.createBoard');
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [slugTaken, setSlugTaken] = useState(false);
  const [planLimitHit, setPlanLimitHit] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateBoardFormValues>({
    resolver: zodResolver(createBoardSchema),
    defaultValues: { isPublic: true },
  });

  async function onSubmit(values: CreateBoardFormValues): Promise<void> {
    setSubmitError(null);
    setSlugTaken(false);
    setPlanLimitHit(false);

    try {
      const board = await apiFetch(`/orgs/${orgSlug}/boards`, boardSchema, {
        method: 'POST',
        body: values,
      });
      onCreated(board);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.body.error === 'PLAN_LIMIT') {
        setPlanLimitHit(true);
        return;
      }
      if (error instanceof ApiError && error.body.error === 'CONFLICT') {
        setSlugTaken(true);
        return;
      }
      setSubmitError(t('error'));
    }
  }

  if (planLimitHit) {
    return <PlanLimitUpgradePrompt orgSlug={orgSlug} />;
  }

  return (
    <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} noValidate>
      <h2>{t('title')}</h2>
      <label htmlFor="board-name">{t('nameLabel')}</label>
      <input
        id="board-name"
        type="text"
        aria-invalid={errors.name !== undefined}
        {...register('name')}
      />
      {errors.name !== undefined && <p role="alert">{t('nameInvalid')}</p>}

      <label htmlFor="board-slug">{t('slugLabel')}</label>
      <input
        id="board-slug"
        type="text"
        aria-invalid={errors.slug !== undefined || slugTaken}
        {...register('slug')}
      />
      <p>{t('slugHelp')}</p>
      {errors.slug !== undefined && <p role="alert">{t('slugInvalid')}</p>}
      {slugTaken && <p role="alert">{t('slugTaken')}</p>}

      <label htmlFor="board-is-public">
        <input id="board-is-public" type="checkbox" {...register('isPublic')} />
        {t('isPublicLabel')}
      </label>

      {submitError !== null && <p role="alert">{submitError}</p>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? t('creating') : t('submit')}
      </button>
    </form>
  );
}
