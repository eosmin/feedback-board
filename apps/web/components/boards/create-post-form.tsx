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
import { Button, Input, Textarea } from '../ui';
import { PostLimitUpgradePrompt } from './post-limit-upgrade-prompt';

interface CreatePostFormProps {
  orgSlug: string;
  boardSlug: string;
  /** Called after a successful creation, so the parent can add it to the top of the post list. */
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
    <form
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      noValidate
      className="flex flex-col gap-3"
    >
      <label htmlFor="post-title" className="text-sm font-medium text-zinc-700">
        {t('titleLabel')}
      </label>
      <Input
        id="post-title"
        type="text"
        aria-invalid={errors.title !== undefined}
        {...register('title')}
      />
      {errors.title !== undefined && (
        <p role="alert" className="text-sm text-red-600">
          {t('titleInvalid')}
        </p>
      )}

      <label htmlFor="post-body" className="text-sm font-medium text-zinc-700">
        {t('bodyLabel')}
      </label>
      <Textarea id="post-body" aria-invalid={errors.body !== undefined} {...register('body')} />
      {errors.body !== undefined && (
        <p role="alert" className="text-sm text-red-600">
          {t('bodyInvalid')}
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
