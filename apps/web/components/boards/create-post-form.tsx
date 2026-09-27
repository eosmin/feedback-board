'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  createPostSchema,
  postSchema,
  type CreatePostInput,
  type Post,
} from '@feedback-board/shared';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { apiFetch, ApiError } from '../../lib/api-client';
import { PostLimitUpgradePrompt } from './post-limit-upgrade-prompt';

interface CreatePostFormProps {
  orgSlug: string;
  boardSlug: string;
  /** Called after a successful creation, so the parent can append it to the post list. */
  onCreated: (post: Post) => void;
}

/**
 * Creates a post on the current board (TDD §11, §13 step 19.3). A `403 PLAN_LIMIT` response —
 * the FREE org's 51st post, counted per org not per board (§3.9) — renders
 * `PostLimitUpgradePrompt` inline instead of a generic error, mirroring `CreateBoardForm`'s
 * handling of the boards limit (Step 19.2).
 */
export function CreatePostForm({
  orgSlug,
  boardSlug,
  onCreated,
}: CreatePostFormProps): ReactElement {
  const t = useTranslations('dashboard.boardDetail.createPost');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [planLimitHit, setPlanLimitHit] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreatePostInput>({
    resolver: zodResolver(createPostSchema),
  });

  async function onSubmit(values: CreatePostInput): Promise<void> {
    setSubmitError(null);
    setPlanLimitHit(false);

    try {
      const post = await apiFetch(`/orgs/${orgSlug}/boards/${boardSlug}/posts`, postSchema, {
        method: 'POST',
        body: values,
      });
      onCreated(post);
      reset();
    } catch (error) {
      if (error instanceof ApiError && error.body.error === 'PLAN_LIMIT') {
        setPlanLimitHit(true);
        return;
      }
      setSubmitError(t('error'));
    }
  }

  if (planLimitHit) {
    return <PostLimitUpgradePrompt orgSlug={orgSlug} />;
  }

  return (
    <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} noValidate>
      <h2>{t('title')}</h2>
      <label htmlFor="post-title">{t('titleLabel')}</label>
      <input
        id="post-title"
        type="text"
        aria-invalid={errors.title !== undefined}
        {...register('title')}
      />
      {errors.title !== undefined && <p role="alert">{t('titleInvalid')}</p>}

      <label htmlFor="post-body">{t('bodyLabel')}</label>
      <textarea id="post-body" aria-invalid={errors.body !== undefined} {...register('body')} />
      {errors.body !== undefined && <p role="alert">{t('bodyInvalid')}</p>}

      {submitError !== null && <p role="alert">{submitError}</p>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? t('creating') : t('submit')}
      </button>
    </form>
  );
}
