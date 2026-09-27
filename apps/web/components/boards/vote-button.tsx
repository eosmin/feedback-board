'use client';

import { voteToggleResultSchema, type Post } from '@feedback-board/shared';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { useState } from 'react';

import { apiFetch } from '../../lib/api-client';

interface VoteButtonProps {
  orgSlug: string;
  post: Post;
  /** Called with the post's `voteCount` updated from the toggle response (TDD §11). */
  onUpdated: (post: Post) => void;
}

/**
 * Toggles the caller's vote on a post (TDD §11): the endpoint carries no body, and its response
 * reports the resulting `voteCount`, so the button never has to refetch the post to reflect the
 * new count. `Post` carries no per-caller "has voted" flag, so this is a plain toggle rather than
 * a pressed/unpressed control — clicking always flips the caller's own vote.
 */
export function VoteButton({ orgSlug, post, onUpdated }: VoteButtonProps): ReactElement {
  const t = useTranslations('dashboard.boardDetail');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleClick(): Promise<void> {
    setIsSubmitting(true);
    try {
      const result = await apiFetch(
        `/orgs/${orgSlug}/posts/${post.id}/votes`,
        voteToggleResultSchema,
        { method: 'POST' },
      );
      onUpdated({ ...post, voteCount: result.voteCount });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <button type="button" onClick={() => void handleClick()} disabled={isSubmitting}>
      {t('voteButton', { count: post.voteCount })}
    </button>
  );
}
