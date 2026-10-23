'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  commentSchema,
  createCommentSchema,
  type Comment,
  type CreateCommentInput,
} from '@feedback-board/shared';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { apiFetch } from '../../lib/api-client';
import { useRefocusAfterSubmit } from '../../lib/use-refocus-after-submit';
import { Button, Form, Skeleton, Textarea } from '../ui';

const commentListSchema = z.array(commentSchema);

/** A comment that has been sent but not yet confirmed by the server. */
type CommentEntry = Comment & { pending?: true };

interface PostCommentsProps {
  orgSlug: string;
  postId: string;
  /** Called once the server has accepted a comment, so the list's comment count can follow. */
  onAdded: () => void;
}

/**
 * Comment thread and composer for the post in the drawer (TDD §11). A sent comment shows up at
 * once, marked as sending, and is swapped for the server's copy when the request lands; if the
 * request fails it is taken back out, the text returns to the composer and the error is shown, so
 * nothing the person typed is lost. The composer is a `Textarea` (`Cmd/Ctrl+Enter` sends) whose
 * button stays disabled until there is text.
 */
export function PostComments({ orgSlug, postId, onAdded }: PostCommentsProps): ReactElement {
  const t = useTranslations('dashboard.boardDetail.comments');
  const format = useFormatter();
  const [comments, setComments] = useState<CommentEntry[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const pendingCount = useRef(0);

  useEffect(() => {
    let cancelled = false;

    apiFetch(`/orgs/${orgSlug}/posts/${postId}/comments`, commentListSchema)
      .then((result) => {
        if (!cancelled) {
          setComments(result);
          setLoadFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [orgSlug, postId, reloadKey]);

  const retry = useCallback(() => {
    setLoadFailed(false);
    setReloadKey((key) => key + 1);
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm<CreateCommentInput>({
    resolver: zodResolver(createCommentSchema),
    defaultValues: { body: '' },
  });
  // The form is inert while a comment is in flight, tracked here and not through react-hook-form's
  // `isSubmitting`: `reset()` (which clears the text at once) flips that to `false` immediately, so
  // the form went live while the request was still out.
  const [sending, setSending] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const focusComposer = useCallback(() => composerRef.current?.focus(), []);
  const requestFocus = useRefocusAfterSubmit(focusComposer, sending);
  const { ref: registerRef, ...bodyField } = register('body');
  const hasText = useWatch({ control, name: 'body' }).trim() !== '';
  // Posting before the first load finishes would be overwritten by the list arriving, and posting
  // after it failed would show the new comment alone or not at all: the composer waits for a list.
  const loading = comments === null && !loadFailed;

  async function onSubmit(values: CreateCommentInput): Promise<void> {
    pendingCount.current += 1;
    const pendingId = `pending-${pendingCount.current}`;
    const optimistic: CommentEntry = {
      id: pendingId,
      postId,
      orgId: '',
      authorId: '',
      body: values.body,
      authorName: t('you'),
      createdAt: new Date().toISOString(),
      pending: true,
    };

    setSubmitError(false);
    setSending(true);
    setComments((current) => [...(current ?? []), optimistic]);
    reset();

    try {
      const comment = await apiFetch(`/orgs/${orgSlug}/posts/${postId}/comments`, commentSchema, {
        method: 'POST',
        body: values,
      });
      setComments((current) =>
        (current ?? []).map((entry) => (entry.id === pendingId ? comment : entry)),
      );
      onAdded();
    } catch {
      setComments((current) => (current ?? []).filter((entry) => entry.id !== pendingId));
      setValue('body', values.body);
      setSubmitError(true);
    } finally {
      // Success or failure, the field was disabled while sending and dropped focus.
      // Set before `sending` flips, so the refocus runs in the commit that re-enables the field.
      requestFocus('composer');
      setSending(false);
    }
  }

  return (
    <section aria-labelledby={`comments-title-${postId}`} className="flex flex-col gap-3">
      <h3 id={`comments-title-${postId}`} className="text-title text-text">
        {t('title')}
      </h3>
      {loading ? (
        <div role="status" aria-label={t('loading')} className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
        </div>
      ) : loadFailed ? (
        <div className="flex flex-wrap items-center gap-2">
          <p role="alert" className="text-body text-danger">
            {t('loadError')}
          </p>
          <Button variant="secondary" onClick={retry}>
            {t('retry')}
          </Button>
        </div>
      ) : comments !== null && comments.length === 0 ? (
        <p className="text-body text-text-muted">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {(comments ?? []).map((comment) => (
            <li
              key={comment.id}
              aria-busy={comment.pending}
              className={comment.pending ? 'opacity-60' : undefined}
            >
              <p className="text-caption text-text-muted">
                <span className="font-medium text-text">{comment.authorName}</span>
                {' · '}
                {comment.pending
                  ? t('sending')
                  : format.dateTime(new Date(comment.createdAt), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
              </p>
              <p className="whitespace-pre-wrap break-words text-body text-text">{comment.body}</p>
            </li>
          ))}
        </ul>
      )}
      <Form
        onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        pending={sending}
        onEdit={() => setSubmitError(false)}
        className="flex flex-col gap-2"
      >
        <label htmlFor={`comment-body-${postId}`} className="sr-only">
          {t('bodyLabel')}
        </label>
        <Textarea
          id={`comment-body-${postId}`}
          disabled={loadFailed}
          autoGrow
          submitOnShortcut
          placeholder={t('bodyLabel')}
          aria-invalid={errors.body !== undefined || submitError}
          {...bodyField}
          ref={(node) => {
            registerRef(node);
            composerRef.current = node;
          }}
        />
        {errors.body !== undefined && (
          <p role="alert" className="text-body text-danger">
            {t('bodyInvalid')}
          </p>
        )}
        {submitError && (
          <p role="alert" className="text-body text-danger">
            {t('submitError')}
          </p>
        )}
        <Button
          type="submit"
          className="self-end"
          pending={sending}
          disabled={!hasText || loading || loadFailed}
        >
          {sending ? t('submitting') : t('submit')}
        </Button>
      </Form>
    </section>
  );
}
