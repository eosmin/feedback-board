'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  commentSchema,
  createCommentSchema,
  type Comment,
  type CreateCommentInput,
} from '@feedback-board/shared';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { apiFetch } from '../../lib/api-client';

const commentListSchema = z.array(commentSchema);

interface PostCommentsProps {
  orgSlug: string;
  postId: string;
}

/**
 * Comment thread for a single post (TDD §11): fetches the list once on mount and appends a
 * freshly created comment locally, the same optimistic-append pattern `OrgBoardsOverview` and
 * `OrgPicker` use for their own collections (Step 19.1/19.2).
 */
export function PostComments({ orgSlug, postId }: PostCommentsProps): ReactElement {
  const t = useTranslations('dashboard.boardDetail.comments');
  const [comments, setComments] = useState<Comment[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiFetch(`/orgs/${orgSlug}/posts/${postId}/comments`, commentListSchema)
      .then((result) => {
        if (!cancelled) {
          setComments(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setComments([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [orgSlug, postId]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateCommentInput>({
    resolver: zodResolver(createCommentSchema),
  });

  async function onSubmit(values: CreateCommentInput): Promise<void> {
    const comment = await apiFetch(`/orgs/${orgSlug}/posts/${postId}/comments`, commentSchema, {
      method: 'POST',
      body: values,
    });
    setComments((current) => (current === null ? [comment] : [...current, comment]));
    reset();
  }

  return (
    <section className="mt-3">
      <h4 className="text-sm font-medium">{t('title')}</h4>
      {comments === null ? (
        <p>{t('loading')}</p>
      ) : comments.length === 0 ? (
        <p>{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {comments.map((comment) => (
            <li key={comment.id} className="text-sm">
              {comment.body}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} noValidate>
        <label htmlFor={`comment-body-${postId}`} className="sr-only">
          {t('bodyLabel')}
        </label>
        <input
          id={`comment-body-${postId}`}
          type="text"
          aria-invalid={errors.body !== undefined}
          {...register('body')}
        />
        {errors.body !== undefined && <p role="alert">{t('bodyInvalid')}</p>}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('submitting') : t('submit')}
        </button>
      </form>
    </section>
  );
}
